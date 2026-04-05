import express from "express";
import Appointment from "../models/Appointment.js";
import Specialist from "../models/Specialist.js";
import Service from "../models/Service.js";
import AvailableDate from "../models/AvailableDate.js";
import SpecialistService from "../models/SpecialistService.js";
import { sendBookingConfirmation } from "../utils/scheduler.js";
import { Op } from "sequelize";

const router = express.Router();

// Создание новой записи
router.post("/", async (req, res) => {
  try {
    const { specialistId, serviceId, client_name, client_phone, datetime_start } = req.body;

    const service = await Service.findByPk(serviceId);
    if (!service) return res.status(400).json({ error: "Услуга не найдена" });

    const specialist = await Specialist.findByPk(specialistId);
    if (!specialist) return res.status(400).json({ error: "Специалист не найден" });

    const datetimeEnd = new Date(new Date(datetime_start).getTime() + service.duration_min * 60000);

    // Проверяем, не занято ли время
    const overlap = await Appointment.findOne({
      where: {
        SpecialistId: specialistId,
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
      SpecialistId: specialistId,
      ServiceId: serviceId,
      client_name,
      client_phone,
      datetime_start,
      datetime_end: datetimeEnd,
      confirmed: true,
    });

    // 🆕 Отправляем SMS-подтверждение сразу после создания
    await sendBookingConfirmation(appointment, specialist, service);

    res.status(201).json(appointment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


router.get("/:specialistId/available", async (req, res) => {
  try {
    const specialist = await Specialist.findByPk(req.params.specialistId);
    if (!specialist) return res.status(404).json({ error: "Not found" });

    const serviceId = req.query.serviceId;
    let duration = 30;

    if (serviceId) {
      // Ищем длительность из промежуточной таблицы
      const ss = await SpecialistService.findOne({
        where: {
          SpecialistId: specialist.id,
          ServiceId: serviceId,
        },
      });
      if (ss) duration = ss.duration_min;
    }

    const appointments = await Appointment.findAll({
      where: { SpecialistId: specialist.id },
    });

    // Получаем дни, открытые для записи
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const availableDates = await AvailableDate.findAll({
      where: {
        SpecialistId: specialist.id,
        isAvailable: true,
        date: { [Op.gte]: today },
      },
      order: [["date", "ASC"]],
    });

    const result = [];

    for (const ad of availableDates) {
      const date = new Date(ad.date);
      const dateStr = ad.date;

      // Определяем рабочие часы (кастомные или из расписания)
      let intervals = [];
      if (ad.customStart && ad.customEnd) {
        intervals = [`${ad.customStart}-${ad.customEnd}`];
      } else {
        const weekday = ["sun","mon","tue","wed","thu","fri","sat"][date.getDay()];
        intervals = specialist.schedule?.[weekday] || [];
      }

      const slots = [];

      for (const interval of intervals) {
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
          const busy = appointments.find(a => {
            const aStart = new Date(a.datetime_start);
            const aEnd = new Date(a.datetime_end);
            return aStart < slotFinish && aEnd > time;
          });
          if (!busy && time > new Date()) {
            slots.push(time.toISOString());
          }
        }
      }

      result.push({ date: dateStr, available: slots.length > 0, slots });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


export default router;
