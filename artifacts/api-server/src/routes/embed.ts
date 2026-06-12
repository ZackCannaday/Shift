import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, apiKeysTable, visitorsTable } from "@workspace/db";

const router: IRouter = Router();

// ─── In-memory rate limiter ───────────────────────────────────────────────────
// 100 requests per hour per API key (resets per rolling window)
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries every 10 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitStore.entries()) {
    if (now > v.resetAt) rateLimitStore.delete(k);
  }
}, 10 * 60 * 1000);

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + RATE_WINDOW_MS;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT - 1, resetAt };
  }

  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT - entry.count, resetAt: entry.resetAt };
}

// ─── Persona detection helpers ────────────────────────────────────────────────

const FUNNEL_CONTENT = {
  technical: {
    headlines: ["Deploy in Minutes, Not Days", "Built for Engineers Who Hate Waiting", "The API-First Way to Ship Faster"],
    subheadlines: ["A platform built for engineers who value speed and control.", "Zero config, full power. Your stack, your rules.", "Open API, instant feedback loops, and zero lock-in."],
    ctaTexts: ["View the Docs", "Explore the API", "Start Building"],
    funnelTheme: "Ship Faster",
    reasoning: "Technical signals detected from visitor context.",
  },
  business: {
    headlines: ["Turn Every Visitor Into a Conversation", "Stop Pitching Everyone the Same Way", "Personalization That Pays for Itself"],
    subheadlines: ["Every visitor gets a pitch tailored to what they actually care about.", "AI reads the room so your site doesn't have to guess.", "More relevance, higher conversion, less guesswork."],
    ctaTexts: ["See How It Works", "Get a Demo", "Calculate Your ROI"],
    funnelTheme: "Scale Smarter",
    reasoning: "Business signals detected from visitor context.",
  },
  creator: {
    headlines: ["Your Site. Their Story.", "A Canvas That Rewrites Itself", "Design That Knows Its Audience"],
    subheadlines: ["Beautiful experiences that shape themselves around every single visitor.", "Your brand, their context — perfectly matched, every time.", "The most personal site your audience has ever seen."],
    ctaTexts: ["Start Creating", "See It Live", "Build Something Beautiful"],
    funnelTheme: "Build Beautiful",
    reasoning: "Creator signals detected from visitor context.",
  },
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function ruleBasedDetect(signals: string): { persona: "technical" | "business" | "creator"; confidence: number } {
  const s = signals.toLowerCase();
  const tech = (s.includes("github") ? 3 : 0) + (s.includes("stackoverflow") || s.includes("dev.to") ? 2 : 0) + (s.includes("npm") || s.includes("vercel") ? 2 : 0) + (/\b(api|sdk|cli|docs|engineer|developer|dev|code|tech|software)\b/.test(s) ? 2 : 0);
  const biz = (s.includes("linkedin") ? 3 : 0) + (/\b(enterprise|b2b|saas|roi|growth|revenue|business|ceo|founder|executive)\b/.test(s) ? 2 : 0) + (s.includes("google") && s.includes("cpc") ? 2 : 0);
  const creator = (s.includes("dribbble") || s.includes("behance") ? 3 : 0) + (s.includes("twitter") || s.includes("instagram") ? 2 : 0) + (s.includes("producthunt") ? 2 : 0) + (/\b(design|creative|content|marketing|brand|visual|ui|ux|maker|creator)\b/.test(s) ? 2 : 0);
  const max = Math.max(tech, biz, creator);
  if (max === 0) { const h = new Date().getUTCHours(); return { persona: h >= 9 && h < 17 ? "business" : "technical", confidence: 0.4 }; }
  const total = tech + biz + creator || 1;
  if (tech === max) return { persona: "technical", confidence: Math.min(0.95, 0.5 + tech / total * 0.6) };
  if (biz === max) return { persona: "business", confidence: Math.min(0.95, 0.5 + biz / total * 0.6) };
  return { persona: "creator", confidence: Math.min(0.95, 0.5 + creator / total * 0.6) };
}

async function tryOpenAI(data: z.infer<typeof DetectEmbedBody>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.startsWith("sk-")) return null;
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });
    const prompt = `Analyze visitor signals and return JSON only:
{"persona":"technical"|"business"|"creator","confidence":0.0-1.0,"reasoning":"one sentence","headline":"max 10 words","subheadline":"max 20 words","ctaText":"3-5 words","funnelTheme":"short label"}
Signals: referrer=${data.referrer || "direct"} utm_source=${data.utmSource || "none"} device=${data.deviceType || "unknown"} ua=${(data.userAgent || "").slice(0, 120)}`;
    const completion = await client.chat.completions.create({ model: "gpt-4o-mini", max_tokens: 256, messages: [{ role: "user", content: prompt }] });
    return JSON.parse(completion.choices[0]?.message?.content ?? "{}");
  } catch { return null; }
}

const DetectEmbedBody = z.object({
  key: z.string().startsWith("sk_live_"),
  sessionId: z.string().min(1).max(200),
  pageUrl: z.string().optional(),
  pageTitle: z.string().optional(),
  referrer: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  userAgent: z.string().optional(),
  deviceType: z.enum(["mobile", "tablet", "desktop"]).optional(),
});

router.post("/embed/detect", async (req, res): Promise<void> => {
  const parsed = DetectEmbedBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    return;
  }

  const data = parsed.data;

  // Validate API key
  const [keyRecord] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.key, data.key)).limit(1);
  if (!keyRecord || !keyRecord.isActive) {
    res.status(401).json({ error: "Invalid or inactive API key" });
    return;
  }

  // Rate limit check (per API key)
  const rl = checkRateLimit(data.key);
  res.setHeader("X-RateLimit-Limit", RATE_LIMIT);
  res.setHeader("X-RateLimit-Remaining", rl.remaining);
  res.setHeader("X-RateLimit-Reset", Math.ceil(rl.resetAt / 1000));

  if (!rl.allowed) {
    res.status(429).json({
      error: "Rate limit exceeded",
      message: `Free tier allows ${RATE_LIMIT} detections per hour. Resets at ${new Date(rl.resetAt).toISOString()}.`,
      retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000),
    });
    return;
  }

  // Update lastUsedAt in background
  db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.key, data.key)).catch(() => {});

  const signals = [data.referrer, data.utmSource, data.utmMedium, data.utmCampaign, data.userAgent, data.pageTitle].filter(Boolean).join(" ");

  const aiResult = await tryOpenAI(data);

  let persona: "technical" | "business" | "creator";
  let confidence: number;
  let reasoning: string;
  let headline: string;
  let subheadline: string;
  let ctaText: string;
  let funnelTheme: string;

  if (aiResult && typeof aiResult.persona === "string" && ["technical", "business", "creator"].includes(aiResult.persona)) {
    persona = aiResult.persona as "technical" | "business" | "creator";
    confidence = typeof aiResult.confidence === "number" ? aiResult.confidence : 0.75;
    reasoning = String(aiResult.reasoning ?? "AI-detected from visitor signals.");
    headline = String(aiResult.headline ?? pick(FUNNEL_CONTENT[persona].headlines));
    subheadline = String(aiResult.subheadline ?? pick(FUNNEL_CONTENT[persona].subheadlines));
    ctaText = String(aiResult.ctaText ?? pick(FUNNEL_CONTENT[persona].ctaTexts));
    funnelTheme = String(aiResult.funnelTheme ?? FUNNEL_CONTENT[persona].funnelTheme);
  } else {
    const detected = ruleBasedDetect(signals);
    persona = detected.persona;
    confidence = detected.confidence;
    const content = FUNNEL_CONTENT[persona];
    reasoning = content.reasoning;
    headline = pick(content.headlines);
    subheadline = pick(content.subheadlines);
    ctaText = pick(content.ctaTexts);
    funnelTheme = content.funnelTheme;
  }

  let visitorId: number | null = null;
  try {
    const existing = await db.select().from(visitorsTable).where(eq(visitorsTable.sessionId, data.sessionId)).limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(visitorsTable)
        .set({ persona, personaConfidence: confidence, headline, subheadline, ctaText, intentSignals: signals.slice(0, 500) })
        .where(eq(visitorsTable.sessionId, data.sessionId))
        .returning();
      visitorId = updated?.id ?? null;
    } else {
      const [created] = await db.insert(visitorsTable).values({
        apiKeyId: keyRecord.id,
        sessionId: data.sessionId,
        referrer: data.referrer ?? null,
        utmSource: data.utmSource ?? null,
        utmMedium: data.utmMedium ?? null,
        utmCampaign: data.utmCampaign ?? null,
        userAgent: data.userAgent ?? null,
        deviceType: data.deviceType ?? null,
        intentSignals: signals.slice(0, 500),
        persona,
        personaConfidence: confidence,
        headline,
        subheadline,
        ctaText,
      }).returning();
      visitorId = created?.id ?? null;
    }
  } catch (dbErr) {
    req.log.warn({ err: dbErr }, "Failed to save embed visitor");
  }

  res.json({ persona, confidence, headline, subheadline, ctaText, funnelTheme, reasoning, visitorId });
});

export default router;
