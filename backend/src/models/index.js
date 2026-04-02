import { Sequelize } from "sequelize";

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./src/db.sqlite",
  logging: false
});

export default sequelize;
