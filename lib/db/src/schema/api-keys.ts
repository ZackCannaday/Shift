import { boolean, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const apiKeysTable = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  // This is intentionally public and is safe to expose in an embed tag.
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  website: text("website"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  aiProvider: text("ai_provider").notNull().default("rules"),
  aiModel: text("ai_model"),
  aiApiKeyEncrypted: text("ai_api_key_encrypted"),
}, (table) => [
  index("api_keys_organization_idx").on(table.organizationId),
]);

export type ApiKey = typeof apiKeysTable.$inferSelect;
