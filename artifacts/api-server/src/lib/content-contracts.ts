import { z } from "zod";

export const ContentTargetType = z.enum(["headline", "subheadline", "cta"]);
export const ContentVariantStatus = z.enum(["draft", "approved", "archived"]);

const keyPattern = /^[a-z][a-z0-9_-]{1,63}$/;
const eventPattern = /^[a-z][a-z0-9_.:-]{1,119}$/;

export const ContentKey = z.string().trim().regex(keyPattern);
export const PagePath = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (value) => value === "*" || (value.startsWith("/") && !/[?#]/.test(value)),
    "Page path must be '*' or an absolute path without query or fragment",
  );
export const ContentSelector = z.string().trim().min(1).max(500);

const contentLimits = {
  headline: 200,
  subheadline: 400,
  cta: 120,
} as const;

export function validateContentForType(
  type: z.infer<typeof ContentTargetType>,
  content: string,
) {
  return z.string().trim().min(1).max(contentLimits[type]).safeParse(content);
}

export const ContentIdParams = z
  .object({ id: z.coerce.number().int().positive() })
  .strict();
export const TargetIdParams = z
  .object({ targetId: z.coerce.number().int().positive() })
  .strict();

export const ContentListQuery = z
  .object({
    includeInactive: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
  })
  .strict();

export const VariantListQuery = z
  .object({
    status: ContentVariantStatus.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
  })
  .strict();

export const CreateContentTargetBody = z
  .object({
    targetKey: ContentKey,
    targetType: ContentTargetType,
    name: z.string().trim().min(1).max(120),
    pagePath: PagePath.default("*"),
    selector: ContentSelector,
    fallbackContent: z.string().trim().min(1).max(500),
  })
  .strict()
  .superRefine((value, context) => {
    const result = validateContentForType(
      value.targetType,
      value.fallbackContent,
    );
    if (!result.success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fallbackContent"],
        message: "Content is too long for this target type",
      });
    }
  });

export const UpdateContentTargetBody = z
  .object({
    targetKey: ContentKey.optional(),
    name: z.string().trim().min(1).max(120).optional(),
    pagePath: PagePath.optional(),
    selector: ContentSelector.optional(),
    fallbackContent: z.string().trim().min(1).max(500).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

export const CreateContentVariantBody = z
  .object({
    content: z.string().trim().min(1).max(500),
  })
  .strict();

export const UpdateContentVariantBody = CreateContentVariantBody;

export const CreateConversionGoalBody = z
  .object({
    goalKey: ContentKey,
    name: z.string().trim().min(1).max(120),
    eventName: z.string().trim().regex(eventPattern),
  })
  .strict();

export const UpdateConversionGoalBody = z
  .object({
    goalKey: ContentKey.optional(),
    name: z.string().trim().min(1).max(120).optional(),
    eventName: z.string().trim().regex(eventPattern).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

export const PutContentAllocationBody = z
  .object({
    variantId: z.number().int().positive(),
    conversionGoalId: z.number().int().positive().nullable().optional(),
    controlPercentage: z.number().int().min(0).max(100),
  })
  .strict();

export function canTransitionVariant(
  current: z.infer<typeof ContentVariantStatus>,
  next: z.infer<typeof ContentVariantStatus>,
) {
  if (current === next) return true;
  return (
    (current === "draft" && (next === "approved" || next === "archived")) ||
    (current === "approved" && next === "archived")
  );
}
