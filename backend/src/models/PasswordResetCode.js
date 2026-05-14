import { DataTypes } from "sequelize";
import sequelize from "./index.js";
import Client from "./Client.js";

const PasswordResetCode = sequelize.define("PasswordResetCode", {
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  code_hash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  used_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

Client.hasMany(PasswordResetCode, {
  foreignKey: "clientId",
  onDelete: "CASCADE",
});
PasswordResetCode.belongsTo(Client, { foreignKey: "clientId" });

export default PasswordResetCode;
