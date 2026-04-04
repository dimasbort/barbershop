import cron from "node-cron";
import { Op } from "sequelize";
import { sendSMS } from "./sms.js";
import Appointment from "../models/Appointment.js";
import Specialist from "../models/Specialist.js";
import Service from "../models/Service.js";

export function initScheduler() {

  // ── SMS-напоминания (каждые 30 мин в 00 и 30) ──────────────────
  cron.schedule("0,30 * * * *", async () => {
    try {
      const now = new Date();
      const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

      const appointments = await Appointment.findAll({
        where: {
          confirmed: true,
          notified: false,
          datetime_start: { [Op.between]: [now, inOneHour] },
        },
        include: [Specialist, Service],
      });

      for (const a of appointments) {
        const time = new Date(a.datetime_start).toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const msg = `Напоминаем: ${a.Service?.name || "услуга"} у ${a.Specialist?.name || "специалиста"} в ${time}. До встречи — Барбершоп Андрей Палыч!`;

        await sendSMS(a.client_phone, msg);

        a.notified = true;
        await a.save();

        console.log(`📲 SMS → ${a.client_phone}`);
      }
    } catch (err) {
      console.error("SMS scheduler error:", err.message);
    }
  });

  // ── Автоочистка старых записей (каждый день в 03:00) ───────────
  cron.schedule("0 3 * * *", async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(23, 59, 59, 999);

      const deleted = await Appointment.destroy({
        where: {
          datetime_start: { [Op.lte]: yesterday },
        },
      });

      console.log(`🗑️  Автоочистка: удалено ${deleted} старых записей`);
    } catch (err) {
      console.error("Cleanup scheduler error:", err.message);
    }
  });

  console.log("📅 Планировщик запущен (SMS: каждые 30 мин | Очистка: 03:00)");
}