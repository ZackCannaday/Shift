import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionVariant,
  CreateContentTargetBody,
  CreateConversionGoalBody,
  PutContentAllocationBody,
  UpdateContentTargetBody,
  validateContentForType,
} from "./content-contracts";

test("target contract accepts a scoped target", () => {
  const parsed = CreateContentTargetBody.parse({
    targetKey: "home_hero",
    targetType: "headline",
    name: "Home hero",
    pagePath: "/",
    selector: "[data-shift-target='home_hero']",
    fallbackContent: "A safe control headline",
  });
  assert.equal(parsed.targetKey, "home_hero");
});

test("target contract rejects unknown fields and unsafe paths", () => {
  assert.equal(
    CreateContentTargetBody.safeParse({
      targetKey: "home_hero",
      targetType: "headline",
      name: "Home hero",
      pagePath: "/?preview=true",
      selector: "h1",
      fallbackContent: "Control",
      apiKeyId: 99,
    }).success,
    false,
  );
});

test("type-specific content limits are enforced", () => {
  assert.equal(validateContentForType("cta", "x".repeat(120)).success, true);
  assert.equal(validateContentForType("cta", "x".repeat(121)).success, false);
  assert.equal(
    CreateContentTargetBody.safeParse({
      targetKey: "home_cta",
      targetType: "cta",
      name: "Home CTA",
      selector: ".cta",
      fallbackContent: "x".repeat(121),
    }).success,
    false,
  );
});

test("empty target updates are rejected", () => {
  assert.equal(UpdateContentTargetBody.safeParse({}).success, false);
});

test("goal and allocation contracts reject unsafe values", () => {
  assert.equal(
    CreateConversionGoalBody.safeParse({
      goalKey: "Signup",
      name: "Signup",
      eventName: "signup",
    }).success,
    false,
  );
  assert.equal(
    PutContentAllocationBody.safeParse({ variantId: 1, controlPercentage: 101 })
      .success,
    false,
  );
  assert.equal(
    PutContentAllocationBody.safeParse({
      variantId: 1,
      controlPercentage: 50,
      apiKeyId: 4,
    }).success,
    false,
  );
});

test("variant lifecycle is monotonic", () => {
  assert.equal(canTransitionVariant("draft", "approved"), true);
  assert.equal(canTransitionVariant("approved", "archived"), true);
  assert.equal(canTransitionVariant("archived", "approved"), false);
  assert.equal(canTransitionVariant("approved", "draft"), false);
});
