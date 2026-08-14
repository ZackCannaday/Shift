import type { NextFunction, Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, dashboardSessionsTable } from "@workspace/db";
import { hashToken } from "../lib/security";

export interface AuthenticatedRequest extends Request {
  shiftSiteId?: number;
}

export async function requireDashboardSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.shift_session;
  if (typeof token !== "string" || token.length < 32) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const [session] = await db.select({ apiKeyId: dashboardSessionsTable.apiKeyId })
    .from(dashboardSessionsTable)
    .where(and(
      eq(dashboardSessionsTable.tokenHash, hashToken(token)),
      gt(dashboardSessionsTable.expiresAt, new Date()),
    ))
    .limit(1);

  if (!session) {
    res.clearCookie("shift_session", { path: "/" });
    res.status(401).json({ error: "Session expired" });
    return;
  }

  req.shiftSiteId = session.apiKeyId;
  next();
}
