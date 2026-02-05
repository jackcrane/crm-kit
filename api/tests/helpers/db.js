import { randomUUID } from "crypto";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import bcrypt from "bcrypt";
import pg from "pg";
import { generateSecret } from "otplib";
import path from "path";
import {
  applicationsTable,
  eventsTable,
  invitationsTable,
  usersTable,
  peopleTable,
  peopleEmailAddressesTable,
  peoplePhoneNumbersTable,
  peopleFieldsTable,
  peopleFieldValuesTable,
} from "../../db/schema.js";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const testDb = drizzle(pool);

let migrationPromise = null;

export async function ensureExtensions() {
  try {
    await testDb.execute(
      sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`,
    );
  } catch (err) {
    if (err?.code === "23505") {
      // Extension already exists from a parallel test
      return;
    }
    throw err;
  }
}

export async function migrateDatabase() {
  if (migrationPromise) {
    return migrationPromise;
  }

  migrationPromise = (async () => {
    await ensureExtensions();
    const migrationsFolder = path.join(process.cwd(), "drizzle");
    await migrate(testDb, { migrationsFolder });
  })();

  return migrationPromise;
}

export async function resetDatabase() {
  await testDb.execute(
    sql`TRUNCATE TABLE "people_email_addresses", "people_phone_numbers", "people_field_values", "people_fields", "people", "events", "users", "applications" RESTART IDENTITY CASCADE;`,
  );
}

export async function createApplication(overrides = {}) {
  const [application] = await testDb
    .insert(applicationsTable)
    .values({
      name: "Test Application",
      ...overrides,
    })
    .returning();

  return application;
}

export async function createUser({
  applicationId,
  password = "Password123!",
  email = `user-${randomUUID()}@example.com`,
  name = "Test User",
  mfaEnabled = false,
  otpSecret,
  entitlements = [],
  status = "active",
} = {}) {
  if (!applicationId) {
    throw new Error("applicationId is required to create a user");
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const secret = mfaEnabled ? otpSecret ?? generateSecret() : null;

  const [user] = await testDb
    .insert(usersTable)
    .values({
      applicationId,
      name,
      email,
      password: hashedPassword,
      mfaEnabled,
      otpSecret: secret,
      entitlements,
      status,
    })
    .returning();

  return { user, otpSecret: secret };
}

export async function recordUserCreatedEvent({ userId, applicationId }) {
  await testDb.insert(eventsTable).values({
    userId,
    applicationId,
    type: "USER_CREATED",
  });
}

export async function createInvitation({
  applicationId,
  email = `invitee-${randomUUID()}@example.com`,
  name = "Invited User",
  entitlements = [],
  status = "pending",
  code = randomUUID().replace(/-/g, ""),
  createdAt,
} = {}) {
  if (!applicationId) {
    throw new Error("applicationId is required to create an invitation");
  }

  const [invitation] = await testDb
    .insert(invitationsTable)
    .values({
      applicationId,
      email,
      name,
      entitlements,
      status,
      code,
      ...(createdAt ? { createdAt } : {}),
    })
    .returning();

  return invitation;
}

export async function createPerson({
  applicationId,
  name = "Test Person",
  ltv = null,
  emails = [],
  phones = [],
  fields = [],
} = {}) {
  if (!applicationId) {
    throw new Error("applicationId is required to create a person");
  }

  const [person] = await testDb
    .insert(peopleTable)
    .values({
      applicationId,
      name,
      ...(ltv !== null ? { ltv } : {}),
    })
    .returning();

  if (emails.length > 0) {
    await testDb.insert(peopleEmailAddressesTable).values(
      emails.map((email, idx) => ({
        personId: person.id,
        address: email.address,
        order: email.order ?? idx,
        notes: email.notes ?? { type: "plaintext", content: "" },
      })),
    );
  }

  if (phones.length > 0) {
    await testDb.insert(peoplePhoneNumbersTable).values(
      phones.map((phone, idx) => ({
        personId: person.id,
        number: phone.number,
        order: phone.order ?? idx,
        notes: phone.notes ?? { type: "plaintext", content: "" },
      })),
    );
  }

  if (fields.length > 0) {
    // ensure field definitions exist
    const fieldIds = new Map();
    for (const field of fields) {
      let fieldId = field.id;
      if (!fieldId) {
        const [created] = await testDb
          .insert(peopleFieldsTable)
          .values({
            applicationId,
            title: field.title ?? "Field",
            icon: field.icon,
            entitlements: field.entitlements ?? [],
          })
          .returning({ id: peopleFieldsTable.id });
        fieldId = created.id;
      }
      fieldIds.set(fieldId, field);
      await testDb.insert(peopleFieldValuesTable).values({
        personId: person.id,
        fieldId,
        value: field.value ?? null,
      });
    }
  }

  return person;
}

export async function closeDatabaseConnections() {
  await pool.end();
}
