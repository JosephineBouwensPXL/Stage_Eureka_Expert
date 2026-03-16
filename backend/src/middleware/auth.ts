import { type RequestHandler } from "express";
import { store } from "../store.js";
import { Role } from "../types.js";
import { verifyAccessToken } from "../security/jwt.js";

export const requireAuth: RequestHandler = (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authenticatie vereist" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({ message: "Authenticatie vereist" });
  }

  try {
    const claims = verifyAccessToken(token);
    const user = store.findUserById(claims.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Account niet gevonden of gedeactiveerd" });
    }

    res.locals.auth = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch {
    return res.status(401).json({ message: "Ongeldig of verlopen token" });
  }
};

export const requireAdmin: RequestHandler = (_req, res, next) => {
  if (res.locals.auth?.role !== Role.ADMIN) {
    return res.status(403).json({ message: "Admin rechten vereist" });
  }
  return next();
};
