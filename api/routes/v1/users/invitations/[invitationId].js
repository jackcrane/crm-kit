import { eq } from "drizzle-orm";
import { db } from "../../../../util/db.js";
import { invitationsTable } from "../../../../db/schema.js";
import { entitlements as requireEntitlements } from "../../../../util/entitlements.js";
import {
  findInvitationByIdOrCode,
  toPublicInvitation,
} from "../../../../util/invitations.js";

const errors = {
  invitation_not_found: {
    status: "failure",
    reason: "invitation_not_found",
  },
  invitation_expired: {
    status: "failure",
    reason: "invitation_expired",
    message: "Invitation has expired.",
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

    const invitation = await findInvitationByIdOrCode(
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

    const invitation = await findInvitationByIdOrCode(
      invitationId,
      req.applicationId,
    );

    if (!invitation) {
      return res.status(404).json(errors.invitation_not_found);
    }

    if (invitation.status === "expired") {
      return res.status(400).json(errors.invitation_expired);
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
