import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, apiKeysTable } from "@workspace/db";

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
  const token = randomBytes(20).toString("hex"); // 40-char hex token
  const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 min

  await db.update(apiKeysTable)
    .set({ loginToken: token, loginTokenExpiry: expiry })
    .where(eq(apiKeysTable.id, record.id));

  // In production this would be sent by email.
  // For now we return the token directly so the UI can show it.
  res.json({
    sent: true,
    // Dev-mode only — remove this field when email sending is configured
    _devToken: token,
    _devName: record.name,
  });
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
    .where(eq(apiKeysTable.loginToken, token))
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

  res.json({
    key: record.key,
    name: record.name,
    email: record.email,
    website: record.website,
  });
});

export default router;
