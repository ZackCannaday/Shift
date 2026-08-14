import assert from "node:assert/strict";
import test from "node:test";
import { decryptSecret, encryptSecret, hashToken, sanitizeUrl } from "./security";

test("hashes tokens without retaining plaintext", () => {
  assert.equal(hashToken("token"), hashToken("token"));
  assert.notEqual(hashToken("token"), "token");
});

test("removes query strings and fragments from captured URLs", () => {
  assert.equal(sanitizeUrl("https://example.com/pricing?email=user@example.com#plan"), "https://example.com/pricing");
});

test("encrypts provider credentials with authenticated encryption", () => {
  process.env.SHIFT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  const encrypted = encryptSecret("provider-secret");
  assert.notEqual(encrypted, "provider-secret");
  assert.equal(decryptSecret(encrypted), "provider-secret");
});
