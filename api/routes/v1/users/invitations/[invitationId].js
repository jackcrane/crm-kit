import { and, or, eq } from "drizzle-orm";
import { db } from "../../../../util/db.js";
import { invitationsTable } from "../../../../db/schema.js";
import { entitlements as requireEntitlements } from "../../../../util/entitlements.js";

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

async function findInvitation(invitationId, applicationId) {
  const [invitation] = await db
    .select()
    .from(invitationsTable)
    .where(
      or(
        and(
          eq(invitationsTable.id, invitationId),
          eq(invitationsTable.applicationId, applicationId),
        ),
        and(
          eq(invitationsTable.code, invitationId),
          eq(invitationsTable.applicationId, applicationId),
        ),
      ),
    )
    .limit(1);

  return invitation ?? null;
}

const errors = {
  invitation_not_found: {
    status: "failure",
    reason: "invitation_not_found",
  },
  invitation_not_pending: {
    status: "failure",
    reason: "invitation_not_pending",
    message: "Invitation is not pending.",
  },
};

export const get = [
  async (req, res) => {
    const invitationId = req.params.invitationId;

    const invitation = await findInvitation(
      invitationId,
      req.applicationId,
    );

    if (!invitation) {
      return res.status(404).json(errors.invitation_not_found);
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

export const del = [
  requireEntitlements(["invitations:write"]),
  async (req, res) => {
    const invitationId = req.params.invitationId;

    const invitation = await findInvitation(
      invitationId,
      req.applicationId,
    );

    if (!invitation) {
      return res.status(404).json(errors.invitation_not_found);
    }

    if (invitation.status !== "pending") {
      return res.status(400).json(errors.invitation_not_pending);
    }

    await db
      .update(invitationsTable)
      .set({ status: "rescinded", updatedAt: new Date() })
      .where(eq(invitationsTable.id, invitation.id));

    return res.status(200).json({ status: "success" });
  },
];
