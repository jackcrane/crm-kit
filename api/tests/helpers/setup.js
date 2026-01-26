import { afterAll, beforeAll } from "vitest";
import dotenv from "dotenv";
import {
  ensureTestDatabase,
  shutdownTestDatabase,
} from "./dockerDb.js";
import { migrateDatabase } from "./db.js";

dotenv.config();

const databaseReady = ensureTestDatabase();

beforeAll(async () => {
  await databaseReady;
  await migrateDatabase();
});

afterAll(async () => {
  await shutdownTestDatabase();
});

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-secret";
}
