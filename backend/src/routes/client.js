import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import Client from "../models/Client.js";
import Appointment from "../models/Appointment.js";
import Specialist from "../models/Specialist.js";
import Service from "../models/Service.js";

const router = express.Router();

// Middleware для проверки клиентского токена
function verifyClient(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
    req.client = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Получить свои записи
router.get("/appointments", verifyClient, async (req, res) => {
  try {
    const now = new Date();
    
    const appointments = await Appointment.findAll({
      where: {
        clientId: req.client.id,
        datetime_start: { [Op.gte]: now }, // только будущие записи
      },
      include: [Specialist, Service],
      order: [["datetime_start", "ASC"]],
    });

    res.json(appointments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Отменить запись
router.delete("/appointments/:id", verifyClient, async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      where: {
        id: req.params.id,
        clientId: req.client.id,
      },
    });

    if (!appointment) {
      return res.status(404).json({ error: "Запись не найдена" });
    }

    // Проверяем, что до записи осталось больше 2 часов
    const now = new Date();
    const appointmentTime = new Date(appointment.datetime_start);
    const timeDiff = appointmentTime.getTime() - now.getTime();
    const hoursUntil = timeDiff / (1000 * 60 * 60);

    if (hoursUntil < 2) {
      return res.status(400).json({ 
        error: "Отменить запись можно не позднее чем за 2 часа до визита" 
      });
    }

    await appointment.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Получить профиль
router.get("/profile", verifyClient, async (req, res) => {
  try {
    const client = await Client.findByPk(req.client.id, {
      attributes: ["id", "phone", "name", "createdAt", "last_login"],
    });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Проверка существования клиента по номеру телефона
router.post("/check-phone", async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: "Номер телефона обязателен" });
    }

    const client = await Client.findOne({ 
      where: { phone },
      attributes: ["id", "phone", "name"] 
    });

    res.json({ exists: !!client, client });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Обновляем маршрут auth для поддержки двух режимов
router.post("/auth", async (req, res) => {
  try {
    const { phone, name, password, gdpr_consent, mode } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: "Телефон и пароль обязательны" });
    }

    let client = await Client.findOne({ where: { phone } });

    if (mode === "login") {
      // Режим входа - клиент должен существовать
      if (!client) {
        return res.status(401).json({ error: "Клиент с таким номером не найден" });
      }

      const valid = await bcrypt.compare(password, client.password_hash);
      if (!valid) {
        return res.status(401).json({ error: "Неверный пароль" });
      }

      client.last_login = new Date();
      await client.save();
    } else if (mode === "register") {
      // Режим регистрации - создаём нового клиента
      if (!name) {
        return res.status(400).json({ error: "Имя обязательно для новых клиентов" });
      }
      
      if (!gdpr_consent) {
        return res.status(400).json({ error: "Необходимо согласие на обработку данных" });
      }

      if (client) {
        return res.status(400).json({ error: "Клиент с таким номером уже существует" });
      }

      const password_hash = await bcrypt.hash(password, 10);
      client = await Client.create({
        phone,
        name,
        password_hash,
        gdpr_consent: true,
      });
    } else {
      return res.status(400).json({ error: "Неверный режим авторизации" });
    }

    const token = jwt.sign(
      { id: client.id, phone: client.phone, name: client.name },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "30d" }
    );

    res.json({
      token,
      client: {
        id: client.id,
        phone: client.phone,
        name: client.name,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


export default router;
