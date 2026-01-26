import { eq } from "drizzle-orm";
import { db } from "../../../../../util/db.js";
import { invitationsTable } from "../../../../../db/schema.js";
import { entitlements as requireEntitlements } from "../../../../../util/entitlements.js";
import {
  findInvitationByIdOrCode,
  generateInvitationCode,
  toPublicInvitation,
} from "../../../../../util/invitations.js";

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

export const post = [
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

    if (invitation.status === "accepted") {
      return res.status(400).json(errors.invitation_not_pending);
    }

    const [updatedInvitation] = await db
      .update(invitationsTable)
      .set({
        code: generateInvitationCode(),
        status: "pending",
        updatedAt: new Date(),
      })
      .where(eq(invitationsTable.id, invitation.id))
      .returning();

    return res.status(200).json({
      status: "success",
      invitation: {
        ...toPublicInvitation(updatedInvitation),
        code: updatedInvitation.code,
        entitlements: updatedInvitation.entitlements,
      },
    });
  },
];
