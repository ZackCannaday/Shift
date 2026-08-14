import { integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMembersTable = pgTable("organization_members", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("organization_members_org_user_unique").on(table.organizationId, table.userId),
]);

export type Organization = typeof organizationsTable.$inferSelect;
export type OrganizationMember = typeof organizationMembersTable.$inferSelect;
