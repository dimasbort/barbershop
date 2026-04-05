import axios from "axios";

const MTS_API_URL = process.env.MTS_API_URL;
const CLIENT_ID = process.env.MTS_CLIENT_ID;
const USERNAME = process.env.MTS_USERNAME;
const PASSWORD = process.env.MTS_PASSWORD;

// Базовая аутентификация (Basic Auth)
const auth = {
  username: USERNAME,
  password: PASSWORD,
};

/**
 * Отправка SMS через МТС-Коммуникатор
 * @param {string} phone - номер телефона (375291234567)
 * @param {string} message - текст сообщения
 * @param {string} extraId - внешний идентификатор (необязательно)
 */
export async function sendSMS(phone, message, extraId = null) {
  try {
    // Убираем "+" если есть
    const normalizedPhone = phone.replace("+", "").trim();
    
    // Генерируем уникальный extraId если не передан
    const messageExtraId = extraId || `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const payload = {
      phone_number: parseInt(normalizedPhone),
      extra_id: messageExtraId,
      channels: ["sms"],
      channel_options: {
        sms: {
          text: message,
          alpha_name: "AndreiPalych", // имя отправителя (до 11 символов)
          ttl: 3600, // время жизни сообщения в секундах (1 час)
        },
      },
    };

    const response = await axios.post(
      `${MTS_API_URL}/${CLIENT_ID}/json2/simple`,
      payload,
      {
        auth,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.status === 200) {
      console.log(`📲 SMS отправлено на ${phone}, message_id: ${response.data.message_id}`);
      return response.data;
    } else {
      console.error("MTS API error:", response.status, response.data);
    }
  } catch (err) {
    console.error("Ошибка отправки SMS через МТС:", err?.response?.data || err.message);
  }
}

/**
 * Отправка комбо SMS + Viber (опционально)
 * @param {string} phone - номер телефона
 * @param {string} message - текст сообщения
 * @param {object} options - дополнительные параметры
 */
export async function sendComboMessage(phone, message, options = {}) {
  try {
    const normalizedPhone = phone.replace("+", "").trim();
    const messageExtraId = options.extraId || `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const payload = {
      phone_number: parseInt(normalizedPhone),
      extra_id: messageExtraId,
      channels: ["viber", "sms"], // сначала Viber, потом SMS как фолбэк
      channel_options: {
        viber: {
          text: message,
          ttl: 300, // 5 минут для Viber
          alpha_name: "AndreiPalych",
        },
        sms: {
          text: message,
          alpha_name: "AndreiPalych",
          ttl: 3600,
        },
      },
    };

    const response = await axios.post(
      `${MTS_API_URL}/${CLIENT_ID}/json2/simple`,
      payload,
      {
        auth,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.status === 200) {
      console.log(`📲 Комбо-сообщение отправлено на ${phone}, message_id: ${response.data.message_id}`);
      return response.data;
    }
  } catch (err) {
    console.error("Ошибка отправки комбо-сообщения:", err?.response?.data || err.message);
  }
}
