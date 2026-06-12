import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const apiKeysTable = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  website: text("website"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  loginToken: text("login_token"),
  loginTokenExpiry: timestamp("login_token_expiry", { withTimezone: true }),
});

export type ApiKey = typeof apiKeysTable.$inferSelect;
