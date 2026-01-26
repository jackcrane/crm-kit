import request from "supertest";
import { generate as generateOtp } from "otplib";
import { describe, expect, it } from "vitest";
import { createApplication, createUser } from "../../../../tests/helpers/db.js";
import { useIntegrationServer } from "./setupIntegration.js";

const serverState = useIntegrationServer();

describe("✅ Auth endpoints", () => {
  it("returns login metadata for an application", async () => {
    const application = await createApplication({
      cfTurnstileSiteKey: "site_key_123",
      enforceTurnstile: false,
      loginAvailable: true,
    });

    const response = await request(serverState.server.baseUrl)
      .get("/v1/auth")
      .set("x-application-id", application.id);

    expect(response.status).toBe(200);
    expect(response.body.types).toEqual([{ type: "password" }]);
    expect(response.body.loginAvailable).toBe(true);
    expect(response.body.requiresCaptcha).toBe(false);
    expect(response.body.siteKey).toBe("site_key_123");
  });

  it("rejects invalid login submissions", async () => {
    const application = await createApplication();

    const response = await request(serverState.server.baseUrl)
      .post("/v1/auth/login")
      .set("x-application-id", application.id)
      .send({
        email: "bad-email",
        password: "password",
      });

    expect(response.status).toBe(400);
    expect(response.body.reason).toBe("invalid_submission_format");
  });

  it("fails authentication with incorrect credentials", async () => {
    const application = await createApplication();
    const { user } = await createUser({
      applicationId: application.id,
      password: "CorrectPassword1!",
    });

    const response = await request(serverState.server.baseUrl)
      .post("/v1/auth/login")
      .set("x-application-id", application.id)
      .send({
        email: user.email,
        password: "WrongPassword!",
        type: "password",
        "cf-turnstile-response": "dummy-token",
      });

    expect(response.status).toBe(401);
    expect(response.body.reason).toBe("invalid_credentials");
  });

  it("returns a token for a valid password login", async () => {
    const application = await createApplication();
    const { user } = await createUser({
      applicationId: application.id,
      password: "CorrectPassword1!",
    });

    const response = await request(serverState.server.baseUrl)
      .post("/v1/auth/login")
      .set("x-application-id", application.id)
      .send({
        email: user.email,
        password: "CorrectPassword1!",
        type: "password",
        "cf-turnstile-response": "dummy-token",
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.token).toBeTruthy();
    expect(response.body.user).toMatchObject({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  });

  it("rejects login for a revoked user", async () => {
    const application = await createApplication();
    const { user } = await createUser({
      applicationId: application.id,
      password: "CorrectPassword1!",
      status: "revoked",
    });

    const response = await request(serverState.server.baseUrl)
      .post("/v1/auth/login")
      .set("x-application-id", application.id)
      .send({
        email: user.email,
        password: "CorrectPassword1!",
        type: "password",
        "cf-turnstile-response": "dummy-token",
      });

    expect(response.status).toBe(401);
    expect(response.body.reason).toBe("invalid_credentials");
  });

  it("issues an MFA challenge and completes it successfully", async () => {
    const application = await createApplication();
    const { user, otpSecret } = await createUser({
      applicationId: application.id,
      password: "CorrectPassword1!",
      mfaEnabled: true,
    });

    const loginResponse = await request(serverState.server.baseUrl)
      .post("/v1/auth/login")
      .set("x-application-id", application.id)
      .send({
        email: user.email,
        password: "CorrectPassword1!",
        type: "password",
        "cf-turnstile-response": "dummy-token",
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.status).toBe("challenge");
    expect(loginResponse.body.challenge.type).toBe("mfa");
    expect(loginResponse.body.challenge.nonce).toBeTruthy();

    const otp = await generateOtp({ secret: otpSecret });

    const challengeResponse = await request(serverState.server.baseUrl)
      .post("/v1/auth/challenge")
      .set("x-application-id", application.id)
      .send({
        nonce: loginResponse.body.challenge.nonce,
        response: otp,
      });

    expect(challengeResponse.status).toBe(200);
    expect(challengeResponse.body.status).toBe("success");
    expect(challengeResponse.body.token).toBeTruthy();
    expect(challengeResponse.body.user.email).toBe(user.email);
  });
});
