import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { emailDeliveryConfigured, sendMagicLinkEmail } from "./email";
import { hashToken } from "./security";

const LOGIN_TTL_MS = 30 * 60 * 1000;

// # Auth configuration
export function assertSafeAuthConfiguration(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.NODE_ENV === "production" && env.ALLOW_DEV_AUTH_TOKENS === "true") {
    throw new Error("ALLOW_DEV_AUTH_TOKENS must be disabled in production");
  }
}

function devAuthTokensEnabled(): boolean {
  assertSafeAuthConfiguration();
  return process.env.ALLOW_DEV_AUTH_TOKENS === "true";
}

assertSafeAuthConfiguration();

export function canDeliverMagicLinks(): boolean {
  return emailDeliveryConfigured() || devAuthTokensEnabled();
}

export async function issueMagicLink(user: {
  id: number;
  email: string;
  name: string;
}) {
  const token = randomBytes(32).toString("base64url");
  const expiry = new Date(Date.now() + LOGIN_TTL_MS);
  await db
    .update(usersTable)
    .set({ loginToken: hashToken(token), loginTokenExpiry: expiry })
    .where(eq(usersTable.id, user.id));

  if (emailDeliveryConfigured()) await sendMagicLinkEmail(user.email, token);

  return devAuthTokensEnabled()
    ? { sent: true as const, _devToken: token, _devName: user.name }
    : { sent: true as const };
}
