import cron from "node-cron";
import { sendSMS } from "./sms.js";
import Appointment from "../models/Appointment.js";
import Specialist from "../models/Specialist.js";
import Service from "../models/Service.js";
import { Op } from "sequelize";

export function initScheduler() {
  // запуск в начале и середине каждого часа (00 и 30 минут)
  cron.schedule("0,30 * * * *", async () => {
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
      const serviceName = a.Service?.name || "услуга";
      const specialistName = a.Specialist?.name || "специалист";
      const time = new Date(a.datetime_start).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const msg = `Напоминаем: ${serviceName} у ${specialistName} в ${time}. С любовью, Andreipalych.by`;

      await sendSMS(a.client_phone, msg);
      a.notified = true;
      await a.save();
    }
  });

  console.log("📅 Планировщик SMS.BY запущен (каждые 30 мин)");
}
