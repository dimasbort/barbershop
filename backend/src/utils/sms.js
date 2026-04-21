import RocketSMS from "node-rocketsms-api";

// Инициализация клиента SMS Rocket
const smsClient = new RocketSMS(
  process.env.SMS_ROCKET_USERNAME,
  process.env.SMS_ROCKET_PASSWORD
);

/**
 * Отправка SMS через SMS Rocket
 * @param {string} phone - номер телефона (375291234567 или +375291234567)
 * @param {string} message - текст сообщения
 * @param {string} extraId - внешний идентификатор (необязательно)
 */
export async function sendSMS(phone, message, extraId = null) {
  try {
    // Нормализуем номер: оставляем только цифры
    const normalizedPhone = phone.replace(/\D/g, "");
    
    // SMS Rocket ожидает номер в формате +375XXXXXXXX
    const formattedPhone = normalizedPhone.startsWith("375") 
      ? `+${normalizedPhone}` 
      : phone;

    const result = await smsClient.sendSMS(formattedPhone, message);

    if (result && result.success) {
      console.log(`📲 SMS отправлено на ${formattedPhone}, ID: ${result.id || 'N/A'}`);
      return result;
    } else {
      console.error("SMS Rocket error:", result?.error || "Unknown error");
      return { success: false, error: result?.error || "Failed to send SMS" };
    }
  } catch (err) {
    console.error("Ошибка отправки SMS через SMS Rocket:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Проверка баланса SMS Rocket (полезно для мониторинга)
 */
export async function checkSMSBalance() {
  try {
    const balance = await smsClient.getBalance();
    console.log(`💰 SMS Rocket баланс: ${balance}`);
    return balance;
  } catch (err) {
    console.error("Ошибка получения баланса:", err.message);
    return null;
  }
}
