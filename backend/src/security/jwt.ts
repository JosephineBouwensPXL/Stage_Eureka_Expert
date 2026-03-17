import jwt from "jsonwebtoken";
import { Role, type User } from "../types.js";
import type { SignOptions } from "jsonwebtoken";

const isProduction = process.env.NODE_ENV === "production";
const configuredJwtSecret = process.env.JWT_SECRET;

if (isProduction && !configuredJwtSecret) {
  throw new Error("JWT_SECRET ontbreekt in productie. Zet een sterke JWT_SECRET environment variable.");
}

export const JWT_SECRET: string = configuredJwtSecret ?? "dev-insecure-secret-change-me";

if (!configuredJwtSecret) {
  console.warn("JWT_SECRET ontbreekt. Gebruik een veilige secret in productie.");
}

export type AccessTokenClaims = {
  sub: string;
  email: string;
  role: Role;
};

export function createAccessToken(user: User): string {
  const configuredTtl = (process.env.ACCESS_TOKEN_TTL ?? "").trim();
  const expiresIn = (configuredTtl || "15m") as NonNullable<SignOptions["expiresIn"]>;
  const options: SignOptions = {
    subject: user.id,
    expiresIn,
  };
  return jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (!decoded || typeof decoded === "string") {
    throw new Error("Ongeldig token");
  }

  const sub = decoded.sub;
  const email = decoded.email;
  const role = decoded.role;

  if (!sub || typeof sub !== "string") {
    throw new Error("Token mist subject");
  }
  if (!email || typeof email !== "string") {
    throw new Error("Token mist email");
  }
  if (role !== Role.ADMIN && role !== Role.STUDENT) {
    throw new Error("Token mist geldige rol");
  }

  return { sub, email, role };
}
