import z from "zod";
import jwt from "jsonwebtoken";
import { zerialize } from "zodex";
import { db } from "../../../util/db.js";
import { applicationsTable, usersTable } from "../../../db/schema.js";
import { and, eq } from "drizzle-orm";
import { validateTurnstile } from "../../../util/validateTurnstile.js";
import { verify as verifyOtp } from "otplib";

const challengeSchema = z.object({
  nonce: z.string(),
  response: z.string(),
  "cf-turnstile-response": z.string().optional(),
});

const errors = {
  invalid_submission_format: {
    status: "failure",
    reason: "invalid_submission_format",
    message: "Invalid submission format.",
    comment:
      "Refer to https://docs.crm-kit.com/blocks/access/mfa.html for more information.",
  },
  invalid_challenge: {
    status: "failure",
    reason: "invalid_challenge",
    message: "Invalid or expired challenge.",
    comment:
      "Refer to https://docs.crm-kit.com/blocks/access/mfa.html for more information.",
  },
  invalid_challenge_response: {
    status: "failure",
    reason: "invalid_challenge_response",
    message: "Invalid challenge response.",
    comment:
      "Refer to https://docs.crm-kit.com/blocks/access/mfa.html for more information.",
  },
  invalid_captcha: {
    status: "failure",
    reason: "invalid_captcha",
    message: "Invalid captcha.",
  },
};

export const post = [
  async (req, res) => {
    const parsed = challengeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        ...errors.invalid_submission_format,
        validationError: parsed.error.flatten(),
      });
    }

    const data = parsed.data;

    if (req.application.enforceTurnstile) {
      const turnstileResponse = data["cf-turnstile-response"];
      if (!turnstileResponse) {
        return res.status(401).json(errors.invalid_captcha);
      }

      const valid = await validateTurnstile(
        req.application.cfTurnstileSecretKey,
        turnstileResponse,
        req.ip,
      );

      if (!valid) {
        return res.status(401).json(errors.invalid_captcha);
      }
    }

    let decoded;
    try {
      decoded = jwt.verify(data.nonce, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json(errors.invalid_challenge);
    }

    if (
      decoded.challengeType !== "mfa" ||
      decoded.applicationId !== req.applicationId
    ) {
      return res.status(401).json(errors.invalid_challenge);
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.id, decoded.userId),
          eq(usersTable.applicationId, req.applicationId),
        ),
      );

    if (!user || !user.mfaEnabled || !user.otpSecret) {
      return res.status(401).json(errors.invalid_challenge);
    }

    const { valid: isValid } = await verifyOtp({
      secret: user.otpSecret,
      token: data.response,
    });

    if (!isValid) {
      return res.status(401).json(errors.invalid_challenge_response);
    }

    const [application] = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, req.applicationId));

    const token = jwt.sign(
      {
        userId: user.id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: application.jwtValidityTime,
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

export const query = [
  (req, res) => {
    return res.json(zerialize(challengeSchema));
  },
];
