import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
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
  it("revokes a user and prevents further logins", async () => {
    await resetDatabase();
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
});
