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
    sql`TRUNCATE TABLE "events", "users", "applications" RESTART IDENTITY CASCADE;`,
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

export async function closeDatabaseConnections() {
  await pool.end();
}
