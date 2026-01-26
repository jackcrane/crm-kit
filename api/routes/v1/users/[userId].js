import { and, eq } from "drizzle-orm";
import { db } from "../../../util/db.js";
import { usersTable } from "../../../db/schema.js";
import { entitlements as requireEntitlements } from "../../../util/entitlements.js";

const errors = {
  user_not_found: {
    status: "failure",
    reason: "user_not_found",
    message: "User not found.",
  },
};

export const del = [
  requireEntitlements(["users:write"]),
  async (req, res) => {
    const [user] = await db
      .select({
        id: usersTable.id,
        status: usersTable.status,
      })
      .from(usersTable)
      .where(
        and(
          eq(usersTable.id, req.params.userId),
          eq(usersTable.applicationId, req.applicationId),
        ),
      )
      .limit(1);

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
