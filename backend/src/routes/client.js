import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import Client from "../models/Client.js";
import Appointment from "../models/Appointment.js";
import Specialist from "../models/Specialist.js";
import Service from "../models/Service.js";
import PasswordResetCode from "../models/PasswordResetCode.js";
import { sendSMS } from "../utils/sms.js";
import { getJwtSecret } from "../middleware/auth.js";

const router = express.Router();
const RESET_CODE_TTL_MINUTES = 5;

function normalizeBelarusPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (/^375\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\d{9}$/.test(digits)) return `+375${digits}`;
  return null;
}

function generateResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createClientToken(client) {
  return jwt.sign(
    { id: client.id, phone: client.phone, name: client.name },
    getJwtSecret(),
    { expiresIn: "5m" }
  );
}

// Middleware для проверки клиентского токена
function verifyClient(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret());
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

// Обновить имя в профиле
router.put("/profile", verifyClient, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name || name.length < 2) {
      return res.status(400).json({ error: "Введите имя минимум из 2 символов" });
    }

    const client = await Client.findByPk(req.client.id);
    if (!client) return res.status(404).json({ error: "Клиент не найден" });

    client.name = name;
    await client.save();
    await Appointment.update(
      { client_name: name },
      {
        where: {
          clientId: client.id,
          datetime_start: { [Op.gte]: new Date() },
        },
      }
    );

    res.json({
      client: {
        id: client.id,
        phone: client.phone,
        name: client.name,
      },
      token: createClientToken(client),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Изменить пароль из личного кабинета
router.put("/password", verifyClient, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password || new_password.length < 4) {
      return res.status(400).json({ error: "Укажите текущий пароль и новый пароль минимум из 4 символов" });
    }

    const client = await Client.findByPk(req.client.id);
    if (!client) return res.status(404).json({ error: "Клиент не найден" });

    const valid = await bcrypt.compare(current_password, client.password_hash);
    if (!valid) {
      return res.status(400).json({ error: "Текущий пароль указан неверно" });
    }

    client.password_hash = await bcrypt.hash(new_password, 10);
    await client.save();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Проверка существования клиента по номеру телефона
router.post("/check-phone", async (req, res) => {
  try {
    const phone = normalizeBelarusPhone(req.body.phone);
    
    if (!phone) {
      return res.status(400).json({ error: "Введите корректный номер телефона" });
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

// Запросить SMS-код для восстановления пароля
router.post("/password-reset/request", async (req, res) => {
  try {
    const phone = normalizeBelarusPhone(req.body.phone);
    if (!phone) {
      return res.status(400).json({ error: "Введите корректный номер телефона" });
    }

    const client = await Client.findOne({ where: { phone } });
    if (!client) {
      return res.status(404).json({ error: "Клиент с таким номером не найден" });
    }

    const code = generateResetCode();
    const code_hash = await bcrypt.hash(code, 10);
    const expires_at = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000);

    const result = await sendSMS(
      phone,
      `Код восстановления пароля: ${code}. Он действует ${RESET_CODE_TTL_MINUTES} минут. Барбершоп "Андрей Палыч"`,
      `password_reset_${client.id}_${Date.now()}`
    );

    if (result?.success === false) {
      return res.status(502).json({ error: "Не удалось отправить SMS-код. Попробуйте позже." });
    }

    await PasswordResetCode.update(
      { used_at: new Date() },
      {
        where: {
          clientId: client.id,
          used_at: null,
          expires_at: { [Op.gt]: new Date() },
        },
      }
    );

    await PasswordResetCode.create({
      clientId: client.id,
      phone,
      code_hash,
      expires_at,
    });

    res.json({ success: true, expires_in_minutes: RESET_CODE_TTL_MINUTES });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Подтвердить SMS-код и установить новый пароль
router.post("/password-reset/verify", async (req, res) => {
  try {
    const phone = normalizeBelarusPhone(req.body.phone);
    const code = String(req.body.code || "").trim();

    if (!phone || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "Укажите телефон и 6-значный код" });
    }

    const client = await Client.findOne({ where: { phone } });
    if (!client) {
      return res.status(404).json({ error: "Клиент с таким номером не найден" });
    }

    const reset = await PasswordResetCode.findOne({
      where: {
        clientId: client.id,
        phone,
        used_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
      order: [["createdAt", "DESC"]],
    });

    if (!reset) {
      return res.status(400).json({ error: "Код не найден или срок действия истёк" });
    }

    const validCode = await bcrypt.compare(code, reset.code_hash);
    if (!validCode) {
      return res.status(400).json({ error: "Неверный код восстановления" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/password-reset/confirm", async (req, res) => {
  try {
    const phone = normalizeBelarusPhone(req.body.phone);
    const code = String(req.body.code || "").trim();
    const new_password = String(req.body.new_password || "");

    if (!phone || !/^\d{6}$/.test(code) || new_password.length < 4) {
      return res.status(400).json({ error: "Укажите телефон, 6-значный код и новый пароль минимум из 4 символов" });
    }

    const client = await Client.findOne({ where: { phone } });
    if (!client) {
      return res.status(404).json({ error: "Клиент с таким номером не найден" });
    }

    const reset = await PasswordResetCode.findOne({
      where: {
        clientId: client.id,
        phone,
        used_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
      order: [["createdAt", "DESC"]],
    });

    if (!reset) {
      return res.status(400).json({ error: "Код не найден или срок действия истёк" });
    }

    const validCode = await bcrypt.compare(code, reset.code_hash);
    if (!validCode) {
      return res.status(400).json({ error: "Неверный код восстановления" });
    }

    client.password_hash = await bcrypt.hash(new_password, 10);
    client.last_login = new Date();
    await client.save();

    reset.used_at = new Date();
    await reset.save();

    await PasswordResetCode.update(
      { used_at: new Date() },
      {
        where: {
          clientId: client.id,
          used_at: null,
        },
      }
    );

    res.json({
      success: true,
      token: createClientToken(client),
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

// Обновляем маршрут auth для поддержки двух режимов
router.post("/auth", async (req, res) => {
  try {
    const phone = normalizeBelarusPhone(req.body.phone);
    const { name, password, gdpr_consent, mode } = req.body;

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

    const token = createClientToken(client);

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
