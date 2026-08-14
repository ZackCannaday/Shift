import assert from "node:assert/strict";
import test from "node:test";
import { buildMagicLink } from "./email";
import { fixedWindowStart } from "./rate-limit-window";

test("rate limiting uses stable fixed windows", () => {
  assert.equal(fixedWindowStart(3_599_999, 3_600_000), 0);
  assert.equal(fixedWindowStart(3_600_000, 3_600_000), 3_600_000);
});

test("magic links bind the token to the configured application origin", () => {
  const previous = process.env.PUBLIC_APP_URL;
  const previousEnv = process.env.NODE_ENV;
  process.env.PUBLIC_APP_URL = "https://shift.example/base";
  process.env.NODE_ENV = "production";
  try {
    assert.equal(buildMagicLink("a+b/c"), "https://shift.example/login?token=a%2Bb%2Fc");
  } finally {
    if (previous === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = previous;
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
  }
});

test("production magic links reject insecure public origins", () => {
  const previous = process.env.PUBLIC_APP_URL;
  const previousEnv = process.env.NODE_ENV;
  process.env.PUBLIC_APP_URL = "http://shift.example";
  process.env.NODE_ENV = "production";
  try {
    assert.throws(() => buildMagicLink("token"), /HTTPS/);
  } finally {
    if (previous === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = previous;
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
  }
});
