import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, apiKeysTable } from "@workspace/db";
import { ProviderName } from "../lib/personalization";
import { encryptSecret } from "../lib/security";
import {
  requireDashboardSession,
  type AuthenticatedRequest,
} from "../middlewares/dashboard-auth";

const router: IRouter = Router();
router.use("/settings", requireDashboardSession);

const UpdateAiSettings = z.object({
  provider: ProviderName,
  model: z.string().trim().max(120).optional().nullable(),
  apiKey: z.string().trim().min(12).max(500).optional(),
});

export function canRetainProviderCredential(
  currentProvider: string | null,
  nextProvider: string,
  hasCredential: boolean,
): boolean {
  return hasCredential && currentProvider === nextProvider;
}

router.get(
  "/settings/ai",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const [record] = await db
      .select({
        provider: apiKeysTable.aiProvider,
        model: apiKeysTable.aiModel,
        configured: apiKeysTable.aiApiKeyEncrypted,
      })
      .from(apiKeysTable)
      .where(eq(apiKeysTable.id, req.shiftSiteId!))
      .limit(1);
    res.json({
      provider: record?.provider ?? "rules",
      model: record?.model ?? null,
      configured: Boolean(record?.configured),
    });
  },
);

router.put(
  "/settings/ai",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const parsed = UpdateAiSettings.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error: "Invalid AI provider settings",
          details: parsed.error.issues,
        });
      return;
    }

    // # Credential ownership
    let retainedCredential = false;
    if (parsed.data.provider !== "rules" && !parsed.data.apiKey) {
      const [current] = await db
        .select({
          provider: apiKeysTable.aiProvider,
          configured: apiKeysTable.aiApiKeyEncrypted,
        })
        .from(apiKeysTable)
        .where(eq(apiKeysTable.id, req.shiftSiteId!))
        .limit(1);
      if (!current?.configured) {
        res
          .status(400)
          .json({ error: "An API key is required for this provider" });
        return;
      }
      if (
        !canRetainProviderCredential(
          current.provider,
          parsed.data.provider,
          Boolean(current.configured),
        )
      ) {
        res
          .status(400)
          .json({
            error: "A new API key is required when changing AI providers",
          });
        return;
      }
      retainedCredential = true;
    }

    // # Settings update
    const values: Partial<typeof apiKeysTable.$inferInsert> = {
      aiProvider: parsed.data.provider,
      aiModel: parsed.data.model || null,
    };
    if (parsed.data.apiKey) {
      try {
        values.aiApiKeyEncrypted = encryptSecret(parsed.data.apiKey);
      } catch {
        res
          .status(503)
          .json({
            error:
              "Provider credential encryption is not configured on this Shift server",
          });
        return;
      }
    }
    if (parsed.data.provider === "rules") values.aiApiKeyEncrypted = null;

    await db
      .update(apiKeysTable)
      .set(values)
      .where(eq(apiKeysTable.id, req.shiftSiteId!));
    res.json({
      provider: parsed.data.provider,
      model: parsed.data.model || null,
      configured:
        parsed.data.provider !== "rules" &&
        (Boolean(parsed.data.apiKey) || retainedCredential),
    });
  },
);

export default router;
