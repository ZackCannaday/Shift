import { Router, type IRouter } from "express";
import { eq, desc, count, sql, avg } from "drizzle-orm";
import { db, visitorsTable } from "@workspace/db";
import {
  ListVisitorsQueryParams,
  CreateVisitorBody,
  GetVisitorParams,
  UpdateVisitorParams,
  UpdateVisitorBody,
  DetectIntentBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ─── Rule-based persona detection ────────────────────────────────────────────

const FUNNEL_CONTENT = {
  technical: {
    headlines: [
      "Deploy in Minutes, Not Days",
      "Built for Engineers Who Hate Waiting",
      "The API-First Way to Ship Faster",
    ],
    subheadlines: [
      "A platform built for engineers who value speed and control.",
      "Zero config, full power. Your stack, your rules.",
      "Open API, instant feedback loops, and zero lock-in.",
    ],
    ctaTexts: ["View the Docs", "Explore the API", "Start Building"],
    funnelTheme: "Ship Faster",
    reasoning: "Technical signals detected — GitHub referrer or dev-related UTM source.",
  },
  business: {
    headlines: [
      "Turn Every Visitor Into a Conversation",
      "Stop Pitching Everyone the Same Way",
      "Personalization That Pays for Itself",
    ],
    subheadlines: [
      "Every visitor gets a pitch tailored to what they actually care about.",
      "AI reads the room so your site doesn't have to guess.",
      "More relevance, higher conversion, less guesswork.",
    ],
    ctaTexts: ["See How It Works", "Get a Demo", "Calculate Your ROI"],
    funnelTheme: "Scale Smarter",
    reasoning: "Business signals detected — LinkedIn referrer or professional UTM source.",
  },
  creator: {
    headlines: [
      "Your Site. Their Story.",
      "A Canvas That Rewrites Itself",
      "Design That Knows Its Audience",
    ],
    subheadlines: [
      "Beautiful experiences that shape themselves around every single visitor.",
      "Your brand, their context — perfectly matched, every time.",
      "The most personal site your audience has ever seen.",
    ],
    ctaTexts: ["Start Creating", "See It Live", "Build Something Beautiful"],
    funnelTheme: "Build Beautiful",
    reasoning: "Creator signals detected — design community referrer or social UTM source.",
  },
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function ruleBasedDetect(signals: string): {
  persona: "technical" | "business" | "creator";
  confidence: number;
} {
  const s = signals.toLowerCase();

  const techScore =
    (s.includes("github") ? 3 : 0) +
    (s.includes("hackernews") || s.includes("ycombinator") ? 3 : 0) +
    (s.includes("stackoverflow") || s.includes("dev.to") ? 2 : 0) +
    (s.includes("npm") || s.includes("vercel") || s.includes("netlify") ? 2 : 0) +
    (/\b(api|sdk|cli|docs|engineer|developer|dev|code|tech|programming|software)\b/.test(s) ? 2 : 0) +
    (/\b(utm_source=github|utm_source=hn|utm_source=dev)\b/.test(s) ? 2 : 0);

  const bizScore =
    (s.includes("linkedin") ? 3 : 0) +
    (s.includes("google") && s.includes("cpc") ? 2 : 0) +
    (/\b(enterprise|b2b|saas|startup|roi|growth|revenue|business|ceo|cto|founder|executive|manager|product)\b/.test(s) ? 2 : 0) +
    (/\b(utm_source=linkedin|utm_medium=email|utm_campaign=enterprise)\b/.test(s) ? 2 : 0);

  const creatorScore =
    (s.includes("dribbble") || s.includes("behance") ? 3 : 0) +
    (s.includes("twitter") || s.includes("instagram") || s.includes("tiktok") ? 2 : 0) +
    (s.includes("producthunt") || s.includes("product hunt") ? 2 : 0) +
    (/\b(design|creative|content|marketing|brand|visual|ui|ux|maker|artist|creator)\b/.test(s) ? 2 : 0) +
    (/\b(utm_source=twitter|utm_source=instagram|utm_medium=social)\b/.test(s) ? 2 : 0);

  const max = Math.max(techScore, bizScore, creatorScore);

  if (max === 0) {
    // No strong signals — use time-of-day as a lightweight tiebreaker
    const hour = new Date().getUTCHours();
    if (hour >= 9 && hour < 17) return { persona: "business", confidence: 0.45 };
    return { persona: "technical", confidence: 0.4 };
  }

  const total = techScore + bizScore + creatorScore || 1;
  if (techScore === max) return { persona: "technical", confidence: Math.min(0.95, 0.5 + techScore / total * 0.6) };
  if (bizScore === max) return { persona: "business", confidence: Math.min(0.95, 0.5 + bizScore / total * 0.6) };
  return { persona: "creator", confidence: Math.min(0.95, 0.5 + creatorScore / total * 0.6) };
}

async function detectWithAI(signals: string, referrer?: string, utmSource?: string, utmMedium?: string, utmCampaign?: string, userAgent?: string, deviceType?: string, pageTitle?: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.startsWith("sk-")) return null;

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });

    const prompt = `You are an expert at detecting visitor intent on websites based on their context signals.

Analyze these visitor signals and determine which of three personas they most likely belong to:
- technical: Developer, engineer, or technical evaluator. Signals: GitHub refs, dev/tech UTMs, API docs references, engineering roles.
- business: Executive, founder, product manager, or business decision-maker. Signals: LinkedIn, business UTMs, enterprise/ROI language, growth/startup refs.
- creator: Designer, content creator, marketer, or builder. Signals: Dribbble/Behance, design/creative UTMs, marketing refs, social media.

Visitor context:
- Referrer URL: ${referrer || "direct/unknown"}
- UTM Source: ${utmSource || "none"}
- UTM Medium: ${utmMedium || "none"}
- UTM Campaign: ${utmCampaign || "none"}
- Device type: ${deviceType || "unknown"}
- User agent: ${userAgent || "unknown"}
- Page title context: ${pageTitle || "none"}

Respond with a JSON object ONLY (no markdown):
{
  "persona": "technical" | "business" | "creator",
  "confidence": 0.0-1.0,
  "reasoning": "one sentence explaining the key signals",
  "headline": "A punchy, personalized headline for this visitor (max 10 words)",
  "subheadline": "A compelling subheadline tailored to this persona (max 20 words)",
  "ctaText": "Call to action button text (3-5 words)",
  "funnelTheme": "A short theme label (e.g. 'Ship Faster', 'Scale Smarter', 'Build Beautiful')"
}`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

router.get("/visitors", async (req, res): Promise<void> => {
  const params = ListVisitorsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { limit = 50, offset = 0, persona } = params.data;

  if (persona) {
    const rows = await db.select().from(visitorsTable)
      .where(eq(visitorsTable.persona, persona))
      .orderBy(desc(visitorsTable.createdAt))
      .limit(limit).offset(offset);
    res.json(rows);
    return;
  }

  const rows = await db.select().from(visitorsTable)
    .orderBy(desc(visitorsTable.createdAt))
    .limit(limit).offset(offset);
  res.json(rows);
});

router.post("/visitors", async (req, res): Promise<void> => {
  const parsed = CreateVisitorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [visitor] = await db.insert(visitorsTable).values(parsed.data).returning();
  res.status(201).json(visitor);
});

router.post("/visitors/detect-intent", async (req, res): Promise<void> => {
  const parsed = DetectIntentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { sessionId, referrer, utmSource, utmMedium, utmCampaign, userAgent, deviceType, pageTitle } = parsed.data;
  const signals = [referrer, utmSource, utmMedium, utmCampaign, userAgent, pageTitle].filter(Boolean).join(" ");

  // Try AI first, fall back to rule-based
  const aiResult = await detectWithAI(signals, referrer, utmSource, utmMedium, utmCampaign, userAgent, deviceType, pageTitle);

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

  // Upsert visitor record
  let visitorId: number | null = null;
  try {
    const existing = await db.select().from(visitorsTable).where(eq(visitorsTable.sessionId, sessionId)).limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(visitorsTable)
        .set({ persona, personaConfidence: confidence, headline, subheadline, ctaText, intentSignals: signals.slice(0, 500) })
        .where(eq(visitorsTable.sessionId, sessionId))
        .returning();
      visitorId = updated?.id ?? null;
    } else {
      const [created] = await db.insert(visitorsTable).values({
        sessionId,
        referrer: referrer ?? null,
        utmSource: utmSource ?? null,
        utmMedium: utmMedium ?? null,
        utmCampaign: utmCampaign ?? null,
        userAgent: userAgent ?? null,
        deviceType: deviceType ?? null,
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
    req.log.warn({ err: dbErr }, "Failed to save visitor");
  }

  res.json({ persona, confidence, headline, subheadline, ctaText, funnelTheme, reasoning, visitorId });
});

router.get("/visitors/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetVisitorParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [visitor] = await db.select().from(visitorsTable).where(eq(visitorsTable.id, params.data.id));
  if (!visitor) {
    res.status(404).json({ error: "Visitor not found" });
    return;
  }
  res.json(visitor);
});

router.patch("/visitors/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateVisitorParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateVisitorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [visitor] = await db.update(visitorsTable)
    .set(parsed.data)
    .where(eq(visitorsTable.id, params.data.id))
    .returning();
  if (!visitor) {
    res.status(404).json({ error: "Visitor not found" });
    return;
  }
  res.json(visitor);
});

export default router;
