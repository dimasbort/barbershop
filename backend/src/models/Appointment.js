import { DataTypes } from "sequelize";
import sequelize from "./index.js";
import Specialist from "./Specialist.js";
import Service from "./Service.js";
import Client from "./Client.js";

const Appointment = sequelize.define("Appointment", {
  client_name: { type: DataTypes.STRING, allowNull: false },
  client_phone: { type: DataTypes.STRING, allowNull: false },
  datetime_start: { type: DataTypes.DATE, allowNull: false },
  datetime_end: { type: DataTypes.DATE, allowNull: false },
  confirmed: { type: DataTypes.BOOLEAN, defaultValue: true },
  notified: { type: DataTypes.BOOLEAN, defaultValue: false }
});

Specialist.hasMany(Appointment, { foreignKey: "specialistId", onDelete: "CASCADE" });
Appointment.belongsTo(Specialist, { foreignKey: "specialistId" });
Service.hasMany(Appointment, { foreignKey: "serviceId", onDelete: "CASCADE" });
Appointment.belongsTo(Service, { foreignKey: "serviceId" });
Client.hasMany(Appointment, { foreignKey: "clientId", onDelete: "CASCADE" });
Appointment.belongsTo(Client, { foreignKey: "clientId" });

export default Appointment;
