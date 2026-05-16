import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import sequelize from "./models/index.js";

// Порядок импорта важен — сначала базовые модели
import "./models/Admin.js";
import "./models/Specialist.js";
import "./models/Service.js";
import "./models/Appointment.js";
import "./models/AvailableDate.js";
import "./models/SpecialistService.js";
import "./models/Client.js";
import "./models/PasswordResetCode.js";

import specialistsRouter from "./routes/specialists.js";
import servicesRouter from "./routes/services.js";
import appointmentsRouter from "./routes/appointments.js";
import adminRouter from "./routes/admin.js";
import clientRouter from "./routes/client.js";

import { initScheduler } from "./utils/scheduler.js";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "8mb" }));

app.use("/api/specialists", specialistsRouter);
app.use("/api/services", servicesRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/client", clientRouter);

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
// Отдаём папку admin как статику
app.use("/admin", express.static(path.join(__dirname, "../admin")));

app.get("/admin/{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "../admin/index.html"));
});

export { app };

export async function startServer(port = process.env.PORT || 4000) {
  const shouldAlterDb = process.env.DB_SYNC_ALTER !== "false";
  await sequelize.sync({ alter: shouldAlterDb });
  console.log("DB ready");

  initScheduler();

  return app.listen(port, () => console.log(`Backend: http://localhost:${port}`));
}

if (process.env.NODE_ENV !== "test") {
  await startServer();
}
