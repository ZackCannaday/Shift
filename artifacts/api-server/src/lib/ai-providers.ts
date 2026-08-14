import {
  buildPersonalizationPrompt,
  PERSONALIZATION_JSON_SCHEMA,
  PersonalizationResultSchema,
  type PersonalizationResult,
  type ProviderName,
  type VisitorSignals,
} from "./personalization";

interface ProviderRequest {
  provider: Exclude<ProviderName, "rules">;
  apiKey: string;
  model?: string | null;
  signals: VisitorSignals;
  siteName: string;
  website?: string | null;
}

const DEFAULT_MODELS: Record<ProviderRequest["provider"], string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5",
  google: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
};

async function requestJson(url: string, init: RequestInit): Promise<any> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(3500) });
  if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
  return response.json();
}

function parseJson(value: unknown): PersonalizationResult {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return PersonalizationResultSchema.parse(parsed);
}

export async function personalizeWithProvider(request: ProviderRequest): Promise<PersonalizationResult> {
  const model = request.model || DEFAULT_MODELS[request.provider];
  const prompt = buildPersonalizationPrompt(request.signals, request.siteName, request.website);

  if (request.provider === "openai" || request.provider === "groq") {
    const baseUrl = request.provider === "openai"
      ? "https://api.openai.com/v1"
      : "https://api.groq.com/openai/v1";
    const body: Record<string, unknown> = {
      model,
      temperature: 0.2,
      max_tokens: 300,
      messages: [
        { role: "system", content: "Return a safe website personalization decision as JSON." },
        { role: "user", content: prompt },
      ],
      response_format: request.provider === "openai"
        ? { type: "json_schema", json_schema: { name: "shift_personalization", strict: true, schema: PERSONALIZATION_JSON_SCHEMA } }
        : { type: "json_object" },
    };
    const data = await requestJson(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${request.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return parseJson(data.choices?.[0]?.message?.content);
  }

  if (request.provider === "anthropic") {
    const data = await requestJson("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": request.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        system: "Return only JSON matching the requested personalization fields.",
        messages: [{ role: "user", content: `${prompt}\nSchema: ${JSON.stringify(PERSONALIZATION_JSON_SCHEMA)}` }],
      }),
    });
    return parseJson(data.content?.find((block: any) => block.type === "text")?.text);
  }

  const data = await requestJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": request.apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseJsonSchema: PERSONALIZATION_JSON_SCHEMA,
        },
      }),
    },
  );
  return parseJson(data.candidates?.[0]?.content?.parts?.[0]?.text);
}
