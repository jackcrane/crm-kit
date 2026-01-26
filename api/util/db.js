import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool);
