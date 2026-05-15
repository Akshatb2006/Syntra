import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      username?: string;
    }
  }
}

function safeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function lookupToken(presented: string): string | null {
  for (const [token, username] of config.validTokens.entries()) {
    if (safeEqualStr(presented, token)) return username;
  }
  return null;
}

export function bearerAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    logger.warn("auth_rejected", {
      reason: "missing_token",
      method: req.method,
      path: req.path,
    });
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }
  const presented = auth.slice("Bearer ".length).trim();
  const username = lookupToken(presented);
  if (!username) {
    logger.warn("auth_rejected", {
      reason: "invalid_token",
      method: req.method,
      path: req.path,
    });
    res.status(403).json({ error: "Invalid token" });
    return;
  }
  req.username = username;
  next();
}

export function requireUsername(req: Request): string {
  if (!req.username) {
    throw new AppError("UNAUTHORIZED", "Request not authenticated");
  }
  return req.username;
}
