import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { apiKeysTable } from "./api-keys";
import { usersTable } from "./users";

// Site conversion outcomes
export const conversionGoalsTable = pgTable(
  "conversion_goals",
  {
    id: serial("id").primaryKey(),
    apiKeyId: integer("api_key_id")
      .notNull()
      .references(() => apiKeysTable.id, { onDelete: "cascade" }),
    goalKey: text("goal_key").notNull(),
    name: text("name").notNull(),
    eventName: text("event_name").notNull(),
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
    uniqueIndex("conversion_goals_site_key_unique").on(
      table.apiKeyId,
      table.goalKey,
    ),
    uniqueIndex("conversion_goals_site_id_unique").on(table.apiKeyId, table.id),
    index("conversion_goals_site_active_idx").on(
      table.apiKeyId,
      table.isActive,
    ),
    check(
      "conversion_goals_key_format_check",
      sql`${table.goalKey} ~ '^[a-z][a-z0-9_-]{1,63}$'`,
    ),
    check(
      "conversion_goals_event_format_check",
      sql`${table.eventName} ~ '^[a-z][a-z0-9_.:-]{1,119}$'`,
    ),
    check(
      "conversion_goals_name_length_check",
      sql`char_length(${table.name}) between 1 and 120`,
    ),
  ],
);

export type ConversionGoal = typeof conversionGoalsTable.$inferSelect;
