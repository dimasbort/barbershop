import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// тестовый маршрут
app.get("/api/ping", (req, res) => {
  res.json({ message: "pong" });
});

const PORT = 4000;
import sequelize from "./models/index.js";
import "./models/Specialist.js";
import "./models/Service.js";
import "./models/Appointment.js";
import "./models/Admin.js";

await sequelize.sync({ force: true });
console.log("Database recreated from models");

import dotenv from "dotenv";
dotenv.config();

import { initScheduler } from "./utils/scheduler.js";
initScheduler();


import specialistsRouter from "./routes/specialists.js";
import servicesRouter from "./routes/services.js";
import appointmentsRouter from "./routes/appointments.js";
import adminRouter from "./routes/admin.js";

app.use("/api/specialists", specialistsRouter);
app.use("/api/services", servicesRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/admin", adminRouter);
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
