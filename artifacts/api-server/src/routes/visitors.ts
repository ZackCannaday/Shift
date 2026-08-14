import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, visitorsTable } from "@workspace/db";
import {
  ListVisitorsQueryParams,
  CreateVisitorBody,
  GetVisitorParams,
  UpdateVisitorParams,
  UpdateVisitorBody,
  DetectIntentBody,
} from "@workspace/api-zod";
import { ruleBasedPersonalization } from "../lib/personalization";
import { sanitizeUrl } from "../lib/security";
import { requireDashboardSession, type AuthenticatedRequest } from "../middlewares/dashboard-auth";

const router: IRouter = Router();

// Public, non-persistent demo endpoint used by Shift's own landing page.
router.post("/visitors/detect-intent", async (req, res): Promise<void> => {
  const parsed = DetectIntentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = ruleBasedPersonalization({
    ...parsed.data,
    referrer: sanitizeUrl(parsed.data.referrer),
  });
  res.json({ ...result, visitorId: null });
});

router.use("/visitors", requireDashboardSession);

router.get("/visitors", async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = ListVisitorsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { limit = 50, offset = 0, persona } = params.data;
  const conditions = [eq(visitorsTable.apiKeyId, req.shiftSiteId!)];
  if (persona) conditions.push(eq(visitorsTable.persona, persona));
  const rows = await db.select().from(visitorsTable)
    .where(and(...conditions))
    .orderBy(desc(visitorsTable.createdAt))
    .limit(limit).offset(offset);
  res.json(rows);
});

router.post("/visitors", async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateVisitorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [visitor] = await db.insert(visitorsTable).values({
    ...parsed.data,
    apiKeyId: req.shiftSiteId!,
  }).returning();
  res.status(201).json(visitor);
});

router.get("/visitors/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetVisitorParams.safeParse({ id: Number(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [visitor] = await db.select().from(visitorsTable).where(and(
    eq(visitorsTable.id, params.data.id),
    eq(visitorsTable.apiKeyId, req.shiftSiteId!),
  ));
  if (!visitor) {
    res.status(404).json({ error: "Visitor not found" });
    return;
  }
  res.json(visitor);
});

router.patch("/visitors/:id", async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateVisitorParams.safeParse({ id: Number(raw) });
  const body = UpdateVisitorBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid visitor update" });
    return;
  }
  const [visitor] = await db.update(visitorsTable).set(body.data).where(and(
    eq(visitorsTable.id, params.data.id),
    eq(visitorsTable.apiKeyId, req.shiftSiteId!),
  )).returning();
  if (!visitor) {
    res.status(404).json({ error: "Visitor not found" });
    return;
  }
  res.json(visitor);
});

export default router;
