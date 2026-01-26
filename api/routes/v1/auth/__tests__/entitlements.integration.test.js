import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, it, beforeAll, beforeEach, afterAll, expect } from "vitest";
import { entitlements, checkEntitlements } from "../../../../util/entitlements.js";
import {
  createApplication,
  createUser,
  migrateDatabase,
  resetDatabase,
  closeDatabaseConnections,
} from "../../../../tests/helpers/db.js";

function makeToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

describe("Entitlements utilities", () => {
  beforeAll(async () => {
    await migrateDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await closeDatabaseConnections();
  });

  describe("checkEntitlements", () => {
    it("returns true when the user has all required entitlements", async () => {
      const application = await createApplication();
      const { user } = await createUser({
        applicationId: application.id,
        entitlements: ["users:read"],
      });

      const hasAccess = await checkEntitlements(user.id, [
        "users:read",
      ]);

      expect(hasAccess).toBe(true);
    });

    it("returns false when entitlements are missing", async () => {
      const application = await createApplication();
      const { user } = await createUser({
        applicationId: application.id,
        entitlements: [],
      });

      const hasAccess = await checkEntitlements(user.id, [
        "users:write",
      ]);

      expect(hasAccess).toBe(false);
    });

    it("allows superusers to bypass checks", async () => {
      const application = await createApplication();
      const { user } = await createUser({
        applicationId: application.id,
        entitlements: ["superuser"],
      });

      const hasAccess = await checkEntitlements(user.id, [
        "users:write",
        "invitations:read",
      ]);

      expect(hasAccess).toBe(true);
    });

    it("scopes entitlement checks to the application", async () => {
      const primaryApp = await createApplication();
      const otherApp = await createApplication();
      const { user } = await createUser({
        applicationId: primaryApp.id,
        entitlements: ["users:read"],
      });

      const hasAccess = await checkEntitlements(
        user.id,
        ["users:read"],
        otherApp.id,
      );

      expect(hasAccess).toBe(false);
    });
  });

  describe("entitlements middleware", () => {
    it("short-circuits with 401 when no token is provided", async () => {
      const application = await createApplication();
      const app = express();
      app.use((req, _res, next) => {
        req.applicationId = application.id;
        next();
      });
      app.get("/protected", entitlements(["users:read"]), (_req, res) =>
        res.json({ ok: true }),
      );

      const response = await request(app).get("/protected");

      expect(response.status).toBe(401);
      expect(response.body.reason).toBe("unauthorized");
    });

    it("returns 403 when required entitlements are missing", async () => {
      const application = await createApplication();
      const { user } = await createUser({
        applicationId: application.id,
        entitlements: [],
      });
      const token = makeToken(user.id);

      const app = express();
      app.use((req, _res, next) => {
        req.applicationId = application.id;
        next();
      });
      app.get("/protected", entitlements(["users:read"]), (_req, res) =>
        res.json({ ok: true }),
      );

      const response = await request(app)
        .get("/protected")
        .set("authorization", `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.reason).toBe("forbidden");
    });

    it("allows the request through and attaches the user when entitlements pass", async () => {
      const application = await createApplication();
      const { user } = await createUser({
        applicationId: application.id,
        entitlements: ["users:read"],
      });
      const token = makeToken(user.id);

      const app = express();
      app.use((req, _res, next) => {
        req.applicationId = application.id;
        next();
      });
      app.get("/protected", entitlements(["users:read"]), (req, res) =>
        res.json({ ok: true, user: req.user }),
      );

      const response = await request(app)
        .get("/protected")
        .set("authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.user.id).toBe(user.id);
      expect(response.body.user.entitlements).toEqual(["users:read"]);
      expect(response.body.user.password).toBeUndefined();
    });
  });
});
