import crypto from "node:crypto";
import type { ErrorRequestHandler, RequestHandler } from "express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  message: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export const securityHeaders: RequestHandler = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");

  if (!req.path.startsWith("/api/docs")) {
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  }

  next();
};

export const requestId: RequestHandler = (_req, res, next) => {
  res.locals.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", res.locals.requestId);
  next();
};

export function rateLimit(options: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${ip}:${req.baseUrl}:${req.route?.path ?? req.path}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > options.max) {
      res.setHeader("Retry-After", String(Math.ceil((current.resetAt - now) / 1000)));
      return res.status(429).json({ message: options.message });
    }

    if (buckets.size > 5000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }

    return next();
  };
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ message: "Route niet gevonden" });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const requestIdValue = typeof res.locals.requestId === "string" ? res.locals.requestId : undefined;
  const status = typeof err?.status === "number" && err.status >= 400 && err.status < 600 ? err.status : 500;
  const message = status >= 500 ? "Interne serverfout" : err?.message || "Verzoek mislukt";

  if (status >= 500) {
    console.error("[HTTP] Unhandled error", {
      requestId: requestIdValue,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  res.status(status).json({
    message,
    ...(requestIdValue ? { requestId: requestIdValue } : {}),
  });
};
