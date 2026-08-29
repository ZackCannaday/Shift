import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { apiKeysTable } from "./api-keys";
import { usersTable } from "./users";

export const contentTargetTypeEnum = pgEnum("content_target_type", [
  "headline",
  "subheadline",
  "cta",
]);

// Approved page locations
export const contentTargetsTable = pgTable(
  "content_targets",
  {
    id: serial("id").primaryKey(),
    apiKeyId: integer("api_key_id")
      .notNull()
      .references(() => apiKeysTable.id, { onDelete: "cascade" }),
    targetKey: text("target_key").notNull(),
    targetType: contentTargetTypeEnum("target_type").notNull(),
    name: text("name").notNull(),
    pagePath: text("page_path").notNull().default("*"),
    selector: text("selector").notNull(),
    fallbackContent: text("fallback_content").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    updatedByUserId: integer("updated_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("content_targets_site_key_unique").on(
      table.apiKeyId,
      table.targetKey,
    ),
    uniqueIndex("content_targets_site_id_unique").on(table.apiKeyId, table.id),
    index("content_targets_site_active_idx").on(table.apiKeyId, table.isActive),
    check(
      "content_targets_key_format_check",
      sql`${table.targetKey} ~ '^[a-z][a-z0-9_-]{1,63}$'`,
    ),
    check(
      "content_targets_name_length_check",
      sql`char_length(${table.name}) between 1 and 120`,
    ),
    check(
      "content_targets_path_length_check",
      sql`char_length(${table.pagePath}) between 1 and 500`,
    ),
    check(
      "content_targets_selector_length_check",
      sql`char_length(${table.selector}) between 1 and 500`,
    ),
    check(
      "content_targets_fallback_length_check",
      sql`char_length(${table.fallbackContent}) between 1 and 500`,
    ),
  ],
);

export type ContentTarget = typeof contentTargetsTable.$inferSelect;
