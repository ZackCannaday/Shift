import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test("registration requires a one-time email verification before dashboard access", {
  skip: !testDatabaseUrl ? "TEST_DATABASE_URL is not configured" : false,
}, async () => {
  const schema = `shift_test_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const scopedUrl = new URL(testDatabaseUrl!);
  scopedUrl.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = scopedUrl.toString();
  process.env.ALLOW_DEV_AUTH_TOKENS = "true";
  process.env.PUBLIC_APP_URL = "http://shift.test";
  process.env.NODE_ENV = "test";

  const dbModule = await import("@workspace/db");
  await dbModule.pool.query(`CREATE SCHEMA "${schema}"`);
  const migration = await readFile(
    new URL("../../../../lib/db/migrations/0000_stage_two_foundation.sql", import.meta.url),
    "utf8",
  );
  await dbModule.pool.query(migration);

  const { default: app } = await import("../app");
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const registration = await fetch(`${base}/api/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Verified Workspace",
        email: "owner@example.com",
        website: "https://customer.example.com",
      }),
    });
    assert.equal(registration.status, 202);
    assert.equal(registration.headers.get("set-cookie"), null, "registration must not grant a session");
    const registrationBody = await registration.json() as { _devToken?: string; verificationRequired?: boolean };
    assert.equal(registrationBody.verificationRequired, true);
    assert.ok(registrationBody._devToken);

    const unauthenticated = await fetch(`${base}/api/auth/session`);
    assert.equal(unauthenticated.status, 401);

    const verification = await fetch(`${base}/api/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: registrationBody._devToken }),
    });
    assert.equal(verification.status, 200);
    const cookie = verification.headers.get("set-cookie");
    assert.match(cookie ?? "", /^shift_session=/);

    const replay = await fetch(`${base}/api/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: registrationBody._devToken }),
    });
    assert.equal(replay.status, 401, "verification links must be single-use");

    const session = await fetch(`${base}/api/auth/session`, { headers: { Cookie: cookie!.split(";")[0] } });
    assert.equal(session.status, 200);
    const sessionBody = await session.json() as { email?: string; key?: string };
    assert.equal(sessionBody.email, "owner@example.com");
    assert.match(sessionBody.key ?? "", /^pk_shift_/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await dbModule.pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await dbModule.pool.end();
  }
});
