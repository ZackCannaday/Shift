import { integer, pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { apiKeysTable } from "./api-keys";
import { usersTable } from "./users";

export const dashboardSessionsTable = pgTable("dashboard_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  apiKeyId: integer("api_key_id")
    .notNull()
    .references(() => apiKeysTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("dashboard_sessions_api_key_idx").on(table.apiKeyId),
  index("dashboard_sessions_user_idx").on(table.userId),
  index("dashboard_sessions_expiry_idx").on(table.expiresAt),
]);

export type DashboardSession = typeof dashboardSessionsTable.$inferSelect;
