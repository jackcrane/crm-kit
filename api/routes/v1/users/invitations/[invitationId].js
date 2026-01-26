import { and, or, eq } from "drizzle-orm";
import { db } from "../../../../util/db.js";
import { invitationsTable } from "../../../../db/schema.js";

function toPublicInvitation(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const get = [
  async (req, res) => {
    const invitationId = req.params.invitationId;

    const [invitation] = await db
      .select()
      .from(invitationsTable)
      .where(
        or(
          and(
            eq(invitationsTable.id, invitationId),
            eq(invitationsTable.applicationId, req.applicationId),
          ),
          and(
            eq(invitationsTable.code, invitationId),
            eq(invitationsTable.applicationId, req.applicationId),
          ),
        ),
      )
      .limit(1);

    if (!invitation) {
      return res.status(404).json({
        status: "failure",
        reason: "invitation_not_found",
      });
    }

    return res.json({
      invitation: toPublicInvitation(invitation),
      application: {
        requiresCaptcha: req.application.enforceTurnstile,
        siteKey: req.application.cfTurnstileSiteKey,
      },
    });
  },
];
