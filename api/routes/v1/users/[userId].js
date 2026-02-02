import { and, eq } from "drizzle-orm";
import { db } from "../../../util/db.js";
import { usersTable } from "../../../db/schema.js";
import { entitlements as requireEntitlements } from "../../../util/entitlements.js";
import { toPublicUser } from "../../../util/users.js";

const errors = {
  user_not_found: {
    status: "failure",
    reason: "user_not_found",
    message: "User not found.",
  },
};

const publicUserSelection = {
  id: usersTable.id,
  email: usersTable.email,
  name: usersTable.name,
  status: usersTable.status,
  createdAt: usersTable.createdAt,
  updatedAt: usersTable.updatedAt,
};

async function findUser(userId, applicationId) {
  const [user] = await db
    .select(publicUserSelection)
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

export const get = [
  requireEntitlements(["users:read"]),
  async (req, res) => {
    const user = await findUser(req.params.userId, req.applicationId);

    if (!user) {
      return res.status(404).json(errors.user_not_found);
    }

    return res.status(200).json({ user: toPublicUser(user) });
  },
];

export const del = [
  requireEntitlements(["users:write"]),
  async (req, res) => {
    const user = await findUser(req.params.userId, req.applicationId);

    if (!user) {
      return res.status(404).json(errors.user_not_found);
    }

    if (user.status !== "revoked") {
      await db
        .update(usersTable)
        .set({
          status: "revoked",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(usersTable.id, req.params.userId),
            eq(usersTable.applicationId, req.applicationId),
          ),
        );
    }

    return res.status(200).json({ status: "success" });
  },
];
