import express from "express";
import Specialist from "../models/Specialist.js";
import Service from "../models/Service.js";
import SpecialistService from "../models/SpecialistService.js";

const router = express.Router();

// Получить всех специалистов
router.get("/", async (req, res) => {
  try {
    const specialists = await Specialist.findAll();
    res.json(specialists);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Получить услуги конкретного специалиста
router.get("/:id/services", async (req, res) => {
  try {
    const specialist = await Specialist.findByPk(req.params.id, {
      include: {
        model: Service,
        attributes: ["id", "name"], 
        through: {
          attributes: ["price", "duration_min"],
        },
      },
    });

    if (!specialist) {
      return res.status(404).json({ error: "Specialist not found" });
    }

    const result = specialist.Services.map(service => ({
      id: service.id,
      name: service.name,
      price: service.SpecialistService.price,
      duration_min: service.SpecialistService.duration_min,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Временный маршрут для добавления специалистов (для теста)
router.post("/", async (req, res) => {
  try {
    const specialist = await Specialist.create(req.body);
    res.status(201).json(specialist);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
