import { pgTable, text, serial, timestamp, boolean, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const visitorsTable = pgTable("visitors", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
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
});

export const insertVisitorSchema = createInsertSchema(visitorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVisitor = z.infer<typeof insertVisitorSchema>;
export type Visitor = typeof visitorsTable.$inferSelect;
