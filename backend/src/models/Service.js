import { DataTypes } from "sequelize";
import sequelize from "./index.js";
import Specialist from "./Specialist.js";

const Service = sequelize.define("Service", {
  name: { type: DataTypes.STRING, allowNull: false },
  duration_min: DataTypes.INTEGER,
  price: DataTypes.INTEGER,
});

Specialist.hasMany(Service, { onDelete: "CASCADE" });
Service.belongsTo(Specialist);

export default Service;
