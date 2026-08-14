import { pgTable, text, serial, timestamp, boolean, real, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { apiKeysTable } from "./api-keys";

export const visitorsTable = pgTable("visitors", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id").references(() => apiKeysTable.id),
  sessionId: text("session_id").notNull(),
  referrer: text("referrer"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  userAgent: text("user_agent"),
  deviceType: text("device_type"),
  intentSignals: text("intent_signals"),
  persona: text("persona").notNull().default("unknown"),
  personaConfidence: real("persona_confidence"),
  headline: text("headline"),
  subheadline: text("subheadline"),
  ctaText: text("cta_text"),
  converted: boolean("converted").notNull().default(false),
  conversionEvent: text("conversion_event"),
  timeOnSite: integer("time_on_site"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("visitors_site_session_unique").on(table.apiKeyId, table.sessionId),
  index("visitors_site_created_idx").on(table.apiKeyId, table.createdAt),
  index("visitors_site_persona_idx").on(table.apiKeyId, table.persona),
]);

export const insertVisitorSchema = createInsertSchema(visitorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVisitor = z.infer<typeof insertVisitorSchema>;
export type Visitor = typeof visitorsTable.$inferSelect;
