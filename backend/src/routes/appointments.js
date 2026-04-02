import express from "express";
import Appointment from "../models/Appointment.js";
import Specialist from "../models/Specialist.js";
import Service from "../models/Service.js";
import { Op } from "sequelize";

const router = express.Router();

// Получение ближайших записей (например, для админки)
router.get("/upcoming", async (req, res) => {
  try {
    const now = new Date();
    const appointments = await Appointment.findAll({
      where: { datetime_start: { [Op.gte]: now } },
      include: [Specialist, Service],
      order: [["datetime_start", "ASC"]],
    });
    res.json(appointments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Создание новой записи
router.post("/", async (req, res) => {
  try {
    const { specialistId, serviceId, client_name, client_phone, datetime_start } = req.body;

    const service = await Service.findByPk(serviceId);
    if (!service) return res.status(400).json({ error: "Услуга не найдена" });

    const datetimeEnd = new Date(new Date(datetime_start).getTime() + service.duration_min * 60000);

    // Проверяем, не занято ли время
    const overlap = await Appointment.findOne({
      where: {
        specialistId,
        [Op.or]: [
          {
            datetime_start: { [Op.between]: [datetime_start, datetimeEnd] },
          },
          {
            datetime_end: { [Op.between]: [datetime_start, datetimeEnd] },
          },
        ],
      },
    });

    if (overlap)
      return res.status(400).json({ error: "Выбранное время уже занято" });

    const appointment = await Appointment.create({
      specialistId,
      serviceId,
      client_name,
      client_phone,
      datetime_start,
      datetime_end: datetimeEnd,
      confirmed: true,
    });


    res.status(201).json(appointment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Получение доступных слотов (пока простая логика)
router.get("/:specialistId/available", async (req, res) => {
  try {
    const specialist = await Specialist.findByPk(req.params.specialistId);
    if (!specialist) return res.status(404).json({ error: "Specialist not found" });

    const serviceId = req.query.serviceId;
    let duration = 30; // дефолтный шаг слота

    if (serviceId) {
      const service = await Service.findByPk(serviceId);
      if (service) duration = service.duration_min;
    }

    const appointments = await Appointment.findAll({
      where: { SpecialistId: specialist.id },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = [];

    for (let day = 0; day < 7; day++) {
      const date = new Date(today);
      date.setDate(today.getDate() + day);

      const weekday = ["sun","mon","tue","wed","thu","fri","sat"][date.getDay()];
      const daySchedule = specialist.schedule?.[weekday] || [];
      const slots = [];

      for (const interval of daySchedule) {
        const [start, end] = interval.split("-");
        const [startH, startM] = start.split(":").map(Number);
        const [endH, endM] = end.split(":").map(Number);

        const slotStart = new Date(date);
        slotStart.setHours(startH, startM, 0, 0);

        const slotEnd = new Date(date);
        slotEnd.setHours(endH, endM, 0, 0);

        for (
          let time = new Date(slotStart);
          time.getTime() + duration * 60000 <= slotEnd.getTime();
          time = new Date(time.getTime() + 30 * 60000)
        ) {
          const slotFinish = new Date(time.getTime() + duration * 60000);
          const overlapping = appointments.find(a => {
            const aStart = new Date(a.datetime_start);
            const aEnd = new Date(a.datetime_end);
            return aStart < slotFinish && aEnd > time;
          });

          if (!overlapping && time > new Date()) {
            slots.push(time.toISOString());
          }
        }
      }

      result.push({
        date: date.toISOString().slice(0, 10),
        available: slots.length > 0,
        slots,
      });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
