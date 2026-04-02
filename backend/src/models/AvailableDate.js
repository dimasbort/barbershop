import { DataTypes } from "sequelize";
import sequelize from "./index.js";
import Specialist from "./Specialist.js";

const AvailableDate = sequelize.define("AvailableDate", {
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  customStart: {
    // переопределение начала рабочего дня
    type: DataTypes.STRING,
    allowNull: true,
  },
  customEnd: {
    // переопределение конца рабочего дня
    type: DataTypes.STRING,
    allowNull: true,
  },
});

Specialist.hasMany(AvailableDate, {
  foreignKey: "SpecialistId",
  onDelete: "CASCADE",
});
AvailableDate.belongsTo(Specialist, { foreignKey: "SpecialistId" });

export default AvailableDate;
