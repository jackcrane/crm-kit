import jwt from "jsonwebtoken";
import { and, eq } from "drizzle-orm";
import { db } from "./db.js";
import { usersTable } from "../db/schema.js";

export const ENTITLEMENTS = [
  "superuser",
  "users:read",
  "users:write",
  "invitations:read",
  "invitations:write",
];

function normalizeRequired(required) {
  if (!required) return [];
  return Array.isArray(required) ? required : [required];
}

async function fetchUser(userId, applicationId) {
  if (!userId) return null;

  const conditions = [eq(usersTable.id, userId)];
  if (applicationId) {
    conditions.push(eq(usersTable.applicationId, applicationId));
  }

  const [user] = await db
    .select({
      id: usersTable.id,
      applicationId: usersTable.applicationId,
      name: usersTable.name,
      email: usersTable.email,
      entitlements: usersTable.entitlements,
    })
    .from(usersTable)
    .where(
      conditions.length === 1 ? conditions[0] : and(...conditions),
    );

  return user ?? null;
}

async function userHasEntitlements(user, required) {
  if (!user) return false;

  const entitlements = user.entitlements ?? [];
  if (!Array.isArray(entitlements)) {
    return false;
  }

  if (entitlements.includes("superuser")) {
    return true;
  }

  return required.every((entitlement) =>
    entitlements.includes(entitlement),
  );
}

export async function checkEntitlements(userId, required, applicationId) {
  const normalizedRequired = normalizeRequired(required);
  if (normalizedRequired.length === 0) {
    return true;
  }

  const user = await fetchUser(userId, applicationId);
  return userHasEntitlements(user, normalizedRequired);
}

function extractBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== "string") {
    return null;
  }

  const [scheme, token] = headerValue.split(" ");
  if (!token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token;
}

export function entitlements(required) {
  const normalizedRequired = normalizeRequired(required);

  return async (req, res, next) => {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res
        .status(401)
        .json({ status: "failure", reason: "unauthorized" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ status: "failure", reason: "invalid_token" });
    }

    const user = await fetchUser(decoded.userId, req.applicationId);
    if (!user) {
      return res
        .status(401)
        .json({ status: "failure", reason: "unauthorized" });
    }

    req.user = user;

    if (normalizedRequired.length === 0) {
      return next();
    }

    const hasAccess = await userHasEntitlements(
      user,
      normalizedRequired,
    );

    if (!hasAccess) {
      return res.status(403).json({
        status: "failure",
        reason: "forbidden",
        required: normalizedRequired,
      });
    }

    return next();
  };
}
