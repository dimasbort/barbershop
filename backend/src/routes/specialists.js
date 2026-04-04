import express from "express";
import Specialist from "../models/Specialist.js";
import Service from "../models/Service.js";
import SpecialistService from "../models/SpecialistService.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const specialists = await Specialist.findAll();
    res.json(specialists);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id/services", async (req, res) => {
  try {
    const specialist = await Specialist.findByPk(req.params.id, {
      include: {
        model: Service,
        through: { attributes: ["price", "duration_min"] },
      },
    });
    if (!specialist) return res.status(404).json({ error: "Not found" });

    // Форматируем ответ — price и duration_min берём из промежуточной таблицы
    const services = specialist.Services.map(s => ({
      id: s.id,
      name: s.name,
      price: s.SpecialistService.price,
      duration_min: s.SpecialistService.duration_min,
    }));

    res.json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const specialist = await Specialist.create(req.body);
    res.status(201).json(specialist);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
