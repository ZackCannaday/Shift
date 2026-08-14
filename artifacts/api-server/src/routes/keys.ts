import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiKeysTable, db, organizationMembersTable, organizationsTable, usersTable } from "@workspace/db";
import { canDeliverMagicLinks, issueMagicLink } from "../lib/magic-link";
import { consumeRateLimit } from "../lib/rate-limit";

const router: IRouter = Router();

const CreateKeyBody = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  website: z.string().url(),
});

router.post("/keys", async (req, res): Promise<void> => {
  const parsed = CreateKeyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const { name, website } = parsed.data;
  const email = parsed.data.email.toLowerCase().trim();
  if (!canDeliverMagicLinks()) {
    res.status(503).json({ error: "Email verification is not configured" });
    return;
  }

  const [ipLimit, emailLimit] = await Promise.all([
    consumeRateLimit("registration-ip", req.ip ?? "unknown", 10, 60 * 60 * 1000),
    consumeRateLimit("registration-email", email, 3, 60 * 60 * 1000),
  ]);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    res.status(429).json({ error: "Too many registration attempts. Please try again later." });
    return;
  }

  let user: typeof usersTable.$inferSelect;
  try {
    user = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
      if (existing) return existing;

      const [createdUser] = await tx.insert(usersTable).values({ email, name }).returning();
      const [organization] = await tx.insert(organizationsTable).values({ name }).returning();
      await tx.insert(organizationMembersTable).values({
        organizationId: organization.id,
        userId: createdUser.id,
        role: "owner",
      });
      await tx.insert(apiKeysTable).values({
        organizationId: organization.id,
        key: "pk_shift_" + randomBytes(16).toString("hex"),
        name,
        email,
        website,
      });
      return createdUser;
    });

  } catch (err: any) {
    if (err?.code === "23505") {
      const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
      if (existing) user = existing;
      else {
        req.log.error({ err }, "Registration conflict could not be resolved");
        res.status(409).json({ error: "Workspace creation conflicted. Please try again." });
        return;
      }
    } else {
      req.log.error({ err }, "Failed to create workspace");
      res.status(500).json({ error: "Failed to create workspace" });
      return;
    }
  }

  try {
    const result = await issueMagicLink(user);
    res.status(202).json({ ...result, verificationRequired: true });
  } catch (err) {
    req.log.error({ err, userId: user.id }, "Verification email delivery failed");
    res.status(502).json({ error: "Verification email could not be delivered. Please try again." });
  }
});

router.get("/keys/:key", async (req, res): Promise<void> => {
  const key = req.params.key;
  if (!key || !key.startsWith("pk_shift_")) {
    res.status(400).json({ error: "Invalid key format" });
    return;
  }

  const [record] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.key, key)).limit(1);

  if (!record) {
    res.status(404).json({ error: "Key not found" });
    return;
  }

  res.json({
    id: record.id,
    name: record.name,
    isActive: record.isActive,
  });
});

export default router;
