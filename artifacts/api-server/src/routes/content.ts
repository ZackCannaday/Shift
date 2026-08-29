import { Router, type IRouter, type Response } from "express";
import { and, desc, eq, max, sql } from "drizzle-orm";
import {
  contentAllocationsTable,
  contentTargetsTable,
  contentVariantsTable,
  conversionGoalsTable,
  db,
} from "@workspace/db";
import {
  ContentIdParams,
  ContentListQuery,
  CreateContentTargetBody,
  CreateContentVariantBody,
  CreateConversionGoalBody,
  PutContentAllocationBody,
  TargetIdParams,
  UpdateContentTargetBody,
  UpdateContentVariantBody,
  UpdateConversionGoalBody,
  validateContentForType,
  VariantListQuery,
} from "../lib/content-contracts";
import {
  requireDashboardSession,
  type AuthenticatedRequest,
} from "../middlewares/dashboard-auth";

const router: IRouter = Router();
router.use("/content", requireDashboardSession);

class ApiProblem extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function rawParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function sendValidationError(res: Response, error: { issues: unknown[] }) {
  res.status(400).json({ error: "Invalid request", details: error.issues });
}

function sendFirstValidationError(
  res: Response,
  results: ReadonlyArray<{ success: boolean; error?: { issues: unknown[] } }>,
) {
  const failed = results.find((result) => !result.success);
  sendValidationError(res, failed?.error ?? { issues: [] });
}

function handleKnownError(res: Response, error: unknown) {
  if (error instanceof ApiProblem) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    res
      .status(409)
      .json({
        error: "A record with that key or active allocation already exists",
      });
    return true;
  }
  return false;
}

async function lockTarget(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  siteId: number,
  targetId: number,
) {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(${siteId}, ${targetId})`,
  );
}

async function lockGoal(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  siteId: number,
  goalId: number,
) {
  await transaction.execute(
    sql`select pg_advisory_xact_lock(${siteId}, ${-goalId})`,
  );
}

// Target CRUD
router.get(
  "/content/targets",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const parsed = ContentListQuery.safeParse(req.query);
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    const conditions = [eq(contentTargetsTable.apiKeyId, req.shiftSiteId!)];
    if (!parsed.data.includeInactive)
      conditions.push(eq(contentTargetsTable.isActive, true));
    const rows = await db
      .select()
      .from(contentTargetsTable)
      .where(and(...conditions))
      .orderBy(
        desc(contentTargetsTable.updatedAt),
        desc(contentTargetsTable.id),
      )
      .limit(parsed.data.limit)
      .offset(parsed.data.offset);
    res.json(rows);
  },
);

router.post(
  "/content/targets",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const parsed = CreateContentTargetBody.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    try {
      const [target] = await db
        .insert(contentTargetsTable)
        .values({
          ...parsed.data,
          apiKeyId: req.shiftSiteId!,
          createdByUserId: req.shiftUserId!,
          updatedByUserId: req.shiftUserId!,
        })
        .returning();
      res.status(201).json(target);
    } catch (error) {
      if (!handleKnownError(res, error)) throw error;
    }
  },
);

router.get(
  "/content/targets/:id",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const parsed = ContentIdParams.safeParse({ id: rawParam(req.params.id) });
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    const [target] = await db
      .select()
      .from(contentTargetsTable)
      .where(
        and(
          eq(contentTargetsTable.id, parsed.data.id),
          eq(contentTargetsTable.apiKeyId, req.shiftSiteId!),
        ),
      )
      .limit(1);
    if (!target) {
      res.status(404).json({ error: "Content target not found" });
      return;
    }
    res.json(target);
  },
);

router.patch(
  "/content/targets/:id",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const params = ContentIdParams.safeParse({ id: rawParam(req.params.id) });
    const body = UpdateContentTargetBody.safeParse(req.body);
    if (!params.success || !body.success) {
      sendFirstValidationError(res, [params, body]);
      return;
    }
    try {
      const target = await db.transaction(async (transaction) => {
        await lockTarget(transaction, req.shiftSiteId!, params.data.id);
        const [current] = await transaction
          .select()
          .from(contentTargetsTable)
          .where(
            and(
              eq(contentTargetsTable.id, params.data.id),
              eq(contentTargetsTable.apiKeyId, req.shiftSiteId!),
            ),
          )
          .limit(1);
        if (!current) throw new ApiProblem(404, "Content target not found");
        if (body.data.fallbackContent) {
          const content = validateContentForType(
            current.targetType,
            body.data.fallbackContent,
          );
          if (!content.success)
            throw new ApiProblem(
              400,
              "Fallback content is too long for this target type",
            );
        }
        if (body.data.isActive === false) {
          await transaction
            .update(contentAllocationsTable)
            .set({
              isActive: false,
              deactivatedAt: new Date(),
              updatedAt: new Date(),
              updatedByUserId: req.shiftUserId!,
            })
            .where(
              and(
                eq(contentAllocationsTable.apiKeyId, req.shiftSiteId!),
                eq(contentAllocationsTable.targetId, params.data.id),
                eq(contentAllocationsTable.isActive, true),
              ),
            );
        }
        const [updated] = await transaction
          .update(contentTargetsTable)
          .set({
            ...body.data,
            updatedAt: new Date(),
            updatedByUserId: req.shiftUserId!,
          })
          .where(
            and(
              eq(contentTargetsTable.id, params.data.id),
              eq(contentTargetsTable.apiKeyId, req.shiftSiteId!),
            ),
          )
          .returning();
        return updated;
      });
      res.json(target);
    } catch (error) {
      if (!handleKnownError(res, error)) throw error;
    }
  },
);

router.delete(
  "/content/targets/:id",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const parsed = ContentIdParams.safeParse({ id: rawParam(req.params.id) });
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    try {
      await db.transaction(async (transaction) => {
        await lockTarget(transaction, req.shiftSiteId!, parsed.data.id);
        const [target] = await transaction
          .update(contentTargetsTable)
          .set({
            isActive: false,
            updatedAt: new Date(),
            updatedByUserId: req.shiftUserId!,
          })
          .where(
            and(
              eq(contentTargetsTable.id, parsed.data.id),
              eq(contentTargetsTable.apiKeyId, req.shiftSiteId!),
            ),
          )
          .returning({ id: contentTargetsTable.id });
        if (!target) throw new ApiProblem(404, "Content target not found");
        await transaction
          .update(contentAllocationsTable)
          .set({
            isActive: false,
            deactivatedAt: new Date(),
            updatedAt: new Date(),
            updatedByUserId: req.shiftUserId!,
          })
          .where(
            and(
              eq(contentAllocationsTable.apiKeyId, req.shiftSiteId!),
              eq(contentAllocationsTable.targetId, parsed.data.id),
              eq(contentAllocationsTable.isActive, true),
            ),
          );
      });
      res.status(204).end();
    } catch (error) {
      if (!handleKnownError(res, error)) throw error;
    }
  },
);

// Variant lifecycle
router.get(
  "/content/targets/:targetId/variants",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const params = TargetIdParams.safeParse({
      targetId: rawParam(req.params.targetId),
    });
    const query = VariantListQuery.safeParse(req.query);
    if (!params.success || !query.success) {
      sendFirstValidationError(res, [params, query]);
      return;
    }
    const [target] = await db
      .select({ id: contentTargetsTable.id })
      .from(contentTargetsTable)
      .where(
        and(
          eq(contentTargetsTable.id, params.data.targetId),
          eq(contentTargetsTable.apiKeyId, req.shiftSiteId!),
        ),
      )
      .limit(1);
    if (!target) {
      res.status(404).json({ error: "Content target not found" });
      return;
    }
    const conditions = [
      eq(contentVariantsTable.apiKeyId, req.shiftSiteId!),
      eq(contentVariantsTable.targetId, params.data.targetId),
    ];
    if (query.data.status)
      conditions.push(eq(contentVariantsTable.status, query.data.status));
    const rows = await db
      .select()
      .from(contentVariantsTable)
      .where(and(...conditions))
      .orderBy(desc(contentVariantsTable.version))
      .limit(query.data.limit)
      .offset(query.data.offset);
    res.json(rows);
  },
);

router.post(
  "/content/targets/:targetId/variants",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const params = TargetIdParams.safeParse({
      targetId: rawParam(req.params.targetId),
    });
    const body = CreateContentVariantBody.safeParse(req.body);
    if (!params.success || !body.success) {
      sendFirstValidationError(res, [params, body]);
      return;
    }
    try {
      const variant = await db.transaction(async (transaction) => {
        await lockTarget(transaction, req.shiftSiteId!, params.data.targetId);
        const [target] = await transaction
          .select()
          .from(contentTargetsTable)
          .where(
            and(
              eq(contentTargetsTable.id, params.data.targetId),
              eq(contentTargetsTable.apiKeyId, req.shiftSiteId!),
              eq(contentTargetsTable.isActive, true),
            ),
          )
          .limit(1);
        if (!target)
          throw new ApiProblem(404, "Active content target not found");
        if (
          !validateContentForType(target.targetType, body.data.content).success
        ) {
          throw new ApiProblem(
            400,
            "Variant content is too long for this target type",
          );
        }
        const [latest] = await transaction
          .select({ version: max(contentVariantsTable.version) })
          .from(contentVariantsTable)
          .where(
            and(
              eq(contentVariantsTable.apiKeyId, req.shiftSiteId!),
              eq(contentVariantsTable.targetId, params.data.targetId),
            ),
          );
        const [created] = await transaction
          .insert(contentVariantsTable)
          .values({
            apiKeyId: req.shiftSiteId!,
            targetId: params.data.targetId,
            version: Number(latest?.version ?? 0) + 1,
            status: "draft",
            content: body.data.content,
            createdByUserId: req.shiftUserId!,
            updatedByUserId: req.shiftUserId!,
          })
          .returning();
        return created;
      });
      res.status(201).json(variant);
    } catch (error) {
      if (!handleKnownError(res, error)) throw error;
    }
  },
);

router.get(
  "/content/variants/:id",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const parsed = ContentIdParams.safeParse({ id: rawParam(req.params.id) });
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    const [variant] = await db
      .select()
      .from(contentVariantsTable)
      .where(
        and(
          eq(contentVariantsTable.id, parsed.data.id),
          eq(contentVariantsTable.apiKeyId, req.shiftSiteId!),
        ),
      )
      .limit(1);
    if (!variant) {
      res.status(404).json({ error: "Content variant not found" });
      return;
    }
    res.json(variant);
  },
);

router.patch(
  "/content/variants/:id",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const params = ContentIdParams.safeParse({ id: rawParam(req.params.id) });
    const body = UpdateContentVariantBody.safeParse(req.body);
    if (!params.success || !body.success) {
      sendFirstValidationError(res, [params, body]);
      return;
    }
    try {
      const variant = await db.transaction(async (transaction) => {
        const [current] = await transaction
          .select({
            targetId: contentVariantsTable.targetId,
            targetType: contentTargetsTable.targetType,
            status: contentVariantsTable.status,
          })
          .from(contentVariantsTable)
          .innerJoin(
            contentTargetsTable,
            and(
              eq(contentTargetsTable.id, contentVariantsTable.targetId),
              eq(contentTargetsTable.apiKeyId, contentVariantsTable.apiKeyId),
            ),
          )
          .where(
            and(
              eq(contentVariantsTable.id, params.data.id),
              eq(contentVariantsTable.apiKeyId, req.shiftSiteId!),
            ),
          )
          .limit(1);
        if (!current) throw new ApiProblem(404, "Content variant not found");
        await lockTarget(transaction, req.shiftSiteId!, current.targetId);
        if (current.status !== "draft")
          throw new ApiProblem(409, "Only draft variants can be edited");
        if (
          !validateContentForType(current.targetType, body.data.content).success
        ) {
          throw new ApiProblem(
            400,
            "Variant content is too long for this target type",
          );
        }
        const [updated] = await transaction
          .update(contentVariantsTable)
          .set({
            content: body.data.content,
            updatedAt: new Date(),
            updatedByUserId: req.shiftUserId!,
          })
          .where(
            and(
              eq(contentVariantsTable.id, params.data.id),
              eq(contentVariantsTable.apiKeyId, req.shiftSiteId!),
              eq(contentVariantsTable.status, "draft"),
            ),
          )
          .returning();
        if (!updated)
          throw new ApiProblem(409, "Variant status changed; reload and retry");
        return updated;
      });
      res.json(variant);
    } catch (error) {
      if (!handleKnownError(res, error)) throw error;
    }
  },
);

router.post(
  "/content/variants/:id/approve",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const parsed = ContentIdParams.safeParse({ id: rawParam(req.params.id) });
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    try {
      const variant = await db.transaction(async (transaction) => {
        const [identity] = await transaction
          .select({ targetId: contentVariantsTable.targetId })
          .from(contentVariantsTable)
          .where(
            and(
              eq(contentVariantsTable.id, parsed.data.id),
              eq(contentVariantsTable.apiKeyId, req.shiftSiteId!),
            ),
          )
          .limit(1);
        if (!identity) throw new ApiProblem(404, "Content variant not found");
        await lockTarget(transaction, req.shiftSiteId!, identity.targetId);
        const [current] = await transaction
          .select()
          .from(contentVariantsTable)
          .where(
            and(
              eq(contentVariantsTable.id, parsed.data.id),
              eq(contentVariantsTable.apiKeyId, req.shiftSiteId!),
            ),
          )
          .limit(1);
        if (!current) throw new ApiProblem(404, "Content variant not found");
        if (current.status === "approved") return current;
        if (current.status !== "draft")
          throw new ApiProblem(409, "Archived variants cannot be approved");
        const now = new Date();
        const [approved] = await transaction
          .update(contentVariantsTable)
          .set({
            status: "approved",
            approvedAt: now,
            approvedByUserId: req.shiftUserId!,
            updatedAt: now,
            updatedByUserId: req.shiftUserId!,
          })
          .where(
            and(
              eq(contentVariantsTable.id, parsed.data.id),
              eq(contentVariantsTable.apiKeyId, req.shiftSiteId!),
              eq(contentVariantsTable.status, "draft"),
            ),
          )
          .returning();
        if (!approved)
          throw new ApiProblem(409, "Variant status changed; reload and retry");
        return approved;
      });
      res.json(variant);
    } catch (error) {
      if (!handleKnownError(res, error)) throw error;
    }
  },
);

async function archiveVariant(req: AuthenticatedRequest, res: Response) {
  const parsed = ContentIdParams.safeParse({ id: rawParam(req.params.id) });
  if (!parsed.success) {
    sendValidationError(res, parsed.error);
    return;
  }
  try {
    const variant = await db.transaction(async (transaction) => {
      const [identity] = await transaction
        .select({ targetId: contentVariantsTable.targetId })
        .from(contentVariantsTable)
        .where(
          and(
            eq(contentVariantsTable.id, parsed.data.id),
            eq(contentVariantsTable.apiKeyId, req.shiftSiteId!),
          ),
        )
        .limit(1);
      if (!identity) throw new ApiProblem(404, "Content variant not found");
      await lockTarget(transaction, req.shiftSiteId!, identity.targetId);
      const [current] = await transaction
        .select()
        .from(contentVariantsTable)
        .where(
          and(
            eq(contentVariantsTable.id, parsed.data.id),
            eq(contentVariantsTable.apiKeyId, req.shiftSiteId!),
          ),
        )
        .limit(1);
      if (!current) throw new ApiProblem(404, "Content variant not found");
      if (current.status === "archived") return current;
      const [allocation] = await transaction
        .select({ id: contentAllocationsTable.id })
        .from(contentAllocationsTable)
        .where(
          and(
            eq(contentAllocationsTable.apiKeyId, req.shiftSiteId!),
            eq(contentAllocationsTable.variantId, parsed.data.id),
            eq(contentAllocationsTable.isActive, true),
          ),
        )
        .limit(1);
      if (allocation)
        throw new ApiProblem(
          409,
          "Deactivate the variant's allocation before archiving it",
        );
      const now = new Date();
      const [archived] = await transaction
        .update(contentVariantsTable)
        .set({
          status: "archived",
          archivedAt: now,
          archivedByUserId: req.shiftUserId!,
          updatedAt: now,
          updatedByUserId: req.shiftUserId!,
        })
        .where(
          and(
            eq(contentVariantsTable.id, parsed.data.id),
            eq(contentVariantsTable.apiKeyId, req.shiftSiteId!),
          ),
        )
        .returning();
      return archived;
    });
    res.json(variant);
  } catch (error) {
    if (!handleKnownError(res, error)) throw error;
  }
}

router.post("/content/variants/:id/archive", archiveVariant);
router.delete("/content/variants/:id", archiveVariant);

// Goal CRUD
router.get(
  "/content/goals",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const parsed = ContentListQuery.safeParse(req.query);
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    const conditions = [eq(conversionGoalsTable.apiKeyId, req.shiftSiteId!)];
    if (!parsed.data.includeInactive)
      conditions.push(eq(conversionGoalsTable.isActive, true));
    const rows = await db
      .select()
      .from(conversionGoalsTable)
      .where(and(...conditions))
      .orderBy(
        desc(conversionGoalsTable.updatedAt),
        desc(conversionGoalsTable.id),
      )
      .limit(parsed.data.limit)
      .offset(parsed.data.offset);
    res.json(rows);
  },
);

router.post(
  "/content/goals",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const parsed = CreateConversionGoalBody.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    try {
      const [goal] = await db
        .insert(conversionGoalsTable)
        .values({
          ...parsed.data,
          apiKeyId: req.shiftSiteId!,
          createdByUserId: req.shiftUserId!,
          updatedByUserId: req.shiftUserId!,
        })
        .returning();
      res.status(201).json(goal);
    } catch (error) {
      if (!handleKnownError(res, error)) throw error;
    }
  },
);

router.get(
  "/content/goals/:id",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const parsed = ContentIdParams.safeParse({ id: rawParam(req.params.id) });
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    const [goal] = await db
      .select()
      .from(conversionGoalsTable)
      .where(
        and(
          eq(conversionGoalsTable.id, parsed.data.id),
          eq(conversionGoalsTable.apiKeyId, req.shiftSiteId!),
        ),
      )
      .limit(1);
    if (!goal) {
      res.status(404).json({ error: "Conversion goal not found" });
      return;
    }
    res.json(goal);
  },
);

router.patch(
  "/content/goals/:id",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const params = ContentIdParams.safeParse({ id: rawParam(req.params.id) });
    const body = UpdateConversionGoalBody.safeParse(req.body);
    if (!params.success || !body.success) {
      sendFirstValidationError(res, [params, body]);
      return;
    }
    try {
      const goal = await db.transaction(async (transaction) => {
        await lockGoal(transaction, req.shiftSiteId!, params.data.id);
        if (body.data.isActive === false) {
          const [allocation] = await transaction
            .select({ id: contentAllocationsTable.id })
            .from(contentAllocationsTable)
            .where(
              and(
                eq(contentAllocationsTable.apiKeyId, req.shiftSiteId!),
                eq(contentAllocationsTable.conversionGoalId, params.data.id),
                eq(contentAllocationsTable.isActive, true),
              ),
            )
            .limit(1);
          if (allocation)
            throw new ApiProblem(
              409,
              "Deactivate allocations using this goal first",
            );
        }
        const [updated] = await transaction
          .update(conversionGoalsTable)
          .set({
            ...body.data,
            updatedAt: new Date(),
            updatedByUserId: req.shiftUserId!,
          })
          .where(
            and(
              eq(conversionGoalsTable.id, params.data.id),
              eq(conversionGoalsTable.apiKeyId, req.shiftSiteId!),
            ),
          )
          .returning();
        if (!updated) throw new ApiProblem(404, "Conversion goal not found");
        return updated;
      });
      res.json(goal);
    } catch (error) {
      if (!handleKnownError(res, error)) throw error;
    }
  },
);

router.delete(
  "/content/goals/:id",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const parsed = ContentIdParams.safeParse({ id: rawParam(req.params.id) });
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    try {
      await db.transaction(async (transaction) => {
        await lockGoal(transaction, req.shiftSiteId!, parsed.data.id);
        const [allocation] = await transaction
          .select({ id: contentAllocationsTable.id })
          .from(contentAllocationsTable)
          .where(
            and(
              eq(contentAllocationsTable.apiKeyId, req.shiftSiteId!),
              eq(contentAllocationsTable.conversionGoalId, parsed.data.id),
              eq(contentAllocationsTable.isActive, true),
            ),
          )
          .limit(1);
        if (allocation)
          throw new ApiProblem(
            409,
            "Deactivate allocations using this goal first",
          );
        const [goal] = await transaction
          .update(conversionGoalsTable)
          .set({
            isActive: false,
            updatedAt: new Date(),
            updatedByUserId: req.shiftUserId!,
          })
          .where(
            and(
              eq(conversionGoalsTable.id, parsed.data.id),
              eq(conversionGoalsTable.apiKeyId, req.shiftSiteId!),
            ),
          )
          .returning({ id: conversionGoalsTable.id });
        if (!goal) throw new ApiProblem(404, "Conversion goal not found");
      });
      res.status(204).end();
    } catch (error) {
      if (!handleKnownError(res, error)) throw error;
    }
  },
);

// Active allocation
router.get(
  "/content/targets/:targetId/allocation",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const parsed = TargetIdParams.safeParse({
      targetId: rawParam(req.params.targetId),
    });
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    const [allocation] = await db
      .select()
      .from(contentAllocationsTable)
      .where(
        and(
          eq(contentAllocationsTable.apiKeyId, req.shiftSiteId!),
          eq(contentAllocationsTable.targetId, parsed.data.targetId),
          eq(contentAllocationsTable.isActive, true),
        ),
      )
      .limit(1);
    if (!allocation) {
      res.status(404).json({ error: "Active allocation not found" });
      return;
    }
    res.json(allocation);
  },
);

router.put(
  "/content/targets/:targetId/allocation",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const params = TargetIdParams.safeParse({
      targetId: rawParam(req.params.targetId),
    });
    const body = PutContentAllocationBody.safeParse(req.body);
    if (!params.success || !body.success) {
      sendFirstValidationError(res, [params, body]);
      return;
    }
    try {
      const result = await db.transaction(async (transaction) => {
        await lockTarget(transaction, req.shiftSiteId!, params.data.targetId);
        const [target] = await transaction
          .select({ id: contentTargetsTable.id })
          .from(contentTargetsTable)
          .where(
            and(
              eq(contentTargetsTable.id, params.data.targetId),
              eq(contentTargetsTable.apiKeyId, req.shiftSiteId!),
              eq(contentTargetsTable.isActive, true),
            ),
          )
          .limit(1);
        if (!target)
          throw new ApiProblem(404, "Active content target not found");
        const [variant] = await transaction
          .select({ id: contentVariantsTable.id })
          .from(contentVariantsTable)
          .where(
            and(
              eq(contentVariantsTable.id, body.data.variantId),
              eq(contentVariantsTable.apiKeyId, req.shiftSiteId!),
              eq(contentVariantsTable.targetId, params.data.targetId),
              eq(contentVariantsTable.status, "approved"),
            ),
          )
          .limit(1);
        if (!variant)
          throw new ApiProblem(
            400,
            "Allocation variant must be approved and belong to this target",
          );
        if (body.data.conversionGoalId != null) {
          await lockGoal(
            transaction,
            req.shiftSiteId!,
            body.data.conversionGoalId,
          );
          const [goal] = await transaction
            .select({ id: conversionGoalsTable.id })
            .from(conversionGoalsTable)
            .where(
              and(
                eq(conversionGoalsTable.id, body.data.conversionGoalId),
                eq(conversionGoalsTable.apiKeyId, req.shiftSiteId!),
                eq(conversionGoalsTable.isActive, true),
              ),
            )
            .limit(1);
          if (!goal)
            throw new ApiProblem(
              400,
              "Conversion goal must be active and belong to this site",
            );
        }
        const [current] = await transaction
          .select({ id: contentAllocationsTable.id })
          .from(contentAllocationsTable)
          .where(
            and(
              eq(contentAllocationsTable.apiKeyId, req.shiftSiteId!),
              eq(contentAllocationsTable.targetId, params.data.targetId),
              eq(contentAllocationsTable.isActive, true),
            ),
          )
          .limit(1);
        const now = new Date();
        if (current) {
          await transaction
            .update(contentAllocationsTable)
            .set({
              isActive: false,
              deactivatedAt: now,
              updatedAt: now,
              updatedByUserId: req.shiftUserId!,
            })
            .where(
              and(
                eq(contentAllocationsTable.id, current.id),
                eq(contentAllocationsTable.apiKeyId, req.shiftSiteId!),
              ),
            );
        }
        const [allocation] = await transaction
          .insert(contentAllocationsTable)
          .values({
            apiKeyId: req.shiftSiteId!,
            targetId: params.data.targetId,
            variantId: body.data.variantId,
            conversionGoalId: body.data.conversionGoalId ?? null,
            controlPercentage: body.data.controlPercentage,
            createdByUserId: req.shiftUserId!,
            updatedByUserId: req.shiftUserId!,
          })
          .returning();
        return { allocation, replaced: Boolean(current) };
      });
      res.status(result.replaced ? 200 : 201).json(result.allocation);
    } catch (error) {
      if (!handleKnownError(res, error)) throw error;
    }
  },
);

router.delete(
  "/content/targets/:targetId/allocation",
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const parsed = TargetIdParams.safeParse({
      targetId: rawParam(req.params.targetId),
    });
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    try {
      await db.transaction(async (transaction) => {
        await lockTarget(transaction, req.shiftSiteId!, parsed.data.targetId);
        const now = new Date();
        const [allocation] = await transaction
          .update(contentAllocationsTable)
          .set({
            isActive: false,
            deactivatedAt: now,
            updatedAt: now,
            updatedByUserId: req.shiftUserId!,
          })
          .where(
            and(
              eq(contentAllocationsTable.apiKeyId, req.shiftSiteId!),
              eq(contentAllocationsTable.targetId, parsed.data.targetId),
              eq(contentAllocationsTable.isActive, true),
            ),
          )
          .returning({ id: contentAllocationsTable.id });
        if (!allocation)
          throw new ApiProblem(404, "Active allocation not found");
      });
      res.status(204).end();
    } catch (error) {
      if (!handleKnownError(res, error)) throw error;
    }
  },
);

export default router;
