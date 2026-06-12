import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, apiKeysTable } from "@workspace/db";

const router: IRouter = Router();

const CreateKeyBody = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  website: z.string().url().optional(),
});

router.post("/keys", async (req, res): Promise<void> => {
  const parsed = CreateKeyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const { name, email, website } = parsed.data;
  const key = "sk_live_" + randomBytes(16).toString("hex");

  try {
    const [created] = await db.insert(apiKeysTable).values({
      key,
      name,
      email,
      website: website ?? null,
    }).returning();

    res.status(201).json({
      id: created.id,
      key: created.key,
      name: created.name,
      email: created.email,
      website: created.website,
      createdAt: created.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create API key");
    res.status(500).json({ error: "Failed to create key" });
  }
});

router.get("/keys/:key", async (req, res): Promise<void> => {
  const key = req.params.key;
  if (!key || !key.startsWith("sk_live_")) {
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
    email: record.email,
    website: record.website,
    isActive: record.isActive,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
  });
});

export default router;
