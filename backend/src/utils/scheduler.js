import cron from "node-cron";
import { Op } from "sequelize";
import { sendSMS } from "./sms.js";
import Appointment from "../models/Appointment.js";
import Specialist from "../models/Specialist.js";
import Service from "../models/Service.js";

export function initScheduler() {

  // ── SMS-напоминания за час до визита (каждые 30 мин в 00 и 30) ──
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
        const specialistName = a.Specialist?.name || "специалиста";
        const message = `До визита к специалисту ${specialistName} остался 1 час`;

        await sendSMS(a.client_phone, message, `reminder_${a.id}`);

        a.notified = true;
        await a.save();

        console.log(`📲 Напоминание → ${a.client_phone} (${specialistName})`);
      }

      if (appointments.length > 0) {
        console.log(`📅 Обработано ${appointments.length} напоминаний`);
      }
    } catch (err) {
      console.error("SMS reminder error:", err.message);
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

      console.log(`🗑️ Автоочистка: удалено ${deleted} старых записей`);
    } catch (err) {
      console.error("Cleanup error:", err.message);
    }
  });

  console.log("📅 Планировщик запущен (МТС-Коммуникатор)");
  console.log("   • Напоминания: каждые 30 мин в 00/30");
  console.log("   • Очистка: ежедневно в 03:00");
}

/**
 * Уведомление при создании новой записи
 * Вызывается из API при создании записи
 */
export async function sendBookingConfirmation(appointment, specialist, service) {
  try {
    const date = new Date(appointment.datetime_start);
    const dateStr = date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const timeStr = date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const message = `Вы записаны на ${service.name} на ${dateStr} в ${timeStr}`;

    await sendSMS(appointment.client_phone, message, `confirm_${appointment.id}`);

    console.log(`📲 Подтверждение записи → ${appointment.client_phone}`);
  } catch (err) {
    console.error("Booking confirmation error:", err.message);
  }
}
