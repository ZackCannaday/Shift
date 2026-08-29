import assert from "node:assert/strict";
import test from "node:test";
import { EMBED_SCRIPT } from "./embed-script";

test("generated embed script is valid JavaScript and keeps authorization private", () => {
  assert.doesNotThrow(() => new Function(EMBED_SCRIPT));
  assert.match(EMBED_SCRIPT, /eventToken: submittedToken/);
  assert.match(EMBED_SCRIPT, /delete publicResult\.eventToken/);
  assert.match(EMBED_SCRIPT, /sessionStorage\.setItem\(CACHE_KEY/);
  assert.match(EMBED_SCRIPT, /shortHash\(apiKey\).*shortHash\(pageScope\)/);
  assert.doesNotMatch(EMBED_SCRIPT, /localStorage\.setItem\([^)]*eventToken/);
});

test("automatic personalization preserves safe text-only writes", () => {
  assert.match(EMBED_SCRIPT, /els\[i\]\.textContent = value/);
  assert.doesNotMatch(EMBED_SCRIPT, /innerHTML\s*=/);
});
