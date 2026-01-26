import z from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../../../util/db.js";
import { invitationsTable } from "../../../../db/schema.js";
import { entitlements as requireEntitlements } from "../../../../util/entitlements.js";
import {
  expirePendingInvitations,
  generateInvitationCode,
  toPublicInvitation,
} from "../../../../util/invitations.js";

const MAX_LIMIT = 100;

const invitationInputSchema = z.object({
  email: z.email(),
  name: z.string().optional(),
  entitlements: z.array(z.string()).optional().default([]),
  message: z.string().optional(),
  ctaUrl: z.string().optional(),
});

function normalizePayload(body) {
  const arrayPayload = Array.isArray(body) ? body : [body];
  return arrayPayload.map((item) => invitationInputSchema.parse(item));
}

async function expireOldInvitations(applicationId) {
  await expirePendingInvitations(applicationId);
}

export const post = [
  requireEntitlements(["invitations:write"]),
  async (req, res) => {
    let payloads;
    try {
      payloads = normalizePayload(req.body);
    } catch (err) {
      return res.status(400).json({
        status: "failure",
        reason: "invalid_submission_format",
        message: err.message,
      });
    }

    const invitations = [];

    for (const payload of payloads) {
      // If a rescinded invitation exists for this email/app, reuse it.
      const [existingRescinded] = await db
        .select()
        .from(invitationsTable)
        .where(
          and(
            eq(invitationsTable.applicationId, req.applicationId),
            eq(invitationsTable.email, payload.email),
            eq(invitationsTable.status, "rescinded"),
          ),
        )
        .orderBy(desc(invitationsTable.updatedAt))
        .limit(1);

      if (existingRescinded) {
        const [updated] = await db
          .update(invitationsTable)
          .set({
            name: payload.name ?? existingRescinded.name,
            entitlements: payload.entitlements ?? [],
            code: generateInvitationCode(),
            status: "pending",
            updatedAt: new Date(),
          })
          .where(eq(invitationsTable.id, existingRescinded.id))
          .returning();

        invitations.push(updated);
        continue;
      }

      const [inserted] = await db
        .insert(invitationsTable)
        .values({
          applicationId: req.applicationId,
          email: payload.email,
          name: payload.name,
          entitlements: payload.entitlements ?? [],
          code: generateInvitationCode(),
        })
        .returning();

      invitations.push(inserted);
    }

    return res.status(201).json({
      status: "success",
      invitations: invitations.map((inv) => ({
        ...toPublicInvitation(inv),
        code: inv.code,
        entitlements: inv.entitlements,
      })),
    });
  },
];

export const get = [
  requireEntitlements(["invitations:read"]),
  async (req, res) => {
    await expireOldInvitations(req.applicationId);

    const page = Number.parseInt(req.query.page ?? "1", 10) || 1;
    const limitRaw = Number.parseInt(req.query.limit ?? "10", 10) || 10;
    const limit = Math.min(Math.max(limitRaw, 1), MAX_LIMIT);
    const offset = (page - 1) * limit;

    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(invitationsTable)
      .where(eq(invitationsTable.applicationId, req.applicationId));

    const invitations = await db
      .select()
      .from(invitationsTable)
      .where(eq(invitationsTable.applicationId, req.applicationId))
      .orderBy(desc(invitationsTable.createdAt))
      .limit(limit)
      .offset(offset);

    return res.json({
      invitations: invitations.map(toPublicInvitation),
      total: Number(count),
      page,
      limit,
    });
  },
];
