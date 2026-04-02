import express from "express";
import Service from "../models/Service.js";

const router = express.Router();

// Временный POST — добавление услуги вручную
router.post("/", async (req, res) => {
  try {
    const service = await Service.create(req.body);
    res.status(201).json(service);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
