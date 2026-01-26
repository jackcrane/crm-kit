import z from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { and, eq, or } from "drizzle-orm";
import { db } from "../../../../../util/db.js";
import { invitationsTable, usersTable } from "../../../../../db/schema.js";
import { validateTurnstile } from "../../../../../util/validateTurnstile.js";

const acceptSchema = z.object({
  password: z.string().min(8),
  "cf-turnstile-response": z.string().optional(),
});

const errors = {
  invalid_submission_format: {
    status: "failure",
    reason: "invalid_submission_format",
    message: "Invalid submission format.",
  },
  invitation_not_found: {
    status: "failure",
    reason: "invitation_not_found",
    message: "Invitation not found.",
  },
  invitation_not_pending: {
    status: "failure",
    reason: "invitation_not_pending",
    message: "Invitation is not pending.",
  },
  invalid_captcha: {
    status: "failure",
    reason: "invalid_captcha",
    message: "Invalid captcha.",
  },
};

async function findInvitation(invitationId, applicationId) {
  const [invitation] = await db
    .select()
    .from(invitationsTable)
    .where(
      and(
        or(
          eq(invitationsTable.id, invitationId),
          eq(invitationsTable.code, invitationId),
        ),
        eq(invitationsTable.applicationId, applicationId),
      ),
    )
    .limit(1);

  return invitation ?? null;
}

export const post = [
  async (req, res) => {
    const parsed = acceptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ...errors.invalid_submission_format,
        validationError: parsed.error.flatten(),
      });
    }

    const invitation = await findInvitation(
      req.params.invitationId,
      req.applicationId,
    );

    if (!invitation) {
      return res.status(404).json(errors.invitation_not_found);
    }

    if (invitation.status !== "pending") {
      return res.status(400).json(errors.invitation_not_pending);
    }

    if (req.application.enforceTurnstile) {
      const token = parsed.data["cf-turnstile-response"];
      if (!token) {
        return res.status(401).json(errors.invalid_captcha);
      }

      const valid = await validateTurnstile(
        req.application.cfTurnstileSecretKey,
        token,
        req.ip,
      );

      if (!valid) {
        return res.status(401).json(errors.invalid_captcha);
      }
    }

    const hashedPassword = bcrypt.hashSync(parsed.data.password, 10);

    const [user] = await db
      .insert(usersTable)
      .values({
        applicationId: req.applicationId,
        email: invitation.email,
        name: invitation.name ?? invitation.email,
        password: hashedPassword,
        entitlements: invitation.entitlements ?? [],
      })
      .returning();

    await db
      .update(invitationsTable)
      .set({
        status: "accepted",
        updatedAt: new Date(),
      })
      .where(eq(invitationsTable.id, invitation.id));

    const token = jwt.sign(
      {
        userId: user.id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: req.application.jwtValidityTime,
      },
    );

    return res.status(200).json({
      status: "success",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      userPermissions: user.entitlements ?? [],
    });
  },
];
