import { Router } from "express";
import jwt from "jsonwebtoken";
import { store } from "../store.js";
import { ModeAccess, Role, type AuthResponse, type User } from "../types.js";

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-insecure-secret-change-me";

if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET ontbreekt. Gebruik een veilige secret in productie.");
}

function createAccessToken(user: User): string {
  return jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, {
    subject: user.id,
    expiresIn: "1h",
  });
}

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Ingelogd
 *       400:
 *         description: Fout
 */
authRouter.post("/login", (req, res) => {
  const { email } = req.body as { email: string; password: string };

  const user = store.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (!user) return res.status(400).json({ message: "Gebruiker niet gevonden" });
  if (!user.isActive) return res.status(400).json({ message: "Dit account is gedeactiveerd" });

  const token = createAccessToken(user);
  const response: AuthResponse = { user, token };
  return res.json(response);
});

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registreren
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *               role:
 *                 type: string
 *                 enum: [ADMIN, TEACHER, STUDENT]
 *     responses:
 *       200:
 *         description: Geregistreerd
 *       400:
 *         description: Fout
 */
authRouter.post("/register", (req, res) => {
  const { email, role } = req.body as { email: string; password: string; role?: Role };

  const exists = store.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (exists) return res.status(400).json({ message: "E-mail is al in gebruik" });

  const newUser: User = {
    id: store.makeId(),
    email,
    role: role ?? Role.STUDENT,
    modeAccess: ModeAccess.CLASSIC,
    isActive: true,
    createdAt: store.nowISO(),
  };

  store.users.push(newUser);

  const token = createAccessToken(newUser);
  const response: AuthResponse = { user: newUser, token };
  return res.json(response);
});
