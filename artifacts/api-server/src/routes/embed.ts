import { Router, type IRouter, type Request } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  apiKeysTable,
  contentAllocationsTable,
  contentTargetsTable,
  contentVariantsTable,
  db,
  visitorsTable,
} from "@workspace/db";
import { personalizeWithProvider } from "../lib/ai-providers";
import {
  ProviderName,
  ruleBasedPersonalization,
  type VisitorSignals,
} from "../lib/personalization";
import { decryptSecret, sanitizeUrl } from "../lib/security";
import { consumeRateLimit } from "../lib/rate-limit";
import {
  issueEmbedEventToken,
  verifyEmbedEventToken,
} from "../lib/event-token";
import { selectApprovedContent } from "../lib/content-selection";

const router: IRouter = Router();
const RATE_LIMIT = 300;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const PublicKey = z
  .string()
  .min(16)
  .max(128)
  .refine(
    (value) => value.startsWith("pk_shift_") || value.startsWith("sk_live_"),
    "Invalid publishable key",
  );
const DetectEmbedBody = z.object({
  key: PublicKey,
  sessionId: z.string().min(8).max(200),
  pageUrl: z.string().max(2000).optional(),
  pageTitle: z.string().max(300).optional(),
  referrer: z.string().max(2000).optional(),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  userAgent: z.string().max(500).optional(),
  deviceType: z.enum(["mobile", "tablet", "desktop"]).optional(),
});
const TrackEventBody = z.object({
  key: PublicKey,
  sessionId: z.string().min(8).max(200),
  eventToken: z.string().min(64).max(1024),
  event: z.enum(["conversion", "session_end"]),
  name: z.string().min(1).max(100).optional(),
  timeOnSite: z.number().int().min(0).max(86400).optional(),
});

function isAllowedOrigin(req: Request, website?: string | null): boolean {
  if (!website || process.env.NODE_ENV === "development") return true;
  const origin = req.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).hostname === new URL(website).hostname;
  } catch {
    return false;
  }
}

async function findSite(key: string) {
  const [site] = await db
    .select()
    .from(apiKeysTable)
    .where(eq(apiKeysTable.key, key))
    .limit(1);
  return site;
}

router.post("/embed/detect", async (req, res): Promise<void> => {
  const parsed = DetectEmbedBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;
  const site = await findSite(data.key);
  if (!site?.isActive) {
    res.status(401).json({ error: "Invalid or inactive publishable key" });
    return;
  }
  if (!isAllowedOrigin(req, site.website)) {
    res
      .status(403)
      .json({ error: "This origin is not allowed for the supplied key" });
    return;
  }

  const rateLimit = await consumeRateLimit(
    "embed-detect",
    `${site.id}:${req.ip ?? "unknown"}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  res.setHeader("X-RateLimit-Limit", RATE_LIMIT);
  res.setHeader("X-RateLimit-Remaining", rateLimit.remaining);
  res.setHeader("X-RateLimit-Reset", Math.ceil(rateLimit.resetAt / 1000));
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: "Rate limit exceeded",
      retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
    });
    return;
  }

  let eventAuthorization: ReturnType<typeof issueEmbedEventToken>;
  try {
    eventAuthorization = issueEmbedEventToken({
      siteId: site.id,
      sessionId: data.sessionId,
    });
  } catch (error) {
    req.log.error(
      { err: error, siteId: site.id },
      "Embed event signing is not configured",
    );
    res.status(503).json({ error: "Event authorization is unavailable" });
    return;
  }

  const signals: VisitorSignals = {
    referrer: sanitizeUrl(data.referrer),
    utmSource: data.utmSource,
    utmMedium: data.utmMedium,
    utmCampaign: data.utmCampaign,
    userAgent: data.userAgent,
    deviceType: data.deviceType,
    pageTitle: data.pageTitle,
  };
  let result = ruleBasedPersonalization(signals);
  const provider = ProviderName.catch("rules").parse(site.aiProvider);
  if (provider !== "rules" && site.aiApiKeyEncrypted) {
    try {
      result = await personalizeWithProvider({
        provider,
        apiKey: decryptSecret(site.aiApiKeyEncrypted),
        model: site.aiModel,
        signals,
        siteName: site.name,
        website: site.website,
      });
    } catch (error) {
      req.log.warn(
        { provider, err: error },
        "AI provider failed; using rules fallback",
      );
    }
  }

  // Approved runtime content
  const runtimeTargets = await db
    .select({
      targetId: contentTargetsTable.id,
      targetKey: contentTargetsTable.targetKey,
      targetType: contentTargetsTable.targetType,
      pagePath: contentTargetsTable.pagePath,
      fallbackContent: contentTargetsTable.fallbackContent,
      variantId: contentVariantsTable.id,
      variantVersion: contentVariantsTable.version,
      variantContent: contentVariantsTable.content,
      controlPercentage: contentAllocationsTable.controlPercentage,
    })
    .from(contentTargetsTable)
    .innerJoin(
      contentAllocationsTable,
      and(
        eq(contentAllocationsTable.apiKeyId, contentTargetsTable.apiKeyId),
        eq(contentAllocationsTable.targetId, contentTargetsTable.id),
        eq(contentAllocationsTable.isActive, true),
      ),
    )
    .innerJoin(
      contentVariantsTable,
      and(
        eq(contentVariantsTable.apiKeyId, contentTargetsTable.apiKeyId),
        eq(contentVariantsTable.targetId, contentTargetsTable.id),
        eq(contentVariantsTable.id, contentAllocationsTable.variantId),
        eq(contentVariantsTable.status, "approved"),
      ),
    )
    .where(
      and(
        eq(contentTargetsTable.apiKeyId, site.id),
        eq(contentTargetsTable.isActive, true),
      ),
    );
  const selection = selectApprovedContent({
    siteId: site.id,
    sessionId: data.sessionId,
    pageUrl: data.pageUrl,
    targets: runtimeTargets,
  });

  const values = {
    persona: result.persona,
    personaConfidence: result.confidence,
    headline: selection.content.headline ?? null,
    subheadline: selection.content.subheadline ?? null,
    ctaText: selection.content.ctaText ?? null,
    intentSignals: JSON.stringify(signals).slice(0, 1000),
  };
  const where = and(
    eq(visitorsTable.apiKeyId, site.id),
    eq(visitorsTable.sessionId, data.sessionId),
  );
  const [existing] = await db
    .select({ id: visitorsTable.id })
    .from(visitorsTable)
    .where(where)
    .limit(1);
  let visitorId: number;
  if (existing) {
    await db
      .update(visitorsTable)
      .set(values)
      .where(
        and(
          eq(visitorsTable.id, existing.id),
          eq(visitorsTable.apiKeyId, site.id),
        ),
      );
    visitorId = existing.id;
  } else {
    const [created] = await db
      .insert(visitorsTable)
      .values({
        apiKeyId: site.id,
        sessionId: data.sessionId,
        referrer: sanitizeUrl(data.referrer) ?? null,
        utmSource: data.utmSource ?? null,
        utmMedium: data.utmMedium ?? null,
        utmCampaign: data.utmCampaign ?? null,
        userAgent: data.userAgent ?? null,
        deviceType: data.deviceType ?? null,
        ...values,
      })
      .returning({ id: visitorsTable.id });
    visitorId = created.id;
  }

  db.update(apiKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeysTable.id, site.id))
    .catch(() => {});
  res.json({
    persona: result.persona,
    confidence: result.confidence,
    contentConfigured: selection.contentConfigured,
    assignments: selection.assignments,
    ...(selection.content.headline !== undefined
      ? { headline: selection.content.headline }
      : {}),
    ...(selection.content.subheadline !== undefined
      ? { subheadline: selection.content.subheadline }
      : {}),
    ...(selection.content.ctaText !== undefined
      ? { ctaText: selection.content.ctaText }
      : {}),
    visitorId,
    eventToken: eventAuthorization.token,
    eventTokenExpiresAt: eventAuthorization.expiresAt,
  });
});

router.post("/embed/events", async (req, res): Promise<void> => {
  const parsed = TrackEventBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid event", details: parsed.error.issues });
    return;
  }
  const site = await findSite(parsed.data.key);
  if (!site?.isActive || !isAllowedOrigin(req, site.website)) {
    res.status(403).json({ error: "Event rejected" });
    return;
  }
  try {
    const authorization = verifyEmbedEventToken(parsed.data.eventToken, {
      siteId: site.id,
      sessionId: parsed.data.sessionId,
    });
    if (!authorization) {
      res.status(401).json({ error: "Invalid or expired event authorization" });
      return;
    }
  } catch (error) {
    req.log.error(
      { err: error, siteId: site.id },
      "Embed event verification is not configured",
    );
    res.status(503).json({ error: "Event authorization is unavailable" });
    return;
  }
  const rateLimit = await consumeRateLimit(
    "embed-event",
    `${site.id}:${req.ip ?? "unknown"}`,
    RATE_LIMIT * 2,
    RATE_WINDOW_MS,
  );
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: "Rate limit exceeded",
      retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
    });
    return;
  }
  const where = and(
    eq(visitorsTable.apiKeyId, site.id),
    eq(visitorsTable.sessionId, parsed.data.sessionId),
  );
  if (parsed.data.event === "conversion") {
    await db
      .update(visitorsTable)
      .set({
        converted: true,
        conversionEvent: parsed.data.name || "cta_click",
      })
      .where(where);
  } else {
    await db
      .update(visitorsTable)
      .set({ timeOnSite: parsed.data.timeOnSite ?? null })
      .where(where);
  }
  res.status(202).json({ accepted: true });
});

export default router;
