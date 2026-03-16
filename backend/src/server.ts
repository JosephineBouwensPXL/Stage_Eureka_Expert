import "./tracing.js";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { config as loadEnv } from "dotenv";
import { swaggerSpec } from "./swagger.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { localRouter } from "./routes/local.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(currentDir, "../../.env") });
loadEnv({ path: path.resolve(currentDir, "../../.env.local"), override: true });

const app = express();

app.use(cors());
app.use(express.json({ limit: "25mb" }));

app.get("/", (_req, res) =>
  res.json({
    service: "StudyBuddy API",
    status: "ok",
    health: "/health",
    docs: "/docs",
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/local", localRouter);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(3001, () => {
  console.log("API running on http://localhost:3001");
  console.log("Swagger UI on  http://localhost:3001/docs");
});
