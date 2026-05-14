import axios from "axios";
import crypto from "crypto";

const SMS_API_BASE = "https://api.rocketsms.by/simple";

function getSmsCredentials() {
  const username = process.env.SMS_ROCKET_USERNAME;
  const password = process.env.SMS_ROCKET_PASSWORD;

  if (!username || !password) {
    return null;
  }

  return {
    username,
    password: crypto.createHash("md5").update(password).digest("hex"),
  };
}

export async function sendSMS(phone, message, extraId = null) {
  try {
    const credentials = getSmsCredentials();
    if (!credentials) {
      console.warn("SMS Rocket credentials are not configured; SMS skipped");
      return { success: false, error: "SMS credentials are not configured" };
    }

    // Нормализуем номер: оставляем только цифры
    const normalizedPhone = phone.replace(/\D/g, "");
    
    if (!/^375\d{9}$/.test(normalizedPhone)) {
      return { success: false, error: "Invalid Belarus phone number" };
    }

    const params = new URLSearchParams({
      ...credentials,
      phone: normalizedPhone,
      text: message,
    });

    const { data } = await axios.post(`${SMS_API_BASE}/send`, params, {
      timeout: 10000,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (data?.error) {
      return { success: false, error: data.error, details: data };
    }

    console.log(`📲 SMS отправлено на +${normalizedPhone}, ID: ${data?.id || extraId || "N/A"}`);
    return { success: true, ...data };
  } catch (err) {
    console.error("Ошибка отправки SMS через SMS Rocket:", err.message);
    return { success: false, error: err.message, details: err };
  }
}

/**
 * Проверка баланса SMS Rocket (полезно для мониторинга)
 */
export async function checkSMSBalance() {
  try {
    const credentials = getSmsCredentials();
    if (!credentials) {
      console.warn("SMS Rocket credentials are not configured; balance check skipped");
      return null;
    }

    const { data } = await axios.get(`${SMS_API_BASE}/balance`, {
      timeout: 10000,
      params: credentials,
    });

    if (data?.error) {
      console.error("SMS Rocket balance error:", data.error);
      return null;
    }

    console.log(`💰 SMS Rocket баланс: ${JSON.stringify(data)}`);
    return data;
  } catch (err) {
    console.error("Ошибка получения баланса:", err.message);
    return null;
  }
}
