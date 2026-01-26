import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  createApplication,
  createUser,
  resetDatabase,
  testDb,
} from "../../../../tests/helpers/db.js";
import { usersTable } from "../../../../db/schema.js";
import { useIntegrationServer } from "../../auth/__tests__/setupIntegration.js";

const serverState = useIntegrationServer();

function makeToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

describe("✅ Entitlements endpoints", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("rejects listing entitlements without entitlements:read", async () => {
    const application = await createApplication();
    const { user } = await createUser({
      applicationId: application.id,
      entitlements: [],
    });
    const token = makeToken(user.id);

    const response = await request(serverState.server.baseUrl)
      .get("/v1/entitlements/list")
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id);

    expect(response.status).toBe(403);
  });

  it("lists entitlements for users with entitlements:read", async () => {
    const application = await createApplication();
    const { user } = await createUser({
      applicationId: application.id,
      entitlements: ["entitlements:read"],
    });
    const token = makeToken(user.id);

    const response = await request(serverState.server.baseUrl)
      .get("/v1/entitlements/list")
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.entitlements)).toBe(true);
    const names = response.body.entitlements.map((item) => item.name);
    expect(names).toContain("entitlements:read");
    expect(names).toContain("entitlements:write");
  });

  it("returns a user's own entitlements without entitlements:read", async () => {
    const application = await createApplication();
    const { user } = await createUser({
      applicationId: application.id,
      entitlements: ["users:read"],
    });
    const token = makeToken(user.id);

    const response = await request(serverState.server.baseUrl)
      .get(`/v1/entitlements/${user.id}`)
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(["users:read"]);
  });

  it("requires entitlements:read to view another user's entitlements", async () => {
    const application = await createApplication();
    const { user: caller } = await createUser({
      applicationId: application.id,
      entitlements: [],
    });
    const { user: target } = await createUser({
      applicationId: application.id,
      entitlements: ["users:write"],
    });
    const token = makeToken(caller.id);

    const forbidden = await request(serverState.server.baseUrl)
      .get(`/v1/entitlements/${target.id}`)
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id);
    expect(forbidden.status).toBe(403);

    const { user: reader } = await createUser({
      applicationId: application.id,
      entitlements: ["entitlements:read"],
    });
    const updatedToken = makeToken(reader.id);

    const allowed = await request(serverState.server.baseUrl)
      .get(`/v1/entitlements/${target.id}`)
      .set("authorization", `Bearer ${updatedToken}`)
      .set("x-application-id", application.id);
    expect(allowed.status).toBe(200);
    expect(allowed.body).toEqual(["users:write"]);
  });

  it("updates entitlements when caller has entitlements:write", async () => {
    const application = await createApplication();
    const { user: caller } = await createUser({
      applicationId: application.id,
      entitlements: ["entitlements:write"],
    });
    const { user: target } = await createUser({
      applicationId: application.id,
      entitlements: ["users:read"],
    });
    const token = makeToken(caller.id);

    const response = await request(serverState.server.baseUrl)
      .post(`/v1/entitlements/${target.id}`)
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id)
      .send([
        { entitlement: "users:write", action: "add" },
        { entitlement: "users:read", action: "remove" },
      ]);

    expect(response.status).toBe(200);
    expect(response.body.entitlements).toEqual(["users:write"]);

    const [stored] = await testDb
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, target.id));
    expect(stored.entitlements).toEqual(["users:write"]);
  });

  it("rejects updates with unknown entitlements", async () => {
    const application = await createApplication();
    const { user: caller } = await createUser({
      applicationId: application.id,
      entitlements: ["entitlements:write"],
    });
    const { user: target } = await createUser({
      applicationId: application.id,
    });
    const token = makeToken(caller.id);

    const response = await request(serverState.server.baseUrl)
      .post(`/v1/entitlements/${target.id}`)
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id)
      .send([{ entitlement: "unknown:perm", action: "add" }]);

    expect(response.status).toBe(400);
    expect(response.body.reason).toBe("invalid_entitlement");
  });
});
