import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { apiKeysTable } from "./api-keys";
import { contentTargetsTable } from "./content-targets";
import { contentVariantsTable } from "./content-variants";
import { conversionGoalsTable } from "./conversion-goals";
import { usersTable } from "./users";

// One active challenger per target
export const contentAllocationsTable = pgTable(
  "content_allocations",
  {
    id: serial("id").primaryKey(),
    apiKeyId: integer("api_key_id")
      .notNull()
      .references(() => apiKeysTable.id, { onDelete: "cascade" }),
    targetId: integer("target_id").notNull(),
    variantId: integer("variant_id").notNull(),
    conversionGoalId: integer("conversion_goal_id"),
    controlPercentage: integer("control_percentage").notNull().default(50),
    isActive: boolean("is_active").notNull().default(true),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    updatedByUserId: integer("updated_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    activatedAt: timestamp("activated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("content_allocations_target_active_unique")
      .on(table.targetId)
      .where(sql`${table.isActive} = true`),
    index("content_allocations_site_target_idx").on(
      table.apiKeyId,
      table.targetId,
    ),
    foreignKey({
      columns: [table.apiKeyId, table.targetId],
      foreignColumns: [contentTargetsTable.apiKeyId, contentTargetsTable.id],
      name: "content_allocations_site_target_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.apiKeyId, table.targetId, table.variantId],
      foreignColumns: [
        contentVariantsTable.apiKeyId,
        contentVariantsTable.targetId,
        contentVariantsTable.id,
      ],
      name: "content_allocations_site_target_variant_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.apiKeyId, table.conversionGoalId],
      foreignColumns: [conversionGoalsTable.apiKeyId, conversionGoalsTable.id],
      name: "content_allocations_site_goal_fk",
    }).onDelete("restrict"),
    check(
      "content_allocations_control_percentage_check",
      sql`${table.controlPercentage} between 0 and 100`,
    ),
    check(
      "content_allocations_deactivation_check",
      sql`${table.isActive} OR ${table.deactivatedAt} IS NOT NULL`,
    ),
  ],
);

export type ContentAllocation = typeof contentAllocationsTable.$inferSelect;
