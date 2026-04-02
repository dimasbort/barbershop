import { DataTypes } from "sequelize";
import sequelize from "./index.js";

const Admin = sequelize.define("Admin", {
  username: { type: DataTypes.STRING, unique: true },
  password_hash: { type: DataTypes.STRING, allowNull: false },
});

export default Admin;
