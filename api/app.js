import express from "express";
import registerRoutes from "./util/router.js";
import path from "path";
import cors from "cors";
import { db } from "./util/db.js";
import { applicationsTable } from "./db/schema.js";
import { eq } from "drizzle-orm";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (process.env.NODE_ENV !== "test") {
    app.use((req, res, next) => {
      console.log(req.method, req.url);
      next();
    });
  }

  app.use(async (req, res, next) => {
    req.applicationId = req.headers["x-application-id"];

    if (!req.applicationId) {
      const allowedRoutes = [""];
      if (!allowedRoutes.includes(req.url)) {
        return res.status(400).json({
          message: "Missing application ID.",
          comment:
            "Refer to https://docs.crm-kit.com/requests.html#application-id for more information.",
        });
      }
    } else {
      const [application] = await db
        .select()
        .from(applicationsTable)
        .where(eq(applicationsTable.id, req.applicationId));

      if (!application) {
        return res.status(400).json({
          message: "Invalid application ID.",
          comment:
            "Refer to https://docs.crm-kit.com/requests.html#application-id for more information.",
        });
      }

      req.application = {
        ...application,
        // Keep loginEnabled aligned even if the column is absent from the schema.
        loginEnabled:
          application.loginEnabled ??
          application.loginAvailable ??
          true,
      };
    }

    next();
  });

  const routesDir = path.join(__dirname, "routes");
  await registerRoutes(app, routesDir);

  app.get("/", (req, res) => {
    res.send("Hello World!");
  });

  // Surface unexpected errors in a consistent shape.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  return app;
}
