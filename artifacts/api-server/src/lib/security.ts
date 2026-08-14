import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function encryptionKey(): Buffer {
  const raw = process.env.SHIFT_ENCRYPTION_KEY;
  if (!raw) throw new Error("SHIFT_ENCRYPTION_KEY is required to store provider credentials");

  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== 32) {
    throw new Error("SHIFT_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return decoded;
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(value: string): string {
  const [ivRaw, tagRaw, ciphertextRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error("Invalid encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function sanitizeUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return undefined;
  }
}
