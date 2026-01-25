import z from "zod";
const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
  type: z.enum(["password"]).optional().default("password"),
  "cf-turnstile-response": z.string(),
});
import { zerialize } from "zodex";

export const post = [
  (req, res) => {
    const validShape = loginSchema.safeParse(req.body);

    if (!validShape.success) {
      return res.status(400).json({
        status: "failure",
        reason: "invalid_submission_format",
        message: "Invalid submission format.",
        comment:
          "Refer to https://docs.crm-kit.com/blocks/access/login.html for more information.",
        validationError: validShape.error.flatten(),
      });
    }

    return res.status(200).json({
      status: "success",
      data,
    });
  },
];

export const query = [
  (req, res) => {
    return res.json(zerialize(loginSchema));
  },
];
