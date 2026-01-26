import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  createApplication,
  createInvitation,
  createUser,
  resetDatabase,
  testDb,
} from "../../../../../tests/helpers/db.js";
import { invitationsTable, usersTable } from "../../../../../db/schema.js";
import { useIntegrationServer } from "../../../auth/__tests__/setupIntegration.js";

const serverState = useIntegrationServer();

function makeToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

describe("✅ Invitations endpoints", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("rejects invite creation without authorization", async () => {
    const application = await createApplication();

    const response = await request(serverState.server.baseUrl)
      .post("/v1/users/invitations")
      .set("x-application-id", application.id)
      .send({ email: "new@example.com" });

    expect(response.status).toBe(401);
  });

  it("rejects invite creation when caller lacks entitlements", async () => {
    const application = await createApplication();
    const { user } = await createUser({ applicationId: application.id });
    const token = makeToken(user.id);

    const response = await request(serverState.server.baseUrl)
      .post("/v1/users/invitations")
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id)
      .send({ email: "new@example.com" });

    expect(response.status).toBe(403);
  });

  it("creates invitations when caller has write entitlements", async () => {
    const application = await createApplication();
    const { user } = await createUser({
      applicationId: application.id,
      entitlements: ["invitations:write"],
    });
    const token = makeToken(user.id);

    const response = await request(serverState.server.baseUrl)
      .post("/v1/users/invitations")
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id)
      .send({
        email: "new@example.com",
        name: "New User",
        entitlements: ["users:read"],
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("success");
    expect(response.body.invitations).toHaveLength(1);

    const created = response.body.invitations[0];
    expect(created.email).toBe("new@example.com");
    expect(created.status).toBe("pending");
    expect(created.code).toBeTruthy();

    const [stored] = await testDb
      .select()
      .from(invitationsTable)
      .where(eq(invitationsTable.id, created.id));
    expect(stored.entitlements).toEqual(["users:read"]);
  });

  it("lists invitations when caller has read entitlements", async () => {
    const application = await createApplication();
    await createInvitation({ applicationId: application.id });
    await createInvitation({ applicationId: application.id });

    const { user } = await createUser({
      applicationId: application.id,
      entitlements: ["invitations:read"],
    });
    const token = makeToken(user.id);

    const response = await request(serverState.server.baseUrl)
      .get("/v1/users/invitations")
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id);

    expect(response.status).toBe(200);
    expect(response.body.invitations.length).toBe(2);
    expect(response.body.total).toBe(2);
  });

  it("retrieves an invitation by code without auth", async () => {
    const application = await createApplication();
    const invitation = await createInvitation({
      applicationId: application.id,
    });

    const response = await request(serverState.server.baseUrl)
      .get(`/v1/users/invitations/${invitation.code}`)
      .set("x-application-id", application.id);

    expect(response.status).toBe(200);
    expect(response.body.invitation.id).toBe(invitation.id);
    expect(response.body.invitation.status).toBe("pending");
    expect(response.body.application.requiresCaptcha).toBe(false);
  });

  it("accepts an invitation and creates a user", async () => {
    const application = await createApplication();
    const invitation = await createInvitation({
      applicationId: application.id,
      entitlements: ["users:read"],
    });

    const response = await request(serverState.server.baseUrl)
      .post(`/v1/users/invitations/${invitation.id}/accept`)
      .set("x-application-id", application.id)
      .send({ password: "Password123!" });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.userPermissions).toEqual(["users:read"]);

    const [updatedInvitation] = await testDb
      .select()
      .from(invitationsTable)
      .where(eq(invitationsTable.id, invitation.id));
    expect(updatedInvitation.status).toBe("accepted");

    const [newUser] = await testDb
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, invitation.email));
    expect(newUser).toBeTruthy();
  });

  it("expires invitations older than 24 hours when retrieved", async () => {
    const application = await createApplication();
    const invitation = await createInvitation({
      applicationId: application.id,
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });

    const response = await request(serverState.server.baseUrl)
      .get(`/v1/users/invitations/${invitation.id}`)
      .set("x-application-id", application.id);

    expect(response.status).toBe(200);
    expect(response.body.invitation.status).toBe("expired");

    const [updated] = await testDb
      .select()
      .from(invitationsTable)
      .where(eq(invitationsTable.id, invitation.id));
    expect(updated.status).toBe("expired");
  });

  it("rejects accepting an expired invitation", async () => {
    const application = await createApplication();
    const invitation = await createInvitation({
      applicationId: application.id,
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });

    const response = await request(serverState.server.baseUrl)
      .post(`/v1/users/invitations/${invitation.id}/accept`)
      .set("x-application-id", application.id)
      .send({ password: "Password123!" });

    expect(response.status).toBe(400);
    expect(response.body.reason).toBe("invitation_expired");
  });

  it("re-inviting after rescind overwrites existing invitation", async () => {
    const application = await createApplication();
    const rescinded = await createInvitation({
      applicationId: application.id,
      email: "invited@example.com",
      status: "rescinded",
      code: "oldcode",
    });

    const { user } = await createUser({
      applicationId: application.id,
      entitlements: ["invitations:write"],
    });
    const token = makeToken(user.id);

    const response = await request(serverState.server.baseUrl)
      .post("/v1/users/invitations")
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id)
      .send({
        email: "invited@example.com",
        name: "Reinvited User",
        entitlements: ["users:read"],
      });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe("success");
    expect(response.body.invitations).toHaveLength(1);

    const updated = response.body.invitations[0];
    expect(updated.id).toBe(rescinded.id);
    expect(updated.status).toBe("pending");

    const [stored] = await testDb
      .select()
      .from(invitationsTable)
      .where(eq(invitationsTable.id, rescinded.id));

    expect(stored.entitlements).toEqual(["users:read"]);
    expect(stored.status).toBe("pending");
    expect(stored.code).not.toBe("oldcode");
  });

  it("rescinds a pending invitation when caller has write entitlements", async () => {
    const application = await createApplication();
    const invitation = await createInvitation({
      applicationId: application.id,
    });

    const { user } = await createUser({
      applicationId: application.id,
      entitlements: ["invitations:write"],
    });
    const token = makeToken(user.id);

    const response = await request(serverState.server.baseUrl)
      .delete(`/v1/users/invitations/${invitation.id}`)
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");

    const [updated] = await testDb
      .select()
      .from(invitationsTable)
      .where(eq(invitationsTable.id, invitation.id));

    expect(updated.status).toBe("rescinded");
  });

  it("rejects rescinding a non-pending invitation", async () => {
    const application = await createApplication();
    const invitation = await createInvitation({
      applicationId: application.id,
      status: "accepted",
    });

    const { user } = await createUser({
      applicationId: application.id,
      entitlements: ["invitations:write"],
    });
    const token = makeToken(user.id);

    const response = await request(serverState.server.baseUrl)
      .delete(`/v1/users/invitations/${invitation.id}`)
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id);

    expect(response.status).toBe(400);
    expect(response.body.reason).toBe("invitation_not_pending");
  });

  it("rejects rescinding without entitlements", async () => {
    const application = await createApplication();
    const invitation = await createInvitation({
      applicationId: application.id,
    });

    const { user } = await createUser({
      applicationId: application.id,
    });
    const token = makeToken(user.id);

    const response = await request(serverState.server.baseUrl)
      .delete(`/v1/users/invitations/${invitation.id}`)
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id);

    expect(response.status).toBe(403);
  });

  it("returns 404 when rescinding an unknown invitation", async () => {
    const application = await createApplication();

    const { user } = await createUser({
      applicationId: application.id,
      entitlements: ["invitations:write"],
    });
    const token = makeToken(user.id);

    const response = await request(serverState.server.baseUrl)
      .delete(`/v1/users/invitations/does-not-exist`)
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id);

    expect(response.status).toBe(404);
    expect(response.body.reason).toBe("invitation_not_found");
  });
});
