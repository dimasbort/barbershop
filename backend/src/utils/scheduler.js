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

      if (appointments.length === 0) {
        return; // Нет записей для уведомления
      }

      console.log(`📅 Найдено ${appointments.length} записей для напоминания`);

      for (const a of appointments) {
        const specialistName = a.Specialist?.name || "специалиста";
        const message = `До визита к специалисту ${specialistName} остался 1 час. Барбершоп "Андрей Палыч"`;

        const result = await sendSMS(a.client_phone, message, `reminder_${a.id}`);
        
        if (result?.success !== false) {
          a.notified = true;
          await a.save();
          console.log(`📲 Напоминание отправлено → ${a.client_phone} (${specialistName})`);
        } else {
          console.error(`❌ Не удалось отправить напоминание на ${a.client_phone}:`, result?.error);
        }

        // Добавляем задержку 1 секунда между SMS (rate limiting)
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.error("SMS reminder scheduler error:", err.message);
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

      if (deleted > 0) {
        console.log(`🗑️ Автоочистка: удалено ${deleted} старых записей`);
      }
    } catch (err) {
      console.error("Cleanup scheduler error:", err.message);
    }
  });

  console.log("📅 Планировщик запущен (SMS Rocket)");
  console.log("   • Напоминания: каждые 30 мин в 00/30");
  console.log("   • Очистка: ежедневно в 03:00");
}

/**
 * Уведомление при создании новой записи
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

    const message = `Вы записаны на "${service.name}" на ${dateStr} в ${timeStr}. Барбершоп "Андрей Палыч", ул. 28 июля 37а`;

    const result = await sendSMS(appointment.client_phone, message, `confirm_${appointment.id}`);

    if (result?.success !== false) {
      console.log(`📲 Подтверждение записи отправлено → ${appointment.client_phone}`);
    } else {
      console.error(`❌ Не удалось отправить подтверждение на ${appointment.client_phone}:`, result?.error);
    }
  } catch (err) {
    console.error("Booking confirmation error:", err.message);
  }
}
