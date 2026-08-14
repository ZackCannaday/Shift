import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  loginToken: text("login_token"),
  loginTokenExpiry: timestamp("login_token_expiry", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("users_email_unique").on(table.email),
  uniqueIndex("users_login_token_unique").on(table.loginToken),
]);

export type User = typeof usersTable.$inferSelect;
