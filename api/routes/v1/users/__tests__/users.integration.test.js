import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, beforeEach } from "vitest";
import {
  createApplication,
  createUser,
  resetDatabase,
  testDb,
} from "../../../../tests/helpers/db.js";
import { usersTable } from "../../../../db/schema.js";
import { useIntegrationServer } from "../../auth/__tests__/setupIntegration.js";
import { eq } from "drizzle-orm";

const serverState = useIntegrationServer();

function makeToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

describe("✅ Users endpoints", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("revokes a user and prevents further logins", async () => {
    const application = await createApplication();
    const { user: admin } = await createUser({
      applicationId: application.id,
      entitlements: ["users:write"],
      password: "AdminPass123!",
    });
    const { user: target } = await createUser({
      applicationId: application.id,
      password: "TargetPass123!",
    });

    const adminToken = makeToken(admin.id);

    const revokeResponse = await request(serverState.server.baseUrl)
      .delete(`/v1/users/${target.id}`)
      .set("authorization", `Bearer ${adminToken}`)
      .set("x-application-id", application.id);

    expect(revokeResponse.status).toBe(200);
    expect(revokeResponse.body.status).toBe("success");

    const [stored] = await testDb
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, target.id));
    expect(stored.status).toBe("revoked");

    const loginResponse = await request(serverState.server.baseUrl)
      .post("/v1/auth/login")
      .set("x-application-id", application.id)
      .send({
        email: target.email,
        password: "TargetPass123!",
        type: "password",
        "cf-turnstile-response": "dummy-token",
      });

    expect(loginResponse.status).toBe(401);
    expect(loginResponse.body.reason).toBe("invalid_credentials");
  });

  it("lists users with pagination defaults", async () => {
    const application = await createApplication();
    await createUser({ applicationId: application.id, email: "one@example.com" });
    await createUser({ applicationId: application.id, email: "two@example.com" });

    const { user: reader } = await createUser({
      applicationId: application.id,
      entitlements: ["users:read"],
    });
    const readerToken = makeToken(reader.id);

    const response = await request(serverState.server.baseUrl)
      .get("/v1/users")
      .set("authorization", `Bearer ${readerToken}`)
      .set("x-application-id", application.id);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(3); // includes reader
    expect(response.body.users).toHaveLength(3);
    expect(response.body.page).toBe(1);
    expect(response.body.limit).toBe(10);
  });

  it("filters users with search across default fields", async () => {
    const application = await createApplication();
    await createUser({ applicationId: application.id, email: "keep@example.com" });
    await createUser({
      applicationId: application.id,
      email: "match@example.com",
      name: "Target User",
    });

    const { user: reader } = await createUser({
      applicationId: application.id,
      entitlements: ["users:read"],
    });
    const readerToken = makeToken(reader.id);

    const response = await request(serverState.server.baseUrl)
      .get("/v1/users")
      .set("authorization", `Bearer ${readerToken}`)
      .set("x-application-id", application.id)
      .query({ search: "match" });

    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(1);
    expect(response.body.users[0].email).toBe("match@example.com");
    expect(response.body.total).toBe(1);
  });

  it("returns a single user by id", async () => {
    const application = await createApplication();
    const { user: target } = await createUser({
      applicationId: application.id,
      email: "single@example.com",
      name: "Single User",
    });
    const { user: reader } = await createUser({
      applicationId: application.id,
      entitlements: ["users:read"],
    });
    const readerToken = makeToken(reader.id);

    const response = await request(serverState.server.baseUrl)
      .get(`/v1/users/${target.id}`)
      .set("authorization", `Bearer ${readerToken}`)
      .set("x-application-id", application.id);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      id: target.id,
      email: "single@example.com",
      name: "Single User",
      status: "active",
    });
    expect(response.body.user.createdAt).toBeTruthy();
    expect(response.body.user.updatedAt).toBeTruthy();
  });

  it("respects searchFields when filtering users", async () => {
    const application = await createApplication();
    await createUser({
      applicationId: application.id,
      email: "focus@example.com",
      name: "Special Name",
    });
    await createUser({
      applicationId: application.id,
      email: "special@example.com",
      name: "Other Name",
    });

    const { user: reader } = await createUser({
      applicationId: application.id,
      entitlements: ["users:read"],
    });
    const readerToken = makeToken(reader.id);

    const response = await request(serverState.server.baseUrl)
      .get("/v1/users")
      .set("authorization", `Bearer ${readerToken}`)
      .set("x-application-id", application.id)
      .query({ search: "special", searchFields: "name" });

    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(1);
    expect(response.body.users[0].name).toBe("Special Name");
    expect(response.body.total).toBe(1);
  });

  it("filters users with searchDsl", async () => {
    const application = await createApplication();
    await createUser({
      applicationId: application.id,
      email: "match@example.com",
      name: "DSL Match",
      status: "active",
    });
    await createUser({
      applicationId: application.id,
      email: "other@example.com",
      name: "Other User",
      status: "active",
    });

    const { user: reader } = await createUser({
      applicationId: application.id,
      entitlements: ["users:read"],
    });
    const readerToken = makeToken(reader.id);

    const searchDsl = {
      AND: [
        { email: { EQ: "match@example.com" } },
        { status: { EQ: "active" } },
      ],
    };

    const response = await request(serverState.server.baseUrl)
      .get("/v1/users")
      .set("authorization", `Bearer ${readerToken}`)
      .set("x-application-id", application.id)
      .query({ searchDsl: JSON.stringify(searchDsl) });

    expect(response.status).toBe(200);
    expect(response.body.users).toHaveLength(1);
    expect(response.body.users[0].email).toBe("match@example.com");
    expect(response.body.total).toBe(1);
  });
});
