import { applicationsTable, usersTable } from "../../db/schema.js";
import bcrypt from "bcrypt";
import { generateSecret } from "otplib";
import { vi } from "vitest";

function getTableName(table) {
  if (!table) return undefined;
  const symbols = Object.getOwnPropertySymbols(table);
  for (const sym of symbols) {
    const value = table[sym];
    if (typeof value === "string" && value.includes("application")) {
      return "applications";
    }
    if (typeof value === "string" && value.includes("users")) {
      return "users";
    }
  }
  return undefined;
}

function matchesCondition(row, condition) {
  if (!condition) return true;
  if (condition.type === "eq") {
    return row[condition.column] === condition.value;
  }
  if (condition.type === "and") {
    return condition.conditions.every((child) => matchesCondition(row, child));
  }
  return true;
}

function createMockDb(initialData) {
  const data = initialData;

  const getCollection = (table) => {
    const tableName = getTableName(table);
    if (table === applicationsTable || tableName === "applications") {
      return data.applications;
    }
    if (table === usersTable || tableName === "users") {
      return data.users;
    }
    throw new Error("Unknown table");
  };

  return {
    insert(table) {
      return {
        values: (records) => {
          const collection = getCollection(table);
          const items = Array.isArray(records) ? records : [records];
          collection.push(...items);
          return Promise.resolve();
        },
      };
    },
    select() {
      return {
        from: (table) => ({
          where: async (condition) => {
            const collection = getCollection(table);
            const filtered = collection.filter((row) =>
              matchesCondition(row, condition),
            );

            if (table === applicationsTable || getTableName(table) === "applications") {
              return filtered.map((row) => ({
                ...row,
                loginEnabled:
                  row.loginEnabled ??
                  row.loginAvailable ??
                  true,
              }));
            }

            return filtered;
          },
        }),
      };
    },
  };
}

export async function createTestApp({
  enforceTurnstile = false,
  mfaEnabled = false,
  applicationOverrides = {},
  userOverrides = {},
} = {}) {
  vi.resetModules();

  const baseApplication = {
    id: "app_test",
    name: "Test App",
    jwtValidityTime: "1h",
    cfTurnstileSiteKey: "site-key",
    cfTurnstileSecretKey: "turnstile-secret",
    loginAvailable: true,
    enforceTurnstile,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const application = {
    ...baseApplication,
    ...applicationOverrides,
    enforceTurnstile:
      applicationOverrides.enforceTurnstile ?? baseApplication.enforceTurnstile,
  };

  const baseUser = {
    id: "usr_test",
    applicationId: application.id,
    name: "Test User",
    email: "user@example.com",
    password: bcrypt.hashSync("password123", 10),
    mfaEnabled,
    otpSecret: mfaEnabled ? generateSecret() : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const user = {
    ...baseUser,
    ...userOverrides,
    mfaEnabled: userOverrides.mfaEnabled ?? baseUser.mfaEnabled,
  };

  const db = createMockDb({
    applications: [application],
    users: [user],
  });

  const validateTurnstileMock = vi.fn().mockResolvedValue(true);

  vi.doMock("drizzle-orm", async () => {
    const actual = await vi.importActual("drizzle-orm");
    return {
      ...actual,
      eq: (column, value) => ({
        type: "eq",
        column: column.name,
        value,
      }),
      and: (...conditions) => ({
        type: "and",
        conditions,
      }),
    };
  });

  vi.doMock("../../util/validateTurnstile.js", () => ({
    validateTurnstile: validateTurnstileMock,
  }));

  vi.doMock("../../util/db.js", () => ({ db }));

  const { buildApp } = await import("../../app.js");
  const app = await buildApp();

  return {
    app,
    db,
    application,
    user,
    validateTurnstileMock,
    close: () => Promise.resolve(),
  };
}
