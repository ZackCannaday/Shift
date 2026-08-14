import type { Response } from "express";
import { randomBytes } from "crypto";
import { db, dashboardSessionsTable } from "@workspace/db";
import { hashToken } from "./security";

const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export async function createDashboardSession(res: Response, userId: number, apiKeyId: number) {
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
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}
