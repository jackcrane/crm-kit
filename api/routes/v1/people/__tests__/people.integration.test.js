import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, beforeEach } from "vitest";
import {
  createApplication,
  createUser,
  createPerson,
  resetDatabase,
} from "../../../../tests/helpers/db.js";
import { useIntegrationServer } from "../../auth/__tests__/setupIntegration.js";

const serverState = useIntegrationServer();

function makeToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

describe("✅ People endpoints", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("requires people:read entitlement", async () => {
    const application = await createApplication();
    const { user } = await createUser({ applicationId: application.id });
    const token = makeToken(user.id);

    const response = await request(serverState.server.baseUrl)
      .get("/v1/people")
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id);

    expect(response.status).toBe(403);
  });

  it("lists people with pagination defaults", async () => {
    const application = await createApplication();
    await createPerson({ applicationId: application.id, name: "Alpha" });
    await createPerson({ applicationId: application.id, name: "Beta" });

    const { user } = await createUser({
      applicationId: application.id,
      entitlements: ["people:read"],
    });
    const token = makeToken(user.id);

    const response = await request(serverState.server.baseUrl)
      .get("/v1/people")
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(response.body.people).toHaveLength(2);
    expect(response.body.page).toBe(1);
    expect(response.body.limit).toBe(10);
  });

  it("hides contact info without people.contact:read", async () => {
    const application = await createApplication();
    const person = await createPerson({
      applicationId: application.id,
      name: "Contact Limited",
      emails: [{ address: "hidden@example.com" }],
      phones: [{ number: "5551231234" }],
    });

    const { user } = await createUser({
      applicationId: application.id,
      entitlements: ["people:read"],
    });
    const token = makeToken(user.id);

    const response = await request(serverState.server.baseUrl)
      .get(`/v1/people/${person.id}`)
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id);

    expect(response.status).toBe(200);
    expect(response.body.person.emailAddresses).toBeUndefined();
    expect(response.body.person.phoneNumbers).toBeUndefined();
  });

  it("returns contact info when people.contact:read is granted", async () => {
    const application = await createApplication();
    const person = await createPerson({
      applicationId: application.id,
      name: "Contact Visible",
      emails: [{ address: "see@example.com" }],
      phones: [{ number: "5550001111" }],
    });

    const { user } = await createUser({
      applicationId: application.id,
      entitlements: ["people:read", "people.contact:read"],
    });
    const token = makeToken(user.id);

    const response = await request(serverState.server.baseUrl)
      .get(`/v1/people/${person.id}`)
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id);

    expect(response.status).toBe(200);
    expect(response.body.person.emailAddresses).toHaveLength(1);
    expect(response.body.person.emailAddresses[0].address).toBe(
      "see@example.com",
    );
    expect(response.body.person.phoneNumbers[0].number).toBe("5550001111");
  });

  it("respects financial entitlement for ltv", async () => {
    const application = await createApplication();
    const person = await createPerson({
      applicationId: application.id,
      name: "Value Person",
      ltv: 123.45,
    });

    const { user: noFinance } = await createUser({
      applicationId: application.id,
      entitlements: ["people:read"],
    });
    const tokenNoFinance = makeToken(noFinance.id);

    const respNoFinance = await request(serverState.server.baseUrl)
      .get(`/v1/people/${person.id}`)
      .set("authorization", `Bearer ${tokenNoFinance}`)
      .set("x-application-id", application.id);

    expect(respNoFinance.status).toBe(200);
    expect(respNoFinance.body.person.ltv).toBeUndefined();

    const { user: withFinance } = await createUser({
      applicationId: application.id,
      entitlements: ["people:read", "people.financial:read"],
    });
    const tokenFinance = makeToken(withFinance.id);

    const respFinance = await request(serverState.server.baseUrl)
      .get(`/v1/people/${person.id}`)
      .set("authorization", `Bearer ${tokenFinance}`)
      .set("x-application-id", application.id);

    expect(respFinance.status).toBe(200);
    expect(respFinance.body.person.ltv).toBeCloseTo(123.45);
  });

  it("returns custom fields gated by entitlements", async () => {
    const application = await createApplication();
    const secureField = {
      title: "Private Note",
      entitlements: ["people.financial:read"],
      value: "secret",
    };
    const person = await createPerson({
      applicationId: application.id,
      fields: [secureField],
    });

    const { user: reader } = await createUser({
      applicationId: application.id,
      entitlements: ["people:read"],
    });
    const tokenReader = makeToken(reader.id);

    const respReader = await request(serverState.server.baseUrl)
      .get(`/v1/people/${person.id}`)
      .set("authorization", `Bearer ${tokenReader}`)
      .set("x-application-id", application.id);

    expect(respReader.status).toBe(200);
    expect(respReader.body.person.fields[0].value).toBeNull();
    expect(respReader.body.person.fields[0].userCanRead).toBe(false);

    const { user: privileged } = await createUser({
      applicationId: application.id,
      entitlements: ["people:read", "people.financial:read"],
    });
    const tokenPriv = makeToken(privileged.id);

    const respPriv = await request(serverState.server.baseUrl)
      .get(`/v1/people/${person.id}`)
      .set("authorization", `Bearer ${tokenPriv}`)
      .set("x-application-id", application.id);

    expect(respPriv.status).toBe(200);
    expect(respPriv.body.person.fields[0].value).toBe("secret");
    expect(respPriv.body.person.fields[0].userCanRead).toBe(true);
  });

  it("filters people by basic search over name when contact entitlements are missing", async () => {
    const application = await createApplication();
    await createPerson({
      applicationId: application.id,
      name: "Search Target",
      emails: [{ address: "target@example.com" }],
    });
    await createPerson({
      applicationId: application.id,
      name: "Other Person",
      emails: [{ address: "other@example.com" }],
    });

    const { user } = await createUser({
      applicationId: application.id,
      entitlements: ["people:read"],
    });
    const token = makeToken(user.id);

    const response = await request(serverState.server.baseUrl)
      .get("/v1/people")
      .set("authorization", `Bearer ${token}`)
      .set("x-application-id", application.id)
      .query({ search: "Target" });

    expect(response.status).toBe(200);
    expect(response.body.people).toHaveLength(1);
    expect(response.body.people[0].name).toBe("Search Target");
  });
});
