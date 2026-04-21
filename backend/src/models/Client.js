import { DataTypes } from "sequelize";
import sequelize from "./index.js";

const Client = sequelize.define("Client", {
  phone: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  gdpr_consent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

export default Client;
