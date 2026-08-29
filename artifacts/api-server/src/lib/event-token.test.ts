import assert from "node:assert/strict";
import test from "node:test";
import { issueEmbedEventToken, verifyEmbedEventToken } from "./event-token";

const TEST_KEY = "event-signing-test-key-material-32-bytes-minimum";
const SITE_ID = 42;
const SESSION_ID = "v1_test_session_123456";
const NOW = Date.UTC(2026, 7, 29, 12, 0, 0);

function withEnvironment(
  values: Record<string, string | undefined>,
  run: () => void,
): void {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("issues and verifies a short-lived event token", () => {
  withEnvironment({ EVENT_SIGNING_KEY: TEST_KEY, NODE_ENV: "test" }, () => {
    const issued = issueEmbedEventToken({
      siteId: SITE_ID,
      sessionId: SESSION_ID,
      ttlSeconds: 60,
      nowMs: NOW,
    });

    assert.equal(issued.expiresAt, Math.floor(NOW / 1000) + 60);
    assert.ok(
      verifyEmbedEventToken(issued.token, {
        siteId: SITE_ID,
        sessionId: SESSION_ID,
        nowMs: NOW + 30_000,
      }),
    );
  });
});

test("rejects site, session, expiry, and signature mismatches", () => {
  withEnvironment({ EVENT_SIGNING_KEY: TEST_KEY, NODE_ENV: "test" }, () => {
    const issued = issueEmbedEventToken({
      siteId: SITE_ID,
      sessionId: SESSION_ID,
      ttlSeconds: 60,
      nowMs: NOW,
    });
    const [payload, signature] = issued.token.split(".");
    const replacement = payload.endsWith("A") ? "B" : "A";
    const tampered = `${payload.slice(0, -1)}${replacement}.${signature}`;

    assert.equal(
      verifyEmbedEventToken(issued.token, {
        siteId: SITE_ID + 1,
        sessionId: SESSION_ID,
        nowMs: NOW,
      }),
      null,
    );
    assert.equal(
      verifyEmbedEventToken(issued.token, {
        siteId: SITE_ID,
        sessionId: "v1_other_session_123456",
        nowMs: NOW,
      }),
      null,
    );
    assert.equal(
      verifyEmbedEventToken(issued.token, {
        siteId: SITE_ID,
        sessionId: SESSION_ID,
        nowMs: NOW + 60_000,
      }),
      null,
    );
    assert.equal(
      verifyEmbedEventToken(tampered, {
        siteId: SITE_ID,
        sessionId: SESSION_ID,
        nowMs: NOW,
      }),
      null,
    );
  });
});

test("requires a dedicated production key", () => {
  withEnvironment(
    {
      EVENT_SIGNING_KEY: undefined,
      ALLOW_DEV_EVENT_SIGNING_KEY: "true",
      NODE_ENV: "production",
    },
    () => {
      assert.throws(
        () =>
          issueEmbedEventToken({
            siteId: SITE_ID,
            sessionId: SESSION_ID,
            nowMs: NOW,
          }),
        /EVENT_SIGNING_KEY is required/,
      );
    },
  );
});

test("permits the explicit fallback only outside production", () => {
  withEnvironment(
    {
      EVENT_SIGNING_KEY: undefined,
      ALLOW_DEV_EVENT_SIGNING_KEY: "true",
      NODE_ENV: "test",
    },
    () => {
      const issued = issueEmbedEventToken({
        siteId: SITE_ID,
        sessionId: SESSION_ID,
        nowMs: NOW,
      });
      assert.ok(
        verifyEmbedEventToken(issued.token, {
          siteId: SITE_ID,
          sessionId: SESSION_ID,
          nowMs: NOW,
        }),
      );
    },
  );
});

test("caps token bindings and lifetimes", () => {
  withEnvironment({ EVENT_SIGNING_KEY: TEST_KEY, NODE_ENV: "test" }, () => {
    assert.throws(
      () =>
        issueEmbedEventToken({
          siteId: SITE_ID,
          sessionId: "x".repeat(201),
          nowMs: NOW,
        }),
      /Invalid event token binding/,
    );
    assert.throws(
      () =>
        issueEmbedEventToken({
          siteId: SITE_ID,
          sessionId: SESSION_ID,
          ttlSeconds: 901,
          nowMs: NOW,
        }),
      /Invalid event token lifetime/,
    );
  });
});
