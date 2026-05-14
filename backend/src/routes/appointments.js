import express from "express";
import bcrypt from "bcrypt";
import Client from "../models/Client.js";
import Appointment from "../models/Appointment.js";
import Specialist from "../models/Specialist.js";
import Service from "../models/Service.js";
import AvailableDate from "../models/AvailableDate.js";
import SpecialistService from "../models/SpecialistService.js";
import { sendBookingConfirmation } from "../utils/scheduler.js";
import sequelize from "../models/index.js";
import { Op } from "sequelize";

const router = express.Router();
const BARBERSHOP_TIME_ZONE = "Europe/Minsk";

function getDateInBarbershopTz(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BARBERSHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function getMinutesInBarbershopTz(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BARBERSHOP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Number(value.hour) * 60 + Number(value.minute);
}

function getWeekdayKey(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getUTCDay()];
}

function parseTimeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return hours * 60 + minutes;
}

function createBarbershopDateTime(dateString, time) {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours - 3, minutes, 0, 0));
}

function normalizeBelarusPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (/^375\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\d{9}$/.test(digits)) return `+375${digits}`;
  return null;
}

// Создание новой записи (с автоматической регистрацией клиента)
router.post("/", async (req, res) => {
  try {
    const { 
      specialistId, 
      serviceId, 
      client_name, 
      client_phone, 
      client_password,
      datetime_start,
      gdpr_consent 
    } = req.body;

    // Проверка согласия на обработку данных
    if (!gdpr_consent) {
      return res.status(400).json({ 
        error: "Необходимо согласие на обработку персональных данных" 
      });
    }

    const normalizedPhone = normalizeBelarusPhone(client_phone);

    if (!client_name || !normalizedPhone || !client_password || !datetime_start) {
      return res.status(400).json({ 
        error: "Заполните имя, телефон, пароль и время записи" 
      });
    }

    const startDate = new Date(datetime_start);
    if (Number.isNaN(startDate.getTime()) || startDate <= new Date()) {
      return res.status(400).json({ error: "Некорректное время записи" });
    }

    const service = await Service.findByPk(serviceId);
    if (!service) return res.status(400).json({ error: "Услуга не найдена" });

    const specialist = await Specialist.findByPk(specialistId);
    if (!specialist) return res.status(400).json({ error: "Специалист не найден" });

    // Находим длительность услуги для специалиста
    const ss = await SpecialistService.findOne({
      where: { specialistId: specialistId, serviceId: serviceId },
    });
    if (!ss) return res.status(400).json({ error: "Специалист не оказывает данную услугу" });

    const datetimeEnd = new Date(startDate.getTime() + ss.duration_min * 60000);

    const requestedDate = getDateInBarbershopTz(startDate);
    const availableDate = await AvailableDate.findOne({
      where: {
        specialistId: specialist.id,
        date: requestedDate,
        isAvailable: true,
      },
    });

    if (!availableDate) {
      return res.status(400).json({ error: "Дата недоступна для записи" });
    }

    const intervals = availableDate.customStart && availableDate.customEnd
      ? [`${availableDate.customStart}-${availableDate.customEnd}`]
      : specialist.schedule?.[getWeekdayKey(requestedDate)] || [];

    const startMinutes = getMinutesInBarbershopTz(startDate);
    const endMinutes = startMinutes + ss.duration_min;
    const insideWorkingHours = intervals.some(interval => {
      const [from, to] = interval.split("-");
      const fromMinutes = parseTimeToMinutes(from);
      const toMinutes = parseTimeToMinutes(to);
      if (fromMinutes === null || toMinutes === null) return false;
      return startMinutes >= fromMinutes && endMinutes <= toMinutes;
    });

    if (!insideWorkingHours) {
      return res.status(400).json({ error: "Время недоступно для записи" });
    }

    const appointment = await sequelize.transaction(async transaction => {
      // Повторяем проверку занятости внутри транзакции, чтобы снизить риск двойной записи.
      const overlap = await Appointment.findOne({
        where: {
          specialistId: specialistId,
          datetime_start: { [Op.lt]: datetimeEnd },
          datetime_end: { [Op.gt]: startDate },
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (overlap) {
        const err = new Error("Выбранное время уже занято");
        err.status = 400;
        throw err;
      }

      // Регистрируем/находим клиента
      let client = await Client.findOne({
        where: { phone: normalizedPhone },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!client) {
        const password_hash = await bcrypt.hash(client_password, 10);
        client = await Client.create({
          phone: normalizedPhone,
          name: client_name,
          password_hash,
          gdpr_consent: true,
        }, { transaction });
      } else {
        const validPassword = await bcrypt.compare(client_password, client.password_hash);
        if (!validPassword) {
          const err = new Error("Неверный пароль от личного кабинета");
          err.status = 401;
          throw err;
        }
      }

      // Создаём запись
      return Appointment.create({
        specialistId: specialistId,
        serviceId: serviceId,
        clientId: client.id,
        client_name: client.name,
        client_phone: client.phone,
        datetime_start: startDate,
        datetime_end: datetimeEnd,
        confirmed: true,
      }, { transaction });
    });

    // Отправляем SMS-подтверждение
    await sendBookingConfirmation(appointment, specialist, { name: service.name });

    res.status(201).json(appointment);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
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
          specialistId: specialist.id,
          serviceId: serviceId,
        },
      });
      if (ss) duration = ss.duration_min;
    }

    const appointments = await Appointment.findAll({
      where: { specialistId: specialist.id },
    });

    // Получаем дни, открытые для записи
    const today = getDateInBarbershopTz(new Date());

    const availableDates = await AvailableDate.findAll({
      where: {
        specialistId: specialist.id,
        isAvailable: true,
        date: { [Op.gte]: today },
      },
      order: [["date", "ASC"]],
    });

    const result = [];

    for (const ad of availableDates) {
      const dateStr = ad.date;

      // Определяем рабочие часы (кастомные или из расписания)
      let intervals = [];
      if (ad.customStart && ad.customEnd) {
        intervals = [`${ad.customStart}-${ad.customEnd}`];
      } else {
        const weekday = getWeekdayKey(dateStr);
        intervals = specialist.schedule?.[weekday] || [];
      }

      const slots = [];

      for (const interval of intervals) {
        const [start, end] = interval.split("-");
        const slotStart = createBarbershopDateTime(dateStr, start);
        const slotEnd = createBarbershopDateTime(dateStr, end);

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
