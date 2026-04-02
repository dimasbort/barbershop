import { DataTypes } from "sequelize";
import sequelize from "./index.js";

const Service = sequelize.define("Service", {
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING },
  category: { type: DataTypes.STRING },
});

export default Service;
