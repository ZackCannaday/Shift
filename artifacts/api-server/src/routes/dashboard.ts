import { Router, type IRouter } from "express";
import { desc, count, sql, avg, eq } from "drizzle-orm";
import { db, visitorsTable } from "@workspace/db";
import { GetRecentActivityQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const [totals] = await db.select({
    total: count(),
    converted: sql<number>`count(*) filter (where ${visitorsTable.converted} = true)`,
    avgTime: avg(visitorsTable.timeOnSite),
    todayTotal: sql<number>`count(*) filter (where ${visitorsTable.createdAt} >= current_date)`,
    todayConverted: sql<number>`count(*) filter (where ${visitorsTable.converted} = true and ${visitorsTable.createdAt} >= current_date)`,
  }).from(visitorsTable);

  const personaCountResult = await db.select({
    persona: visitorsTable.persona,
  }).from(visitorsTable).groupBy(visitorsTable.persona);

  const uniquePersonas = personaCountResult.length;
  const total = Number(totals.total ?? 0);
  const converted = Number(totals.converted ?? 0);

  res.json({
    totalVisitors: total,
    totalConverted: converted,
    conversionRate: total > 0 ? Math.round((converted / total) * 1000) / 10 : 0,
    uniquePersonas,
    avgTimeOnSite: totals.avgTime ? Number(totals.avgTime) : null,
    todayVisitors: Number(totals.todayTotal ?? 0),
    todayConverted: Number(totals.todayConverted ?? 0),
  });
});

router.get("/dashboard/funnel-breakdown", async (req, res): Promise<void> => {
  const rows = await db.select({
    persona: visitorsTable.persona,
    count: count(),
    converted: sql<number>`count(*) filter (where ${visitorsTable.converted} = true)`,
    avgConfidence: avg(visitorsTable.personaConfidence),
  }).from(visitorsTable).groupBy(visitorsTable.persona).orderBy(desc(count()));

  const result = rows.map((r) => {
    const total = Number(r.count);
    const conv = Number(r.converted ?? 0);
    return {
      persona: r.persona,
      count: total,
      converted: conv,
      conversionRate: total > 0 ? Math.round((conv / total) * 1000) / 10 : 0,
      avgConfidence: r.avgConfidence ? Math.round(Number(r.avgConfidence) * 100) / 100 : null,
    };
  });

  res.json(result);
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const params = GetRecentActivityQueryParams.safeParse(req.query);
  const limit = params.success ? (params.data.limit ?? 20) : 20;

  const rows = await db.select().from(visitorsTable)
    .orderBy(desc(visitorsTable.createdAt))
    .limit(limit);

  res.json(rows);
});

export default router;
