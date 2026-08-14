import type { NextFunction, Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { apiKeysTable, db, dashboardSessionsTable, organizationMembersTable } from "@workspace/db";
import { hashToken } from "../lib/security";

export interface AuthenticatedRequest extends Request {
  shiftUserId?: number;
  shiftSiteId?: number;
  shiftSessionId?: number;
}

export async function requireDashboardSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.shift_session;
  if (typeof token !== "string" || token.length < 32) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const [session] = await db.select({
    id: dashboardSessionsTable.id,
    userId: dashboardSessionsTable.userId,
    apiKeyId: dashboardSessionsTable.apiKeyId,
  })
    .from(dashboardSessionsTable)
    .innerJoin(apiKeysTable, eq(apiKeysTable.id, dashboardSessionsTable.apiKeyId))
    .innerJoin(organizationMembersTable, and(
      eq(organizationMembersTable.organizationId, apiKeysTable.organizationId),
      eq(organizationMembersTable.userId, dashboardSessionsTable.userId),
    ))
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

  req.shiftSessionId = session.id;
  req.shiftUserId = session.userId;
  req.shiftSiteId = session.apiKeyId;
  next();
}
