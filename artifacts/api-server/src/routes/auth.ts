import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, apiKeysTable, dashboardSessionsTable } from "@workspace/db";
import { createDashboardSession } from "../lib/dashboard-session";
import { hashToken } from "../lib/security";
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

  const { email } = parsed.data;
  const records = await db.select().from(apiKeysTable)
    .where(eq(apiKeysTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (records.length === 0) {
    // Don't reveal whether email exists — send generic response
    res.json({ sent: true });
    return;
  }

  const record = records[0];
  const token = randomBytes(20).toString("hex"); // sent to the account owner only
  const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 min

  await db.update(apiKeysTable)
    .set({ loginToken: hashToken(token), loginTokenExpiry: expiry })
    .where(eq(apiKeysTable.id, record.id));

  // An email adapter can consume this event in production. Never return a login
  // token unless a developer has explicitly enabled local-only auth links.
  req.log.info({ accountId: record.id }, "Magic login link requested");
  res.json(process.env.ALLOW_DEV_AUTH_TOKENS === "true"
    ? { sent: true, _devToken: token, _devName: record.name }
    : { sent: true });
});

// POST /api/auth/verify — validate magic token, return key info
router.post("/auth/verify", async (req, res): Promise<void> => {
  const parsed = VerifyTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid token format" });
    return;
  }

  const { token } = parsed.data;
  const [record] = await db.select().from(apiKeysTable)
    .where(eq(apiKeysTable.loginToken, hashToken(token)))
    .limit(1);

  if (!record) {
    res.status(401).json({ error: "Invalid or expired login link" });
    return;
  }

  if (!record.loginTokenExpiry || new Date() > record.loginTokenExpiry) {
    res.status(401).json({ error: "Login link has expired. Please request a new one." });
    return;
  }

  if (!record.isActive) {
    res.status(403).json({ error: "This account is inactive" });
    return;
  }

  // Consume the token (one-time use)
  await db.update(apiKeysTable)
    .set({ loginToken: null, loginTokenExpiry: null })
    .where(eq(apiKeysTable.id, record.id));

  await createDashboardSession(res, record.id);
  res.json({
    name: record.name,
    email: record.email,
    website: record.website,
  });
});

router.get("/auth/session", requireDashboardSession, async (req: AuthenticatedRequest, res): Promise<void> => {
  const [record] = await db.select({ name: apiKeysTable.name, email: apiKeysTable.email, website: apiKeysTable.website })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.id, req.shiftSiteId!))
    .limit(1);
  if (!record) {
    res.status(401).json({ error: "Account not found" });
    return;
  }
  res.json(record);
});

router.post("/auth/logout", requireDashboardSession, async (req: AuthenticatedRequest, res): Promise<void> => {
  await db.delete(dashboardSessionsTable).where(eq(dashboardSessionsTable.apiKeyId, req.shiftSiteId!));
  res.clearCookie("shift_session", { path: "/" });
  res.status(204).send();
});

export default router;
