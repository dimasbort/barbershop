import { DataTypes } from "sequelize";
import sequelize from "./index.js";

const Specialist = sequelize.define("Specialist", {
  name: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  photo: DataTypes.STRING,
  schedule: DataTypes.JSON, // пример: {"mon":["09:00-18:00"], ...}
});

export default Specialist;
