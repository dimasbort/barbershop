import { DataTypes } from "sequelize";
import sequelize from "./index.js";
import Specialist from "./Specialist.js";
import Service from "./Service.js";

const SpecialistService = sequelize.define("SpecialistService", {
  price: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  duration_min: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

Specialist.belongsToMany(Service, {
  through: SpecialistService,
  foreignKey: "SpecialistId",
});
Service.belongsToMany(Specialist, {
  through: SpecialistService,
  foreignKey: "ServiceId",
});

export default SpecialistService;
