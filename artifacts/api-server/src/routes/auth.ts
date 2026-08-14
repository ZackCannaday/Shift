import { Router, type IRouter } from "express";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { apiKeysTable, db, dashboardSessionsTable, organizationMembersTable, usersTable } from "@workspace/db";
import { createDashboardSession } from "../lib/dashboard-session";
import { hashToken } from "../lib/security";
import { canDeliverMagicLinks, issueMagicLink } from "../lib/magic-link";
import { consumeRateLimit } from "../lib/rate-limit";
import { requireDashboardSession, type AuthenticatedRequest } from "../middlewares/dashboard-auth";

const router: IRouter = Router();

const RequestLoginBody = z.object({
  email: z.string().email(),
});

const VerifyTokenBody = z.object({
  token: z.string().min(8),
});

// POST /api/auth/request — look up account by email, generate magic token
router.post("/auth/request", async (req, res): Promise<void> => {
  const parsed = RequestLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }

  if (!canDeliverMagicLinks()) {
    res.status(503).json({ error: "Email login is not configured" });
    return;
  }

  const email = parsed.data.email.toLowerCase().trim();
  const [ipLimit, emailLimit] = await Promise.all([
    consumeRateLimit("auth-request-ip", req.ip ?? "unknown", 20, 60 * 60 * 1000),
    consumeRateLimit("auth-request-email", email, 5, 60 * 60 * 1000),
  ]);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    res.status(429).json({ error: "Too many login requests. Please try again later." });
    return;
  }

  const records = await db.select().from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (records.length === 0) {
    // Don't reveal whether email exists — send generic response
    res.json({ sent: true });
    return;
  }

  const record = records[0];
  try {
    const result = await issueMagicLink(record);
    req.log.info({ userId: record.id }, "Magic login link requested");
    res.json(result);
  } catch (error) {
    req.log.error({ err: error, userId: record.id }, "Magic login delivery failed");
    res.status(502).json({ error: "Login email could not be delivered. Please try again." });
  }
});

// POST /api/auth/verify — validate magic token, return key info
router.post("/auth/verify", async (req, res): Promise<void> => {
  const parsed = VerifyTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid token format" });
    return;
  }

  const { token } = parsed.data;
  const [record] = await db.update(usersTable)
    .set({ loginToken: null, loginTokenExpiry: null, emailVerifiedAt: new Date() })
    .where(and(
      eq(usersTable.loginToken, hashToken(token)),
      gt(usersTable.loginTokenExpiry, new Date()),
    ))
    .returning();

  if (!record) {
    res.status(401).json({ error: "Invalid or expired login link" });
    return;
  }

  const [site] = await db.select({
    id: apiKeysTable.id,
    key: apiKeysTable.key,
    name: apiKeysTable.name,
    website: apiKeysTable.website,
    isActive: apiKeysTable.isActive,
  }).from(organizationMembersTable)
    .innerJoin(apiKeysTable, eq(apiKeysTable.organizationId, organizationMembersTable.organizationId))
    .where(eq(organizationMembersTable.userId, record.id))
    .limit(1);

  if (!site?.isActive) {
    res.status(403).json({ error: "No active site is available for this account" });
    return;
  }

  await createDashboardSession(res, record.id, site.id);
  res.json({
    name: site.name,
    email: record.email,
    website: site.website,
    key: site.key,
  });
});

router.get("/auth/session", requireDashboardSession, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [record] = await db.select({
    name: apiKeysTable.name,
    email: usersTable.email,
    website: apiKeysTable.website,
    key: apiKeysTable.key,
    userId: usersTable.id,
  }).from(dashboardSessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, dashboardSessionsTable.userId))
    .innerJoin(apiKeysTable, eq(apiKeysTable.id, dashboardSessionsTable.apiKeyId))
    .where(eq(dashboardSessionsTable.id, req.shiftSessionId!))
    .limit(1);
  if (!record) {
    res.status(401).json({ error: "Account not found" });
    return;
  }
  res.json(record);
});

router.post("/auth/logout", requireDashboardSession, async (req: AuthenticatedRequest, res): Promise<void> => {
  await db.delete(dashboardSessionsTable).where(eq(dashboardSessionsTable.id, req.shiftSessionId!));
  res.clearCookie("shift_session", { path: "/" });
  res.status(204).send();
});

export default router;
