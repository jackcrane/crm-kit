import crypto from "crypto";
import { and, eq, or, sql } from "drizzle-orm";
import { db } from "./db.js";
import { invitationsTable } from "../db/schema.js";

export const INVITATION_EXPIRY_HOURS = 24;

export function generateInvitationCode() {
  return crypto.randomBytes(12).toString("hex");
}

export function toPublicInvitation(invitation) {
  return {
    id: invitation.id,
    email: invitation.email,
    name: invitation.name,
    status: invitation.status,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  };
}

export async function expirePendingInvitations(applicationId) {
  await db
    .update(invitationsTable)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(
        eq(invitationsTable.applicationId, applicationId),
        eq(invitationsTable.status, "pending"),
        sql`${invitationsTable.createdAt} < now() - interval '${INVITATION_EXPIRY_HOURS} hours'`,
      ),
    );
}

export async function findInvitationByIdOrCode(invitationId, applicationId) {
  await expirePendingInvitations(applicationId);

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
