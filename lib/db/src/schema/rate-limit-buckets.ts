import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const rateLimitBucketsTable = pgTable("rate_limit_buckets", {
  bucketKey: text("bucket_key").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(1),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  primaryKey({ name: "rate_limit_buckets_pk", columns: [table.bucketKey, table.windowStart] }),
]);
