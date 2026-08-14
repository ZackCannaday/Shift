import assert from "node:assert/strict";
import test from "node:test";
import { PersonalizationResultSchema, ruleBasedPersonalization } from "./personalization";

test("uses a conservative default when intent evidence is weak", () => {
  const result = ruleBasedPersonalization({ deviceType: "desktop" });
  assert.equal(result.persona, "business");
  assert.equal(result.confidence, 0.25);
  assert.doesNotThrow(() => PersonalizationResultSchema.parse(result));
});

test("selects the technical experience for strong developer context", () => {
  const result = ruleBasedPersonalization({ referrer: "https://github.com/example", pageTitle: "API docs" });
  assert.equal(result.persona, "technical");
  assert.ok(result.confidence >= 0.5);
});
