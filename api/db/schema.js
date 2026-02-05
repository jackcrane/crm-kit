import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  jsonb,
  text,
  boolean,
  integer,
  numeric,
  primaryKey,
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
  "people:read",
  "people.financial:read",
  "people.contact:read",
]);

export const userStatusEnum = pgEnum("user_status", ["active", "revoked"]);

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

  status: userStatusEnum("status").notNull().default("active"),

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
  "expired",
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

export const peopleTable = pgTable("people", {
  id: text()
    .primaryKey()
    .default(sql`'psn_' || replace(gen_random_uuid()::text, '-', '')`),
  applicationId: text()
    .notNull()
    .references(() => applicationsTable.id, { onDelete: "cascade" }),

  name: varchar({ length: 255 }).notNull(),
  ltv: numeric({ precision: 12, scale: 2 }),

  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const peopleFieldsTable = pgTable("people_fields", {
  id: text()
    .primaryKey()
    .default(sql`'fld_' || replace(gen_random_uuid()::text, '-', '')`),
  applicationId: text()
    .notNull()
    .references(() => applicationsTable.id, { onDelete: "cascade" }),

  title: varchar({ length: 255 }).notNull(),
  icon: varchar({ length: 255 }),
  entitlements: entitlementEnum("entitlements")
    .array()
    .notNull()
    .default(sql`'{}'::entitlement[]`),

  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const peopleFieldValuesTable = pgTable(
  "people_field_values",
  {
    personId: text()
      .notNull()
      .references(() => peopleTable.id, { onDelete: "cascade" }),
    fieldId: text()
      .notNull()
      .references(() => peopleFieldsTable.id, { onDelete: "cascade" }),
    value: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.personId, table.fieldId] }),
  }),
);

export const peopleEmailAddressesTable = pgTable("people_email_addresses", {
  id: text()
    .primaryKey()
    .default(sql`'pem_' || replace(gen_random_uuid()::text, '-', '')`),
  personId: text()
    .notNull()
    .references(() => peopleTable.id, { onDelete: "cascade" }),

  address: varchar({ length: 320 }).notNull(),
  order: integer().notNull().default(0),
  notes: jsonb().notNull().default(sql`'{}'::jsonb`),

  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const peoplePhoneNumbersTable = pgTable("people_phone_numbers", {
  id: text()
    .primaryKey()
    .default(sql`'phn_' || replace(gen_random_uuid()::text, '-', '')`),
  personId: text()
    .notNull()
    .references(() => peopleTable.id, { onDelete: "cascade" }),

  number: varchar({ length: 64 }).notNull(),
  order: integer().notNull().default(0),
  notes: jsonb().notNull().default(sql`'{}'::jsonb`),

  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
