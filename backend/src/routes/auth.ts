import { Router } from "express";
import bcrypt from "bcryptjs";
import { store } from "../store.js";
import { ModeAccess, Role, type AuthResponse } from "../types.js";
import { createAccessToken } from "../security/jwt.js";

export const authRouter = Router();

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
 *             required: [firstName, lastName, email, password]
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Ingelogd
 *       400:
 *         description: Fout
 */
authRouter.post("/login", (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  const authUser = store.findAuthUserByEmail(String(email));
  if (!authUser) return res.status(400).json({ message: "Gebruiker niet gevonden" });
  if (!authUser.user.isActive) return res.status(400).json({ message: "Dit account is gedeactiveerd" });

  const validPassword = bcrypt.compareSync(String(password ?? ""), authUser.passwordHash);
  if (!validPassword) return res.status(400).json({ message: "Onjuist wachtwoord" });

  const token = createAccessToken(authUser.user);
  const response: AuthResponse = { user: authUser.user, token };
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
 *     responses:
 *       200:
 *         description: Geregistreerd
 *       400:
 *         description: Fout
 */
authRouter.post("/register", (req, res) => {
  const { firstName, lastName, email, password } = req.body as {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  };

  const exists = store.findUserByEmail(String(email));
  if (exists) return res.status(400).json({ message: "E-mail is al in gebruik" });
  if (!firstName || !String(firstName).trim()) {
    return res.status(400).json({ message: "Voornaam is verplicht" });
  }
  if (!lastName || !String(lastName).trim()) {
    return res.status(400).json({ message: "Achternaam is verplicht" });
  }
  if (!password || String(password).trim().length < 6) {
    return res.status(400).json({ message: "Wachtwoord moet minimaal 6 tekens zijn" });
  }

  const passwordHash = bcrypt.hashSync(String(password), 10);

  const newUser = store.createUser({
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    email,
    passwordHash,
    role: Role.STUDENT,
    modeAccess: ModeAccess.CLASSIC,
    isActive: true,
  });

  const token = createAccessToken(newUser);
  const response: AuthResponse = { user: newUser, token };
  return res.json(response);
});
