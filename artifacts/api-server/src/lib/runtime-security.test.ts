import assert from "node:assert/strict";
import test from "node:test";

// # Test environment
process.env.DATABASE_URL ??=
  "postgresql://shift:shift@127.0.0.1:5432/shift_test";

test("production rejects developer auth tokens", async () => {
  const { assertSafeAuthConfiguration } = await import("./magic-link");
  assert.throws(
    () =>
      assertSafeAuthConfiguration({
        NODE_ENV: "production",
        ALLOW_DEV_AUTH_TOKENS: "true",
      }),
    /must be disabled in production/,
  );
  assert.doesNotThrow(() =>
    assertSafeAuthConfiguration({
      NODE_ENV: "development",
      ALLOW_DEV_AUTH_TOKENS: "true",
    }),
  );
});

test("session cookies are insecure only for explicit HTTP loopback development", async () => {
  const { sessionCookieSecure } = await import("./dashboard-session");
  assert.equal(
    sessionCookieSecure({
      NODE_ENV: "production",
      PUBLIC_APP_URL: "https://shift.example",
    }),
    true,
  );
  assert.equal(
    sessionCookieSecure({
      NODE_ENV: "development",
      PUBLIC_APP_URL: "https://shift.example",
    }),
    true,
  );
  assert.equal(
    sessionCookieSecure({
      NODE_ENV: "development",
      PUBLIC_APP_URL: "http://localhost:8080",
    }),
    false,
  );
  assert.equal(sessionCookieSecure({ NODE_ENV: "development" }), true);
});

test("trust proxy configuration rejects broad trust", async () => {
  const { parseTrustProxySetting } = await import("../app");
  assert.equal(parseTrustProxySetting(undefined), false);
  assert.equal(parseTrustProxySetting("false"), false);
  assert.equal(
    parseTrustProxySetting("loopback, 10.0.0.0/8"),
    "loopback, 10.0.0.0/8",
  );
  assert.throws(
    () => parseTrustProxySetting("true"),
    /broad trust is not allowed/,
  );
  assert.throws(
    () => parseTrustProxySetting("1"),
    /broad trust is not allowed/,
  );
});

test("provider credentials cannot cross provider boundaries", async () => {
  const { canRetainProviderCredential } = await import("../routes/settings");
  assert.equal(canRetainProviderCredential("openai", "openai", true), true);
  assert.equal(canRetainProviderCredential("openai", "anthropic", true), false);
  assert.equal(
    canRetainProviderCredential("anthropic", "anthropic", false),
    false,
  );
});

test("authenticated mutations require the configured exact origin", async () => {
  const previousAppUrl = process.env.PUBLIC_APP_URL;
  process.env.PUBLIC_APP_URL = "https://shift.example";
  const { default: app } = await import("../app");
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  assert(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/api/auth/logout`;
  const cookie = "shift_session=invalid";

  try {
    const crossSite = await fetch(url, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: "https://evil.example",
        "Sec-Fetch-Site": "cross-site",
      },
    });
    assert.equal(crossSite.status, 403);
    assert.equal(crossSite.headers.get("x-content-type-options"), "nosniff");
    assert.equal(crossSite.headers.get("referrer-policy"), "no-referrer");
    assert.equal(crossSite.headers.get("cache-control"), "no-store");
    assert.equal(crossSite.headers.get("x-powered-by"), null);

    const sameOrigin = await fetch(url, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: "https://shift.example",
        "Sec-Fetch-Site": "same-origin",
      },
    });
    assert.equal(sameOrigin.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (previousAppUrl === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = previousAppUrl;
  }
});

test("request parsers enforce explicit body limits", async () => {
  const { default: app } = await import("../app");
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  assert(address && typeof address === "object");
  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/visitors/detect-intent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "v1_test_session",
          pageTitle: "x".repeat(40 * 1024),
        }),
      },
    );
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), {
      error: "Request body is too large",
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
