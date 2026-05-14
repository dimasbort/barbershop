import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import Admin from "../models/Admin.js";
import Appointment from "../models/Appointment.js";
import Service from "../models/Service.js";
import Specialist from "../models/Specialist.js";
import AvailableDate from "../models/AvailableDate.js";
import SpecialistService from "../models/SpecialistService.js";
import { verifyAdmin } from "../middleware/auth.js";

const router = express.Router();

// Создание первого администратора (временный маршрут)
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password || password.length < 8) {
      return res.status(400).json({ error: "Username and password with at least 8 characters are required" });
    }

    const adminsCount = await Admin.count();
    if (adminsCount > 0) {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(403).json({ error: "Admin registration is closed" });

      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.JWT_SECRET || "secretkey");
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
    process.env.JWT_SECRET || "secretkey",
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
