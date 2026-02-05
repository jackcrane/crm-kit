import request from "supertest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestApp } from "./helpers/createTestApp.js";
import { generateSync } from "otplib";

describe("Auth endpoints", () => {
  let context;

  beforeEach(() => {
    context = null;
  });

  afterEach(async () => {
    vi.clearAllMocks();
    if (context?.close) {
      await context.close();
    }
  });

  it("requires an application id header", async () => {
    context = await createTestApp();

    const res = await request(context.app).get("/v1/auth");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Missing application ID.");
  });

  it("returns auth settings for the application", async () => {
    context = await createTestApp();

    const res = await request(context.app)
      .get("/v1/auth")
      .set("x-application-id", context.application.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      loginAvailable: context.application.loginAvailable,
      requiresCaptcha: context.application.enforceTurnstile,
      siteKey: context.application.cfTurnstileSiteKey,
      types: [{ type: "password" }],
    });
  });

  it("logs in with valid credentials", async () => {
    context = await createTestApp();

    const res = await request(context.app)
      .post("/v1/auth/login")
      .set("x-application-id", context.application.id)
      .send({
        email: context.user.email,
        password: "password123",
        "cf-turnstile-response": "skip",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({
      id: context.user.id,
      name: context.user.name,
      email: context.user.email,
    });
    expect(context.validateTurnstileMock).not.toHaveBeenCalled();
  });

  it("rejects invalid credentials", async () => {
    context = await createTestApp();

    const res = await request(context.app)
      .post("/v1/auth/login")
      .set("x-application-id", context.application.id)
      .send({
        email: context.user.email,
        password: "wrong-password",
        "cf-turnstile-response": "skip",
      });

    expect(res.status).toBe(401);
    expect(res.body.reason).toBe("invalid_credentials");
  });

  it("rejects logins when the application has login disabled", async () => {
    context = await createTestApp({
      applicationOverrides: { loginAvailable: false },
    });

    const res = await request(context.app)
      .post("/v1/auth/login")
      .set("x-application-id", context.application.id)
      .send({
        email: context.user.email,
        password: "password123",
        "cf-turnstile-response": "skip",
      });

    expect(res.status).toBe(401);
    expect(res.body.reason).toBe("invalid_credentials");
  });

  it("validates turnstile when enforced", async () => {
    context = await createTestApp({ enforceTurnstile: true });

    const res = await request(context.app)
      .post("/v1/auth/login")
      .set("x-application-id", context.application.id)
      .send({
        email: context.user.email,
        password: "password123",
        "cf-turnstile-response": "token",
      });

    expect(res.status).toBe(200);
    expect(context.validateTurnstileMock).toHaveBeenCalledWith(
      context.application.cfTurnstileSecretKey,
      "token",
      expect.any(String),
    );
  });

  it("fails login when turnstile response is missing", async () => {
    context = await createTestApp({ enforceTurnstile: true });

    const res = await request(context.app)
      .post("/v1/auth/login")
      .set("x-application-id", context.application.id)
      .send({
        email: context.user.email,
        password: "password123",
      });

    expect(res.status).toBe(400);
    expect(res.body.reason).toBe("invalid_submission_format");
    expect(context.validateTurnstileMock).not.toHaveBeenCalled();
  });

  it("returns an MFA challenge and exchanges it for a token", async () => {
    context = await createTestApp({ mfaEnabled: true });

    const loginRes = await request(context.app)
      .post("/v1/auth/login")
      .set("x-application-id", context.application.id)
      .send({
        email: context.user.email,
        password: "password123",
        "cf-turnstile-response": "skip",
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.status).toBe("challenge");
    expect(loginRes.body.challenge.type).toBe("mfa");
    expect(loginRes.body.challenge.nonce).toBeTruthy();

    const otp = generateSync({ secret: context.user.otpSecret });

    const challengeRes = await request(context.app)
      .post("/v1/auth/challenge")
      .set("x-application-id", context.application.id)
      .send({
        nonce: loginRes.body.challenge.nonce,
        response: otp,
      });

    expect(challengeRes.status).toBe(200);
    expect(challengeRes.body.status).toBe("success");
    expect(challengeRes.body.token).toBeTruthy();
    expect(challengeRes.body.user.email).toBe(context.user.email);
  });

  it("rejects invalid MFA responses", async () => {
    context = await createTestApp({ mfaEnabled: true });

    const loginRes = await request(context.app)
      .post("/v1/auth/login")
      .set("x-application-id", context.application.id)
      .send({
        email: context.user.email,
        password: "password123",
        "cf-turnstile-response": "skip",
      });

    const badOtp = "000000";

    const challengeRes = await request(context.app)
      .post("/v1/auth/challenge")
      .set("x-application-id", context.application.id)
      .send({
        nonce: loginRes.body.challenge.nonce,
        response: badOtp,
      });

    expect(challengeRes.status).toBe(401);
    expect(challengeRes.body.reason).toBe("invalid_challenge_response");
  });
});
