import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

const requiredEnv = ["DB_NAME", "DB_USER", "DB_PASS"];
const missingEnv = requiredEnv.filter(name => !process.env[name]);

if (missingEnv.length > 0) {
  throw new Error(`Missing PostgreSQL environment variables: ${missingEnv.join(", ")}`);
}

const sequelize = new Sequelize(
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

export default sequelize;
