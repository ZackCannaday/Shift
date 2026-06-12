import { Router, type IRouter } from "express";
import { desc, count, avg, eq, gte, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, visitorsTable, apiKeysTable } from "@workspace/db";
import { GetRecentActivityQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

async function resolveApiKeyId(apiKey: string | undefined): Promise<number | null> {
  if (!apiKey || !apiKey.startsWith("sk_live_")) return null;
  const [record] = await db.select({ id: apiKeysTable.id }).from(apiKeysTable).where(eq(apiKeysTable.key, apiKey)).limit(1);
  return record?.id ?? null;
}

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const apiKey = typeof req.query.apiKey === "string" ? req.query.apiKey : undefined;
  const apiKeyId = await resolveApiKeyId(apiKey);
  const whereClause = apiKeyId !== null ? eq(visitorsTable.apiKeyId, apiKeyId) : undefined;

  const [totals] = await db.select({
    total: count(),
    converted: sql<number>`count(*) filter (where ${visitorsTable.converted} = true)`,
    avgTime: avg(visitorsTable.timeOnSite),
    todayTotal: sql<number>`count(*) filter (where ${visitorsTable.createdAt} >= current_date)`,
    todayConverted: sql<number>`count(*) filter (where ${visitorsTable.converted} = true and ${visitorsTable.createdAt} >= current_date)`,
  }).from(visitorsTable).where(whereClause);

  const personaCountResult = await db.select({ persona: visitorsTable.persona })
    .from(visitorsTable).where(whereClause).groupBy(visitorsTable.persona);

  const total = Number(totals.total ?? 0);
  const converted = Number(totals.converted ?? 0);

  res.json({
    totalVisitors: total,
    totalConverted: converted,
    conversionRate: total > 0 ? converted / total : 0,
    uniquePersonas: personaCountResult.length,
    avgTimeOnSite: totals.avgTime ? Number(totals.avgTime) : null,
    todayVisitors: Number(totals.todayTotal ?? 0),
    todayConverted: Number(totals.todayConverted ?? 0),
  });
});

router.get("/dashboard/funnel-breakdown", async (req, res): Promise<void> => {
  const apiKey = typeof req.query.apiKey === "string" ? req.query.apiKey : undefined;
  const apiKeyId = await resolveApiKeyId(apiKey);
  const whereClause = apiKeyId !== null ? eq(visitorsTable.apiKeyId, apiKeyId) : undefined;

  const rows = await db.select({
    persona: visitorsTable.persona,
    count: count(),
    converted: sql<number>`count(*) filter (where ${visitorsTable.converted} = true)`,
    avgConfidence: avg(visitorsTable.personaConfidence),
  }).from(visitorsTable).where(whereClause).groupBy(visitorsTable.persona).orderBy(desc(count()));

  res.json(rows.map((r) => {
    const total = Number(r.count);
    const conv = Number(r.converted ?? 0);
    return {
      persona: r.persona,
      count: total,
      converted: conv,
      conversionRate: total > 0 ? conv / total : 0,
      avgConfidence: r.avgConfidence ? Math.round(Number(r.avgConfidence) * 100) / 100 : null,
    };
  }));
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const params = GetRecentActivityQueryParams.safeParse(req.query);
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const apiKey = typeof req.query.apiKey === "string" ? req.query.apiKey : undefined;
  const apiKeyId = await resolveApiKeyId(apiKey);
  const whereClause = apiKeyId !== null ? eq(visitorsTable.apiKeyId, apiKeyId) : undefined;

  const rows = await db.select().from(visitorsTable)
    .where(whereClause).orderBy(desc(visitorsTable.createdAt)).limit(limit);

  res.json(rows);
});

router.get("/dashboard/timeseries", async (req, res): Promise<void> => {
  const days = Math.min(Number(req.query.days) || 7, 30);
  const apiKey = typeof req.query.apiKey === "string" ? req.query.apiKey : undefined;
  const apiKeyId = await resolveApiKeyId(apiKey);

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const baseWhere = apiKeyId !== null
    ? and(eq(visitorsTable.apiKeyId, apiKeyId), gte(visitorsTable.createdAt, cutoff))
    : gte(visitorsTable.createdAt, cutoff);

  const rows = await db.select({
    day: sql<string>`date_trunc('day', ${visitorsTable.createdAt})::date`,
    persona: visitorsTable.persona,
    count: count(),
  }).from(visitorsTable)
    .where(baseWhere)
    .groupBy(sql`date_trunc('day', ${visitorsTable.createdAt})`, visitorsTable.persona)
    .orderBy(sql`date_trunc('day', ${visitorsTable.createdAt})`);

  // Build a map of day → { technical, business, creator, total }
  const dayMap = new Map<string, { date: string; technical: number; business: number; creator: number; total: number }>();

  // Pre-fill all days in range so gaps show as zero
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    dayMap.set(key, { date: label, technical: 0, business: 0, creator: 0, total: 0 });
  }

  for (const row of rows) {
    const key = String(row.day).slice(0, 10);
    const entry = dayMap.get(key);
    if (!entry) continue;
    const n = Number(row.count);
    const p = row.persona as string;
    if (p === "technical") entry.technical += n;
    else if (p === "business") entry.business += n;
    else if (p === "creator") entry.creator += n;
    entry.total += n;
  }

  res.json(Array.from(dayMap.values()));
});

export default router;
