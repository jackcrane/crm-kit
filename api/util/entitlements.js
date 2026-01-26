import jwt from "jsonwebtoken";
import { and, eq } from "drizzle-orm";
import { db } from "./db.js";
import { usersTable } from "../db/schema.js";

export const ENTITLEMENT_DEFINITIONS = [
  {
    name: "superuser",
    description: "This user is a superuser and has all permissions.",
    sort: 0,
  },
  {
    name: "users:read",
    description: "The user can read all users.",
    sort: 1,
  },
  {
    name: "users:write",
    description:
      "The user can update and delete users. Users need invitations:write to create new users.",
    sort: 2,
  },
  {
    name: "invitations:read",
    description: "The user can read all invitations.",
    sort: 3,
  },
  {
    name: "invitations:write",
    description: "The user can create, update, and rescind invitations.",
    sort: 4,
  },
  {
    name: "entitlements:read",
    description: "The user can view available entitlements and user grants.",
    sort: 5,
  },
  {
    name: "entitlements:write",
    description: "The user can modify user entitlements.",
    sort: 6,
  },
];

export const ENTITLEMENTS = ENTITLEMENT_DEFINITIONS.map(
  (entitlement) => entitlement.name,
);

export function getEntitlementDefinitions() {
  return [...ENTITLEMENT_DEFINITIONS].sort((a, b) => {
    if (a.sort === b.sort) {
      return a.name.localeCompare(b.name);
    }
    return a.sort - b.sort;
  });
}

export function isValidEntitlement(value) {
  return ENTITLEMENTS.includes(value);
}

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
