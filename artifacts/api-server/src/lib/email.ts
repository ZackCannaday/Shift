import { hashToken } from "./security";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function publicAppUrl(): URL {
  const raw = process.env.PUBLIC_APP_URL;
  if (!raw) throw new Error("PUBLIC_APP_URL is required for email login links");
  const url = new URL(raw);
  if (!(["https:", "http:"].includes(url.protocol))) throw new Error("PUBLIC_APP_URL must use HTTP or HTTPS");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("PUBLIC_APP_URL must use HTTPS in production");
  }
  return url;
}

export function buildMagicLink(token: string): string {
  const url = new URL("/login", publicAppUrl());
  url.searchParams.set("token", token);
  return url.toString();
}

export function emailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.SHIFT_FROM_EMAIL && process.env.PUBLIC_APP_URL);
}

export async function sendMagicLinkEmail(email: string, token: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SHIFT_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Resend email delivery is not configured");
  const magicLink = buildMagicLink(token);

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `shift-login-${hashToken(token).slice(0, 32)}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Sign in to Shift",
      text: `Use this one-time link to sign in to Shift: ${magicLink}\n\nThis link expires in 30 minutes.`,
      html: `<p>Use this one-time link to sign in to Shift:</p><p><a href="${magicLink}">Sign in to Shift</a></p><p>This link expires in 30 minutes.</p>`,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Email provider rejected the request (${response.status}): ${detail.slice(0, 200)}`);
  }
}
