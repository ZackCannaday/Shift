import { z } from "zod";

export const ProviderName = z.enum(["rules", "openai", "anthropic", "google", "groq"]);
export type ProviderName = z.infer<typeof ProviderName>;

export const PersonalizationResultSchema = z.object({
  persona: z.enum(["technical", "business", "creator"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(240),
  headline: z.string().min(1).max(100),
  subheadline: z.string().min(1).max(180),
  ctaText: z.string().min(1).max(50),
  funnelTheme: z.string().min(1).max(50),
});

export type PersonalizationResult = z.infer<typeof PersonalizationResultSchema>;

export interface VisitorSignals {
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  userAgent?: string;
  deviceType?: string;
  pageTitle?: string;
}

const CONTENT = {
  technical: {
    headline: "Explore the Technical Details",
    subheadline: "See the integration, controls, and implementation path before you commit.",
    ctaText: "View the Docs",
    funnelTheme: "Technical evaluation",
  },
  business: {
    headline: "Make Every Visit More Relevant",
    subheadline: "Match each campaign audience with a clear, approved message.",
    ctaText: "See How It Works",
    funnelTheme: "Business outcomes",
  },
  creator: {
    headline: "Adapt the Story to Your Audience",
    subheadline: "Deliver approved creative variants without rebuilding the page.",
    ctaText: "See It Live",
    funnelTheme: "Creative experience",
  },
} as const;

export function ruleBasedPersonalization(signals: VisitorSignals): PersonalizationResult {
  const value = Object.values(signals).filter(Boolean).join(" ").toLowerCase();
  const scores = {
    technical: (value.includes("github") ? 3 : 0) + (/\b(api|sdk|docs|developer|engineer|code)\b/.test(value) ? 2 : 0),
    business: (value.includes("linkedin") ? 3 : 0) + (/\b(enterprise|b2b|roi|growth|revenue|founder|executive)\b/.test(value) ? 2 : 0),
    creator: (/\b(dribbble|behance|instagram|tiktok)\b/.test(value) ? 3 : 0) + (/\b(design|creative|content|brand|visual|creator)\b/.test(value) ? 2 : 0),
  };
  const highest = Math.max(...Object.values(scores));
  const persona = highest === 0
    ? "business"
    : (Object.entries(scores).find(([, score]) => score === highest)?.[0] as keyof typeof CONTENT);
  const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
  const confidence = highest === 0 ? 0.25 : Math.min(0.9, 0.5 + highest / Math.max(total, 1) * 0.35);
  return {
    persona,
    confidence,
    reasoning: highest === 0
      ? "No strong intent signal was available, so the default experience was selected."
      : "The experience was selected from campaign and referral context.",
    ...CONTENT[persona],
  };
}

export const PERSONALIZATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    persona: { type: "string", enum: ["technical", "business", "creator"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reasoning: { type: "string" },
    headline: { type: "string" },
    subheadline: { type: "string" },
    ctaText: { type: "string" },
    funnelTheme: { type: "string" },
  },
  required: ["persona", "confidence", "reasoning", "headline", "subheadline", "ctaText", "funnelTheme"],
} as const;

export function buildPersonalizationPrompt(signals: VisitorSignals, siteName: string, website?: string | null): string {
  return [
    `Select the most appropriate approved-style website experience for ${siteName}.`,
    website ? `Website: ${website}` : "",
    "Do not infer sensitive traits. Use only campaign, referral, device, and page context.",
    "If evidence is weak, use the business/default persona with confidence below 0.4.",
    `Signals: ${JSON.stringify(signals)}`,
  ].filter(Boolean).join("\n");
}
