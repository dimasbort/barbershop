import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Op } from "sequelize";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Admin from "../models/Admin.js";
import Client from "../models/Client.js";
import Appointment from "../models/Appointment.js";
import Service from "../models/Service.js";
import Specialist from "../models/Specialist.js";
import AvailableDate from "../models/AvailableDate.js";
import SpecialistService from "../models/SpecialistService.js";
import { getJwtSecret, verifyAdmin } from "../middleware/auth.js";
import { sendBookingConfirmation } from "../utils/scheduler.js";
import sequelize from "../models/index.js";

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, "../../uploads/specialists");

function normalizeBelarusPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (/^375\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\d{9}$/.test(digits)) return `+375${digits}`;
  return null;
}

// Создание первого администратора (временный маршрут)
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password || password.length < 5) {
      return res.status(400).json({ error: "Username and password with at least 5 characters are required" });
    }

    const adminsCount = await Admin.count();
    if (adminsCount > 0) {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(403).json({ error: "Admin registration is closed" });

      const token = authHeader.split(" ")[1];
      jwt.verify(token, getJwtSecret());
    }

    const hash = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ username, password_hash: hash });
    res.status(201).json({ id: admin.id, username: admin.username });
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(403).json({ error: "Invalid admin token" });
    }
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Admin already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Авторизация ──────────────────────────────

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password are required" });

  const admin = await Admin.findOne({ where: { username } });
  if (!admin) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    { id: admin.id },
    getJwtSecret(),
    { expiresIn: "8h" }
  );
  res.json({ token });
});

// ── Записи ───────────────────────────────────

router.get("/appointments", verifyAdmin, async (req, res) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const rows = await Appointment.findAll({
    where: { datetime_start: { [Op.gte]: now } },
    include: [Specialist, Service],
    order: [["datetime_start", "ASC"]],
  });
  res.json(rows);
});

router.post("/appointments", verifyAdmin, async (req, res) => {
  try {
    const {
      specialistId,
      serviceId,
      client_name,
      client_phone,
      datetime_start,
    } = req.body;

    const normalizedPhone = normalizeBelarusPhone(client_phone);
    if (!specialistId || !serviceId || !normalizedPhone || !datetime_start) {
      return res.status(400).json({ error: "Specialist, service, phone and time are required" });
    }

    const startDate = new Date(datetime_start);
    if (Number.isNaN(startDate.getTime())) {
      return res.status(400).json({ error: "Invalid appointment time" });
    }

    const [specialist, service, ss] = await Promise.all([
      Specialist.findByPk(specialistId),
      Service.findByPk(serviceId),
      SpecialistService.findOne({ where: { specialistId, serviceId } }),
    ]);

    if (!specialist) return res.status(400).json({ error: "Specialist not found" });
    if (!service) return res.status(400).json({ error: "Service not found" });
    if (!ss) return res.status(400).json({ error: "Specialist does not provide this service" });

    const datetimeEnd = new Date(startDate.getTime() + ss.duration_min * 60000);

    const appointment = await sequelize.transaction(async transaction => {
      const overlap = await Appointment.findOne({
        where: {
          specialistId,
          datetime_start: { [Op.lt]: datetimeEnd },
          datetime_end: { [Op.gt]: startDate },
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (overlap) {
        const err = new Error("Selected time is already booked");
        err.status = 400;
        throw err;
      }

      let client = await Client.findOne({
        where: { phone: normalizedPhone },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!client) {
        if (!client_name || !String(client_name).trim()) {
          const err = new Error("Client name is required for a new phone");
          err.status = 400;
          throw err;
        }

        client = await Client.create({
          phone: normalizedPhone,
          name: String(client_name).trim(),
          password_hash: await bcrypt.hash(crypto.randomUUID(), 10),
          gdpr_consent: true,
        }, { transaction });
      }

      return Appointment.create({
        specialistId,
        serviceId,
        clientId: client.id,
        client_name: client.name,
        client_phone: client.phone,
        datetime_start: startDate,
        datetime_end: datetimeEnd,
        confirmed: true,
      }, { transaction });
    });

    await sendBookingConfirmation(appointment, specialist, { name: service.name });

    const created = await Appointment.findByPk(appointment.id, { include: [Specialist, Service] });
    res.status(201).json(created);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/appointments/:id", verifyAdmin, async (req, res) => {
  await Appointment.destroy({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ── Специалисты ──────────────────────────────

router.get("/specialists", verifyAdmin, async (req, res) => {
  try {
    const rows = await Specialist.findAll({
      include: {
        model: Service,
        through: { attributes: ["price", "duration_min"] },
      },
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


router.post("/specialists", verifyAdmin, async (req, res) => {
  if (!req.body.name) return res.status(400).json({ error: "Specialist name is required" });
  const s = await Specialist.create(req.body);
  res.status(201).json(s);
});

router.put("/specialists/:id", verifyAdmin, async (req, res) => {
  const s = await Specialist.findByPk(req.params.id);
  if (!s) return res.status(404).json({ error: "Not found" });
  await s.update(req.body);
  res.json(s);
});

router.post("/specialists/photo", verifyAdmin, async (req, res) => {
  try {
    const { fileName, dataUrl } = req.body;
    const match = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
    if (!match) {
      return res.status(400).json({ error: "Поддерживаются только PNG, JPG и WEBP" });
    }

    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > 3 * 1024 * 1024) {
      return res.status(400).json({ error: "Фото должно быть меньше 3 МБ" });
    }

    await fs.mkdir(uploadsDir, { recursive: true });
    const baseName = String(fileName || "specialist")
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "specialist";
    const storedName = `${Date.now()}-${baseName}.${ext}`;
    await fs.writeFile(path.join(uploadsDir, storedName), buffer);

    res.status(201).json({ url: `/uploads/specialists/${storedName}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Услуги ───────────────────────────────────

router.get("/services", verifyAdmin, async (req, res) => {
  const rows = await Service.findAll();
  res.json(rows);
});

router.post("/services", verifyAdmin, async (req, res) => {
  if (!req.body.name) return res.status(400).json({ error: "Service name is required" });
  const s = await Service.create(req.body);
  res.status(201).json(s);
});

router.put("/services/:id", verifyAdmin, async (req, res) => {
  const s = await Service.findByPk(req.params.id);
  if (!s) return res.status(404).json({ error: "Not found" });
  await s.update(req.body);
  res.json(s);
});

router.delete("/services/:id", verifyAdmin, async (req, res) => {
  await SpecialistService.destroy({ where: { serviceId: req.params.id } });
  await Service.destroy({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ── Связь специалист ↔ услуга ─────────────────

router.post("/specialist-service", verifyAdmin, async (req, res) => {
  const { specialistId, serviceId, price, duration_min } = req.body;
  if (!specialistId || !serviceId || !Number(price) || !Number(duration_min)) {
    return res.status(400).json({ error: "Specialist, service, price and duration are required" });
  }

  const [row, created] = await SpecialistService.findOrCreate({
    where: { specialistId: specialistId, serviceId: serviceId },
    defaults: { price, duration_min },
  });
  if (!created) await row.update({ price, duration_min });
  res.json(row);
});

router.delete("/specialist-service", verifyAdmin, async (req, res) => {
  const { specialistId, serviceId } = req.body;
  await SpecialistService.destroy({
    where: { specialistId: specialistId, serviceId: serviceId },
  });
  res.json({ success: true });
});

// ── Доступные даты ────────────────────────────

router.get("/available-dates/:specialistId", verifyAdmin, async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows = await AvailableDate.findAll({
    where: {
      specialistId: req.params.specialistId,
      date: { [Op.gte]: today },
    },
    order: [["date", "ASC"]],
  });
  res.json(rows);
});

router.post("/available-dates", verifyAdmin, async (req, res) => {
  const { specialistId, date, isAvailable, customStart, customEnd } = req.body;
  const [row, created] = await AvailableDate.findOrCreate({
    where: { specialistId: specialistId, date },
    defaults: { isAvailable, customStart, customEnd },
  });
  if (!created) await row.update({ isAvailable, customStart, customEnd });
  res.json(row);
});

router.delete("/available-dates/:id", verifyAdmin, async (req, res) => {
  await AvailableDate.destroy({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
