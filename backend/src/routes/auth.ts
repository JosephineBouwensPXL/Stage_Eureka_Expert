import { Router } from "express";
import type { Request, Response } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { store } from "../store.js";
import { ModeAccess, Role, type AuthResponse } from "../types.js";
import { createAccessToken } from "../security/jwt.js";

export const authRouter = Router();
const REFRESH_COOKIE_NAME = "studybuddy_refresh_token";
const REFRESH_COOKIE_PATH = "/api/auth";
const refreshTokenDays = Number.parseInt(process.env.REFRESH_TOKEN_DAYS ?? "14", 10);
const refreshTokenMaxAgeMs = (Number.isFinite(refreshTokenDays) ? refreshTokenDays : 14) * 24 * 60 * 60 * 1000;
const isProduction = process.env.NODE_ENV === "production";
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("studybuddy-invalid-password-placeholder", 10);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 256;

function createOpaqueToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function futureIso(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function cleanName(value: unknown): string {
  return String(value ?? "").trim().slice(0, MAX_NAME_LENGTH);
}

function isValidEmail(email: string): boolean {
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email);
}

function isValidPassword(password: string): boolean {
  return password.length >= 8 && password.length <= MAX_PASSWORD_LENGTH;
}

function readCookie(req: Request, key: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const parts = raw.split(";");
  for (const part of parts) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== key) continue;
    return decodeURIComponent(rest.join("="));
  }
  return null;
}

function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: refreshTokenMaxAgeMs,
  });
}

function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
  });
}

function issueAuthSession(res: Response, user: AuthResponse["user"]): AuthResponse {
  const refreshToken = createOpaqueToken();
  const refreshTokenId = store.makeId();
  store.createRefreshToken({
    id: refreshTokenId,
    userId: user.id,
    tokenHash: sha256(refreshToken),
    expiresAt: futureIso(refreshTokenMaxAgeMs),
  });
  setRefreshTokenCookie(res, refreshToken);
  const token = createAccessToken(user);
  return { user, token };
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
  const { email, password } = req.body as { email: string; password: string };
  const normalizedEmail = normalizeEmail(email);
  const rawPassword = String(password ?? "");

  if (!isValidEmail(normalizedEmail) || rawPassword.length > MAX_PASSWORD_LENGTH) {
    return res.status(400).json({ message: "E-mail of wachtwoord is ongeldig" });
  }

  const authUser = store.findAuthUserByEmail(normalizedEmail);
  const validPassword = bcrypt.compareSync(rawPassword, authUser?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!authUser || !validPassword) {
    return res.status(400).json({ message: "E-mail of wachtwoord is ongeldig" });
  }
  if (!authUser.user.isActive) return res.status(400).json({ message: "Dit account is gedeactiveerd" });

  store.cleanupExpiredRefreshTokens();
  const response = issueAuthSession(res, authUser.user);
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
  const normalizedFirstName = cleanName(firstName);
  const normalizedLastName = cleanName(lastName);
  const normalizedEmail = normalizeEmail(email);
  const rawPassword = String(password ?? "");

  if (!normalizedFirstName) {
    return res.status(400).json({ message: "Voornaam is verplicht" });
  }
  if (!normalizedLastName) {
    return res.status(400).json({ message: "Achternaam is verplicht" });
  }
  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: "Geef een geldig e-mailadres op" });
  }
  if (!isValidPassword(rawPassword)) {
    return res.status(400).json({ message: "Wachtwoord moet minimaal 8 tekens zijn" });
  }

  const exists = store.findUserByEmail(normalizedEmail);
  if (exists) return res.status(400).json({ message: "E-mail is al in gebruik" });

  const passwordHash = bcrypt.hashSync(rawPassword, 10);

  const newUser = store.createUser({
    firstName: normalizedFirstName,
    lastName: normalizedLastName,
    email: normalizedEmail,
    passwordHash,
    role: Role.STUDENT,
    modeAccess: ModeAccess.NATIVE,
    isActive: true,
  });

  store.cleanupExpiredRefreshTokens();
  const response = issueAuthSession(res, newUser);
  return res.json(response);
});

authRouter.post("/refresh", (req, res) => {
  const refreshToken = readCookie(req, REFRESH_COOKIE_NAME);
  if (!refreshToken) {
    clearRefreshTokenCookie(res);
    return res.status(401).json({ message: "Refresh token ontbreekt" });
  }

  const existing = store.findRefreshTokenByHash(sha256(refreshToken));
  if (!existing) {
    clearRefreshTokenCookie(res);
    return res.status(401).json({ message: "Refresh token ongeldig" });
  }

  if (existing.revoked_at) {
    clearRefreshTokenCookie(res);
    return res.status(401).json({ message: "Refresh token is ingetrokken" });
  }

  if (new Date(existing.expires_at).getTime() <= Date.now()) {
    store.revokeRefreshToken({ id: existing.id });
    clearRefreshTokenCookie(res);
    return res.status(401).json({ message: "Refresh token verlopen" });
  }

  const user = store.findUserById(existing.user_id);
  if (!user || !user.isActive) {
    store.revokeRefreshToken({ id: existing.id });
    clearRefreshTokenCookie(res);
    return res.status(401).json({ message: "Gebruiker niet gevonden of gedeactiveerd" });
  }

  const nextRefreshToken = createOpaqueToken();
  const nextRefreshTokenId = store.makeId();
  store.createRefreshToken({
    id: nextRefreshTokenId,
    userId: user.id,
    tokenHash: sha256(nextRefreshToken),
    expiresAt: futureIso(refreshTokenMaxAgeMs),
  });
  store.revokeRefreshToken({ id: existing.id, replacedByTokenId: nextRefreshTokenId });

  setRefreshTokenCookie(res, nextRefreshToken);
  const response: AuthResponse = { user, token: createAccessToken(user) };
  return res.json(response);
});

authRouter.post("/logout", (req, res) => {
  const refreshToken = readCookie(req, REFRESH_COOKIE_NAME);
  if (refreshToken) {
    const existing = store.findRefreshTokenByHash(sha256(refreshToken));
    if (existing && !existing.revoked_at) {
      store.revokeRefreshToken({ id: existing.id });
    }
  }

  clearRefreshTokenCookie(res);
  return res.status(204).send();
});
