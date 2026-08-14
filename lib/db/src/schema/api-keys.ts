import { pgTable, text, serial, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";

export const apiKeysTable = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  // This is intentionally public and is safe to expose in an embed tag.
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  website: text("website"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  loginToken: text("login_token"),
  loginTokenExpiry: timestamp("login_token_expiry", { withTimezone: true }),
  aiProvider: text("ai_provider").notNull().default("rules"),
  aiModel: text("ai_model"),
  aiApiKeyEncrypted: text("ai_api_key_encrypted"),
}, (table) => [
  uniqueIndex("api_keys_email_unique").on(table.email),
]);

export type ApiKey = typeof apiKeysTable.$inferSelect;
