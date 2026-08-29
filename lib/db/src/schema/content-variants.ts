import {
  check,
  foreignKey,
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
import { contentTargetsTable } from "./content-targets";
import { usersTable } from "./users";

export const contentVariantStatusEnum = pgEnum("content_variant_status", [
  "draft",
  "approved",
  "archived",
]);

// Versioned approved copy
export const contentVariantsTable = pgTable(
  "content_variants",
  {
    id: serial("id").primaryKey(),
    apiKeyId: integer("api_key_id")
      .notNull()
      .references(() => apiKeysTable.id, { onDelete: "cascade" }),
    targetId: integer("target_id").notNull(),
    version: integer("version").notNull(),
    status: contentVariantStatusEnum("status").notNull().default("draft"),
    content: text("content").notNull(),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    updatedByUserId: integer("updated_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    approvedByUserId: integer("approved_by_user_id").references(
      () => usersTable.id,
      { onDelete: "restrict" },
    ),
    archivedByUserId: integer("archived_by_user_id").references(
      () => usersTable.id,
      { onDelete: "restrict" },
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("content_variants_target_version_unique").on(
      table.targetId,
      table.version,
    ),
    uniqueIndex("content_variants_site_target_id_unique").on(
      table.apiKeyId,
      table.targetId,
      table.id,
    ),
    index("content_variants_site_target_status_idx").on(
      table.apiKeyId,
      table.targetId,
      table.status,
    ),
    foreignKey({
      columns: [table.apiKeyId, table.targetId],
      foreignColumns: [contentTargetsTable.apiKeyId, contentTargetsTable.id],
      name: "content_variants_site_target_fk",
    }).onDelete("cascade"),
    check("content_variants_version_check", sql`${table.version} > 0`),
    check(
      "content_variants_content_length_check",
      sql`char_length(${table.content}) between 1 and 500`,
    ),
    check(
      "content_variants_approved_audit_check",
      sql`${table.status} <> 'approved' OR (${table.approvedAt} IS NOT NULL AND ${table.approvedByUserId} IS NOT NULL)`,
    ),
    check(
      "content_variants_archived_audit_check",
      sql`${table.status} <> 'archived' OR (${table.archivedAt} IS NOT NULL AND ${table.archivedByUserId} IS NOT NULL)`,
    ),
  ],
);

export type ContentVariant = typeof contentVariantsTable.$inferSelect;
