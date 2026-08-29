import type { Response } from "express";
import { randomBytes } from "crypto";
import { db, dashboardSessionsTable } from "@workspace/db";
import { hashToken } from "./security";

const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// # Cookie security
export function sessionCookieSecure(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NODE_ENV !== "development") return true;

  try {
    const appUrl = new URL(env.PUBLIC_APP_URL ?? "");
    const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      appUrl.hostname,
    );
    return !(appUrl.protocol === "http:" && isLoopback);
  } catch {
    return true;
  }
}

export async function createDashboardSession(
  res: Response,
  userId: number,
  apiKeyId: number,
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(dashboardSessionsTable).values({
    userId,
    apiKeyId,
    tokenHash: hashToken(token),
    expiresAt,
  });
  res.cookie("shift_session", token, {
    httpOnly: true,
    secure: sessionCookieSecure(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}
