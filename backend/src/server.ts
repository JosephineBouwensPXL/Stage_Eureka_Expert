import "./tracing.js";
import path from "path";
import { createServer } from "http";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { config as loadEnv } from "dotenv";
import { swaggerSpec } from "./swagger.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { localRouter } from "./routes/local.js";
import { attachNativeVoiceRelay } from "./liveRelay.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(currentDir, "../../.env") });
loadEnv({ path: path.resolve(currentDir, "../../.env.local"), override: true });

const isProduction = process.env.NODE_ENV === "production";
const rawCorsOrigin = (process.env.CORS_ORIGIN ?? "").trim();
const allowedOrigins = rawCorsOrigin
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (isProduction && allowedOrigins.length === 0) {
  throw new Error("CORS_ORIGIN ontbreekt in productie. Zet een comma-separated allowlist.");
}

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (!isProduction && allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
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

const port = Number(process.env.PORT ?? 3001);

const httpServer = createServer(app);
attachNativeVoiceRelay({
  server: httpServer,
  isProduction,
  allowedOrigins,
});

httpServer.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
  console.log(`Swagger UI on  http://localhost:${port}/docs`);
  console.log(`Native voice relay on ws://localhost:${port}/ws/native-voice`);
});
