import { Router, type IRouter } from "express";
import { eq, desc, count, sql, avg } from "drizzle-orm";
import { db, visitorsTable } from "@workspace/db";
import { openai } from "../lib/openai";
import {
  ListVisitorsQueryParams,
  CreateVisitorBody,
  GetVisitorParams,
  UpdateVisitorParams,
  UpdateVisitorBody,
  DetectIntentBody,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Persona definitions for AI prompt
const PERSONAS = {
  technical: {
    name: "Technical",
    description: "Developer, engineer, or technical evaluator",
    signals: ["github", "dev", "tech", "api", "code", "engineer", "developer", "hacker", "programming"],
  },
  business: {
    name: "Business",
    description: "Executive, founder, product manager, or business decision-maker",
    signals: ["linkedin", "business", "enterprise", "roi", "growth", "startup", "founder", "ceo", "executive", "product"],
  },
  creator: {
    name: "Creator",
    description: "Designer, content creator, marketer, or builder",
    signals: ["dribbble", "behance", "twitter", "instagram", "design", "creative", "content", "marketing", "creator", "maker"],
  },
};

router.get("/visitors", async (req, res): Promise<void> => {
  const params = ListVisitorsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { limit = 50, offset = 0, persona } = params.data;

  let query = db.select().from(visitorsTable).orderBy(desc(visitorsTable.createdAt)).limit(limit).offset(offset);
  if (persona) {
    const rows = await db.select().from(visitorsTable)
      .where(eq(visitorsTable.persona, persona))
      .orderBy(desc(visitorsTable.createdAt))
      .limit(limit).offset(offset);
    res.json(rows);
    return;
  }

  const rows = await query;
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

  const signals = [referrer, utmSource, utmMedium, utmCampaign, userAgent, pageTitle]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

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

Based on this, respond with a JSON object ONLY (no markdown) with these fields:
{
  "persona": "technical" | "business" | "creator",
  "confidence": 0.0-1.0,
  "reasoning": "one sentence explaining the key signals",
  "headline": "A punchy, personalized headline for this visitor (max 10 words)",
  "subheadline": "A compelling subheadline tailored to this persona (max 20 words)",
  "ctaText": "Call to action button text (3-5 words)",
  "funnelTheme": "A short theme label for the funnel (e.g. 'Ship Faster', 'Scale Smarter', 'Build Beautiful')"
}

Be decisive. If signals are weak, pick the most likely persona with lower confidence. Always return valid JSON.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(raw);
    } catch {
      result = {
        persona: "business",
        confidence: 0.5,
        reasoning: "Unable to parse AI response",
        headline: "The Smartest Site You've Ever Visited",
        subheadline: "We shaped this page around you the moment you arrived.",
        ctaText: "Get Started",
        funnelTheme: "Smart Personalization",
      };
    }

    // Upsert visitor record
    let visitorId: number | null = null;
    try {
      const existing = await db.select().from(visitorsTable).where(eq(visitorsTable.sessionId, sessionId)).limit(1);
      const personaStr = String(result.persona ?? "business");
      const headline = String(result.headline ?? "");
      const subheadline = String(result.subheadline ?? "");
      const ctaText = String(result.ctaText ?? "");
      const confidence = typeof result.confidence === "number" ? result.confidence : 0.5;

      if (existing.length > 0) {
        const [updated] = await db.update(visitorsTable)
          .set({ persona: personaStr, personaConfidence: confidence, headline, subheadline, ctaText, intentSignals: signals })
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
          intentSignals: signals,
          persona: personaStr,
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

    res.json({
      persona: result.persona,
      confidence: result.confidence,
      headline: result.headline,
      subheadline: result.subheadline,
      ctaText: result.ctaText,
      funnelTheme: result.funnelTheme,
      reasoning: result.reasoning,
      visitorId,
    });
  } catch (err) {
    req.log.error({ err }, "Intent detection failed");
    res.status(500).json({ error: "Intent detection failed" });
  }
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
