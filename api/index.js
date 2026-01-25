import express from "express";
import registerRoutes from "./util/router.js";
import path from "path";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(req.method, req.url);
  next();
});

app.use((req, res, next) => {
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
  }

  next();
});

await registerRoutes(app, path.join(process.cwd(), "routes"));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(3000, () => {
  console.log("Example app listening on port 3000!");
});
