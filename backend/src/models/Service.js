import { DataTypes } from "sequelize";
import sequelize from "./index.js";

const Service = sequelize.define("Service", {
  name: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
});

export default Service;
