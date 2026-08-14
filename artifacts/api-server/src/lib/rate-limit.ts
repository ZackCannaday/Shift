import { sql } from "drizzle-orm";
import { db, rateLimitBucketsTable } from "@workspace/db";
import { hashToken } from "./security";
import { fixedWindowStart } from "./rate-limit-window";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function consumeRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<RateLimitResult> {
  const windowStartMs = fixedWindowStart(now, windowMs);
  const windowStart = new Date(windowStartMs);
  const resetAt = windowStartMs + windowMs;
  const bucketKey = hashToken(`${scope}:${identifier}`);

  const [bucket] = await db.insert(rateLimitBucketsTable).values({
    bucketKey,
    windowStart,
    count: 1,
    expiresAt: new Date(resetAt + windowMs),
  }).onConflictDoUpdate({
    target: [rateLimitBucketsTable.bucketKey, rateLimitBucketsTable.windowStart],
    set: { count: sql`${rateLimitBucketsTable.count} + 1` },
  }).returning({ count: rateLimitBucketsTable.count });

  const count = bucket?.count ?? limit + 1;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}
