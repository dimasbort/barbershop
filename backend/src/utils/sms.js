import axios from "axios";

export async function sendSMS(phone, message) {
  const apiToken = process.env.SMS_BY_API_TOKEN;
  const sender = process.env.SMS_BY_SENDER;

  // sms.by принимает без плюса в номере
  const normalizedPhone = phone.replace("+", "").trim();

  try {
    const res = await axios.post(
      "https://app.sms.by/api/v1/sendQuickSMS",
      new URLSearchParams({
        token: apiToken,
        message: message,
        phone: normalizedPhone,
        sender: sender,
      })
    );

    if (res.data.status !== "OK") {
      console.error("SMS.BY API error:", res.data);
    } else {
      console.log(`📲 SMS отправлено на ${phone}`);
    }
  } catch (err) {
    console.error("Ошибка отправки SMS:", err?.message);
  }
}
