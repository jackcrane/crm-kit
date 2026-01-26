import z from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../../../util/db.js";
import { usersTable } from "../../../db/schema.js";
import {
  checkEntitlements,
  entitlements as requireEntitlements,
  getEntitlementDefinitions,
  isValidEntitlement,
} from "../../../util/entitlements.js";

const modificationSchema = z.object({
  entitlement: z.string(),
  action: z.enum(["add", "remove"]),
});

const errors = {
  invalid_submission_format: {
    status: "failure",
    reason: "invalid_submission_format",
    message: "Invalid submission format.",
  },
  invalid_entitlement: {
    status: "failure",
    reason: "invalid_entitlement",
    message: "One or more entitlements are not recognized.",
  },
  user_not_found: {
    status: "failure",
    reason: "user_not_found",
    message: "User not found.",
  },
};

function normalizeSubmission(body) {
  const normalized = Array.isArray(body) ? body : [body];
  return normalized.map((item) => modificationSchema.parse(item));
}

async function findUser(userId, applicationId) {
  const [user] = await db
    .select({
      id: usersTable.id,
      entitlements: usersTable.entitlements,
    })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.id, userId),
        eq(usersTable.applicationId, applicationId),
      ),
    )
    .limit(1);

  return user ?? null;
}

function sortEntitlements(entitlements) {
  const order = getEntitlementDefinitions().map((item) => item.name);
  const set = new Set(entitlements ?? []);
  const sortedKnown = order.filter((value) => {
    if (set.has(value)) {
      set.delete(value);
      return true;
    }
    return false;
  });

  const remaining = [...set].sort();
  return [...sortedKnown, ...remaining];
}

export const get = [
  requireEntitlements([]),
  async (req, res) => {
    const targetUserId = req.params.userId;
    const isSelf = req.user?.id === targetUserId;

    if (!isSelf) {
      const canRead = await checkEntitlements(
        req.user.id,
        ["entitlements:read"],
        req.applicationId,
      );
      if (!canRead) {
        return res.status(403).json({
          status: "failure",
          reason: "forbidden",
          required: ["entitlements:read"],
        });
      }
    }

    const user = await findUser(targetUserId, req.applicationId);
    if (!user) {
      return res.status(404).json(errors.user_not_found);
    }

    return res.json(user.entitlements ?? []);
  },
];

export const post = [
  requireEntitlements(["entitlements:write"]),
  async (req, res) => {
    let updates;
    try {
      updates = normalizeSubmission(req.body);
    } catch (err) {
      return res.status(400).json({
        ...errors.invalid_submission_format,
        validationError: err instanceof z.ZodError ? err.flatten() : undefined,
      });
    }

    const invalid = [
      ...new Set(
        updates
          .map((update) => update.entitlement)
          .filter((item) => !isValidEntitlement(item)),
      ),
    ];
    if (invalid.length > 0) {
      return res.status(400).json({
        ...errors.invalid_entitlement,
        invalid,
      });
    }

    const user = await findUser(req.params.userId, req.applicationId);
    if (!user) {
      return res.status(404).json(errors.user_not_found);
    }

    const entitlements = new Set(user.entitlements ?? []);
    for (const update of updates) {
      if (update.action === "add") {
        entitlements.add(update.entitlement);
      } else {
        entitlements.delete(update.entitlement);
      }
    }

    const nextEntitlements = sortEntitlements(entitlements);

    const [updated] = await db
      .update(usersTable)
      .set({
        entitlements: nextEntitlements,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(usersTable.id, req.params.userId),
          eq(usersTable.applicationId, req.applicationId),
        ),
      )
      .returning({
        entitlements: usersTable.entitlements,
      });

    return res.status(200).json({
      status: "success",
      entitlements: updated.entitlements ?? [],
    });
  },
];
