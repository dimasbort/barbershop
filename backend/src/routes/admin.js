import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import Appointment from "../models/Appointment.js";
import Service from "../models/Service.js";
import Specialist from "../models/Specialist.js";
import { Op } from "sequelize";
import { verifyAdmin } from "../middleware/auth.js";

const router = express.Router();

// Создание первого администратора (временный маршрут)
router.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const admin = await Admin.create({ username, password_hash: hash });
  res.json(admin);
});

// Вход
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ where: { username } });
  if (!admin) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: admin.id, username: admin.username }, process.env.JWT_SECRET || "secretkey", {
    expiresIn: "2h",
  });

  res.json({ token });
});

// Список будущих записей
router.get("/appointments", verifyAdmin, async (req, res) => {
  const now = new Date();
  const appointments = await Appointment.findAll({
    where: { datetime_start: { [Op.gte]: now } },
    include: [Specialist, Service],
    order: [["datetime_start", "ASC"]],
  });
  res.json(appointments);
});

// Удалить запись
router.delete("/appointments/:id", verifyAdmin, async (req, res) => {
  const result = await Appointment.destroy({ where: { id: req.params.id } });
  res.json({ success: !!result });
});

// Добавить/изменить услугу
router.post("/services", verifyAdmin, async (req, res) => {
  const { id, name, duration_min, price, specialistId } = req.body;
  const service = id
    ? await Service.findByPk(id).then(s => s.update({ name, duration_min, price, specialistId }))
    : await Service.create({ name, duration_min, price, specialistId });
  res.json(service);
});

export default router;
