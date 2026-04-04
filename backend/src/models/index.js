import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

const dialect = process.env.DB_DIALECT || "sqlite";

let sequelize;

if (dialect === "postgres") {
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 5432,
      dialect: "postgres",
      logging: false,
    }
  );
} else {
  // Фолбэк на SQLite для локальной разработки
  sequelize = new Sequelize({
    dialect: "sqlite",
    storage: "./src/db.sqlite",
    logging: false,
  });
}

export default sequelize;
