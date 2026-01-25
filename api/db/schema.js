import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  jsonb,
  text,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const usersTable = pgTable("users", {
  id: text()
    .primaryKey()
    .default(sql`'usr_' || replace(gen_random_uuid()::text, '-', '')`),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull(),
  password: varchar({ length: 255 }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const eventTypeEnum = pgEnum("event_type", [
  "USER_CREATED",
  "USER_LOGIN",
  "PASSWORD_CHANGED",
  "SYSTEM",
]);

export const eventsTable = pgTable("events", {
  id: text()
    .primaryKey()
    .default(sql`'evt_' || replace(gen_random_uuid()::text, '-', '')`),
  userId: text()
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  type: eventTypeEnum("type").notNull(),
  metadata: jsonb().notNull().default({}),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
