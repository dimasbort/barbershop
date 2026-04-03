import { DataTypes } from "sequelize";
import sequelize from "./index.js";

const Service = sequelize.define("Service", {
  name: { type: DataTypes.STRING, allowNull: false }
});

export default Service;
