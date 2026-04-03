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

import specialistsRouter from "./routes/specialists.js";
import servicesRouter from "./routes/services.js";
import appointmentsRouter from "./routes/appointments.js";
import adminRouter from "./routes/admin.js";

import { initScheduler } from "./utils/scheduler.js";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/api/specialists", specialistsRouter);
app.use("/api/services", servicesRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/admin", adminRouter);

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Отдаём папку admin как статику
app.use("/admin", express.static(path.join(__dirname, "../admin")));

await sequelize.sync({ force: true });
console.log("DB ready");

initScheduler();

app.listen(4000, () => console.log("Backend: [localhost](http://localhost:4000)"));
