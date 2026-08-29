import assert from "node:assert/strict";
import test from "node:test";
import {
  assignmentArm,
  assignmentBucket,
  normalizePagePath,
  selectApprovedContent,
  targetMatchesPath,
  type RuntimeContentTarget,
} from "./content-selection";

const headline: RuntimeContentTarget = {
  targetId: 7,
  targetKey: "home_hero",
  targetType: "headline",
  pagePath: "/pricing",
  fallbackContent: "Control headline",
  variantId: 19,
  variantVersion: 2,
  variantContent: "Approved headline",
  controlPercentage: 50,
};

test("assignment is stable for a site, session, and target", () => {
  const first = assignmentBucket(4, "session-123", 7);
  assert.equal(assignmentBucket(4, "session-123", 7), first);
  assert.ok(first >= 0 && first < 100);
});

test("control percentage uses an exact half-open boundary", () => {
  assert.equal(assignmentArm(49, 50), "control");
  assert.equal(assignmentArm(50, 50), "challenger");
  assert.equal(assignmentArm(0, 0), "challenger");
  assert.equal(assignmentArm(99, 100), "control");

  const control = selectApprovedContent({
    siteId: 4,
    sessionId: "session-123",
    pageUrl: "https://example.com/pricing",
    targets: [{ ...headline, controlPercentage: 100 }],
  });
  const challenger = selectApprovedContent({
    siteId: 4,
    sessionId: "session-123",
    pageUrl: "https://example.com/pricing",
    targets: [{ ...headline, controlPercentage: 0 }],
  });
  assert.equal(control.content.headline, headline.fallbackContent);
  assert.equal(challenger.content.headline, headline.variantContent);
});

test("path matching normalizes paths and prefers exact over wildcard", () => {
  assert.equal(
    normalizePagePath("https://example.com/pricing/?utm=x"),
    "/pricing",
  );
  assert.equal(targetMatchesPath("/pricing/", "/pricing"), true);
  assert.equal(targetMatchesPath("/about", "/pricing"), false);
  assert.equal(targetMatchesPath("*", null), true);

  const selection = selectApprovedContent({
    siteId: 4,
    sessionId: "session-123",
    pageUrl: "https://example.com/pricing/",
    targets: [
      { ...headline, targetId: 1, pagePath: "*", fallbackContent: "Wildcard" },
      headline,
    ],
  });
  assert.equal(selection.assignments[0]?.targetId, headline.targetId);
  assert.notEqual(selection.content.headline, "Wildcard");
});

test("absent matching configuration emits no content", () => {
  const selection = selectApprovedContent({
    siteId: 4,
    sessionId: "session-123",
    pageUrl: "https://example.com/about",
    targets: [headline],
  });
  assert.deepEqual(selection, {
    contentConfigured: false,
    assignments: [],
    content: {},
  });
});
