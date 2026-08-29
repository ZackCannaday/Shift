import { createHmac, timingSafeEqual } from "node:crypto";

// Token limits
const EVENT_TOKEN_VERSION = 1;
const DEFAULT_TTL_SECONDS = 5 * 60;
const MAX_TTL_SECONDS = 15 * 60;
const MAX_TOKEN_LENGTH = 1024;
const MAX_SESSION_ID_LENGTH = 200;
const MAX_SIGNING_KEY_LENGTH = 4096;
const DEV_SIGNING_KEY = "shift-explicit-development-event-signing-key-v1";

interface EventTokenClaims {
  v: number;
  siteId: number;
  sessionId: string;
  iat: number;
  exp: number;
}

interface IssueEventTokenInput {
  siteId: number;
  sessionId: string;
  ttlSeconds?: number;
  nowMs?: number;
}

interface VerifyEventTokenInput {
  siteId: number;
  sessionId: string;
  nowMs?: number;
}

export interface IssuedEventToken {
  token: string;
  expiresAt: number;
}

// Key resolution
function getSigningKey(): Buffer {
  const configured = process.env.EVENT_SIGNING_KEY;
  if (configured) {
    const bytes = Buffer.from(configured, "utf8");
    if (bytes.length < 32 || bytes.length > MAX_SIGNING_KEY_LENGTH) {
      throw new Error(
        "EVENT_SIGNING_KEY must contain between 32 and 4096 UTF-8 bytes",
      );
    }
    return bytes;
  }

  const allowDevelopmentFallback =
    process.env.ALLOW_DEV_EVENT_SIGNING_KEY === "true";
  if (process.env.NODE_ENV !== "production" && allowDevelopmentFallback) {
    return Buffer.from(DEV_SIGNING_KEY, "utf8");
  }

  throw new Error("EVENT_SIGNING_KEY is required");
}

function isValidBinding(siteId: number, sessionId: string): boolean {
  return (
    Number.isSafeInteger(siteId) &&
    siteId > 0 &&
    sessionId.length >= 8 &&
    sessionId.length <= MAX_SESSION_ID_LENGTH
  );
}

function sign(encodedClaims: string): Buffer {
  return createHmac("sha256", getSigningKey()).update(encodedClaims).digest();
}

// Token issuance
export function issueEmbedEventToken(
  input: IssueEventTokenInput,
): IssuedEventToken {
  const ttlSeconds = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  if (!isValidBinding(input.siteId, input.sessionId)) {
    throw new Error("Invalid event token binding");
  }
  if (
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds < 1 ||
    ttlSeconds > MAX_TTL_SECONDS
  ) {
    throw new Error("Invalid event token lifetime");
  }

  const issuedAt = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const claims: EventTokenClaims = {
    v: EVENT_TOKEN_VERSION,
    siteId: input.siteId,
    sessionId: input.sessionId,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
  };
  const encodedClaims = Buffer.from(JSON.stringify(claims), "utf8").toString(
    "base64url",
  );
  const signature = sign(encodedClaims).toString("base64url");

  return {
    token: `${encodedClaims}.${signature}`,
    expiresAt: claims.exp,
  };
}

// Token verification
export function verifyEmbedEventToken(
  token: string,
  input: VerifyEventTokenInput,
): EventTokenClaims | null {
  if (
    !isValidBinding(input.siteId, input.sessionId) ||
    token.length < 64 ||
    token.length > MAX_TOKEN_LENGTH
  ) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  let providedSignature: Buffer;
  try {
    providedSignature = Buffer.from(parts[1], "base64url");
  } catch {
    return null;
  }

  const expectedSignature = sign(parts[0]);
  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return null;
  }

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!claims || typeof claims !== "object") return null;

  const value = claims as Partial<EventTokenClaims>;
  const now = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (
    value.v !== EVENT_TOKEN_VERSION ||
    value.siteId !== input.siteId ||
    value.sessionId !== input.sessionId ||
    !Number.isSafeInteger(value.iat) ||
    !Number.isSafeInteger(value.exp) ||
    value.exp! <= now ||
    value.iat! > now + 30 ||
    value.exp! <= value.iat! ||
    value.exp! - value.iat! > MAX_TTL_SECONDS
  ) {
    return null;
  }

  return value as EventTokenClaims;
}
