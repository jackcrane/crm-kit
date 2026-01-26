import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  jsonb,
  text,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const entitlementEnum = pgEnum("entitlement", [
  "superuser",
  "users:read",
  "users:write",
  "invitations:read",
  "invitations:write",
  "entitlements:read",
  "entitlements:write",
]);

export const applicationsTable = pgTable("applications", {
  id: text()
    .primaryKey()
    .default(sql`'app_' || replace(gen_random_uuid()::text, '-', '')`),

  name: varchar({ length: 255 }).notNull(),
  jwtValidityTime: text().notNull().default("1h"),
  cfTurnstileSiteKey: varchar({ length: 255 }),
  cfTurnstileSecretKey: varchar({ length: 255 }),
  loginAvailable: boolean().notNull().default(true),
  enforceTurnstile: boolean().notNull().default(false),

  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const usersTable = pgTable("users", {
  id: text()
    .primaryKey()
    .default(sql`'usr_' || replace(gen_random_uuid()::text, '-', '')`),
  applicationId: text()
    .notNull()
    .references(() => applicationsTable.id, { onDelete: "cascade" }),

  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull(),
  password: varchar({ length: 255 }).notNull(),

  mfaEnabled: boolean().notNull().default(false),
  otpSecret: text(),
  entitlements: entitlementEnum("entitlements")
    .array()
    .notNull()
    .default(sql`'{}'::entitlement[]`),

  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const eventTypeEnum = pgEnum("event_type", [
  "USER_CREATED",
  "USER_LOGIN",
  "PASSWORD_CHANGED",
  "SYSTEM",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "rescinded",
]);

export const eventsTable = pgTable("events", {
  id: text()
    .primaryKey()
    .default(sql`'evt_' || replace(gen_random_uuid()::text, '-', '')`),
  userId: text()
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  applicationId: text()
    .notNull()
    .references(() => applicationsTable.id, { onDelete: "cascade" }),

  type: eventTypeEnum("type").notNull(),
  metadata: jsonb().notNull().default({}),

  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const invitationsTable = pgTable("invitations", {
  id: text()
    .primaryKey()
    .default(sql`'inv_' || replace(gen_random_uuid()::text, '-', '')`),
  applicationId: text()
    .notNull()
    .references(() => applicationsTable.id, { onDelete: "cascade" }),

  email: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }),
  entitlements: entitlementEnum("entitlements")
    .array()
    .notNull()
    .default(sql`'{}'::entitlement[]`),
  code: text().notNull().unique(),
  status: invitationStatusEnum("status").notNull().default("pending"),

  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
