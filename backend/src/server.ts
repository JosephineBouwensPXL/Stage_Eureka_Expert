import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { classroomsRouter } from "./routes/classrooms.js";
import { localRouter } from "./routes/local.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "25mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/classrooms", classroomsRouter);
app.use("/local", localRouter);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(3001, () => {
  console.log("API running on http://localhost:3001");
  console.log("Swagger UI on  http://localhost:3001/docs");
});
