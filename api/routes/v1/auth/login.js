import z from "zod";
const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
  type: z.enum(["password"]).optional().default("password"),
  "cf-turnstile-response": z.string(),
});
import { zerialize } from "zodex";
import { db } from "../../../util/db.js";
import { usersTable } from "../../../db/schema.js";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const errors = {
  invalid_submission_format: {
    status: "failure",
    reason: "invalid_submission_format",
    message: "Invalid submission format.",
    comment:
      "Refer to https://docs.crm-kit.com/blocks/access/login.html for more information.",
  },
  invalid_credentials: {
    status: "failure",
    reason: "invalid_credentials",
    message: "Invalid credentials.",
    comment:
      "Refer to https://docs.crm-kit.com/blocks/access/login.html for more information.",
  },
};

export const post = [
  async (req, res) => {
    const validShape = loginSchema.safeParse(req.body);

    if (!validShape.success) {
      return res.status(400).json({
        ...errors.invalid_submission_format,
        validationError: validShape.error.flatten(),
      });
    }

    const data = validShape.data;

    if (data.type === "password") {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(
          and(
            eq(usersTable.email, data.email),
            eq(usersTable.applicationId, req.applicationId),
          ),
        );

      if (!user) {
        return res.status(401).json(errors.invalid_credentials);
      }

      if (!bcrypt.compareSync(data.password, user.password)) {
        return res.status(401).json(errors.invalid_credentials);
      }

      const token = jwt.sign(
        {
          userId: user.id,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "1h",
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
        userPermissions: [],
      });
    } else {
      return res.status(400).json({
        status: "failure",
        reason: "invalid_submission_format",
        message: "Invalid login type.",
        comment:
          "Refer to https://docs.crm-kit.com/blocks/access/login.html for more information.",
      });
    }
  },
];

export const query = [
  (req, res) => {
    return res.json(zerialize(loginSchema));
  },
];
