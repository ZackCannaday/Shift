import { createHash } from "node:crypto";

export type RuntimeTargetType = "headline" | "subheadline" | "cta";

export interface RuntimeContentTarget {
  targetId: number;
  targetKey: string;
  targetType: RuntimeTargetType;
  pagePath: string;
  fallbackContent: string;
  variantId: number;
  variantVersion: number;
  variantContent: string;
  controlPercentage: number;
}

export interface ContentAssignment {
  targetId: number;
  targetKey: string;
  targetType: RuntimeTargetType;
  variantId: number;
  variantVersion: number;
  arm: "control" | "challenger";
  bucket: number;
  controlPercentage: number;
}

interface SelectApprovedContentInput {
  siteId: number;
  sessionId: string;
  pageUrl?: string;
  targets: RuntimeContentTarget[];
}

interface SelectedContent {
  headline?: string;
  subheadline?: string;
  ctaText?: string;
}

export function normalizePagePath(pageUrl?: string): string | null {
  if (!pageUrl) return null;
  try {
    const url = new URL(pageUrl, "https://shift.invalid");
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const collapsed = url.pathname.replace(/\/{2,}/g, "/");
    return collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : "/";
  } catch {
    return null;
  }
}

export function targetMatchesPath(
  targetPath: string,
  requestPath: string | null,
) {
  if (targetPath === "*") return true;
  return requestPath !== null && normalizePagePath(targetPath) === requestPath;
}

export function assignmentBucket(
  siteId: number,
  sessionId: string,
  targetId: number,
) {
  const digest = createHash("sha256")
    .update(`${siteId}:${sessionId}:${targetId}`)
    .digest();
  return digest.readUInt32BE(0) % 100;
}

export function assignmentArm(bucket: number, controlPercentage: number) {
  return bucket < controlPercentage
    ? ("control" as const)
    : ("challenger" as const);
}

export function selectApprovedContent(input: SelectApprovedContentInput) {
  const requestPath = normalizePagePath(input.pageUrl);
  const preferred = [...input.targets]
    .filter((target) => targetMatchesPath(target.pagePath, requestPath))
    .sort((left, right) => {
      const pathPriority =
        Number(left.pagePath === "*") - Number(right.pagePath === "*");
      return pathPriority || left.targetId - right.targetId;
    });

  const seenTypes = new Set<RuntimeTargetType>();
  const content: SelectedContent = {};
  const assignments: ContentAssignment[] = [];
  for (const target of preferred) {
    if (seenTypes.has(target.targetType)) continue;
    seenTypes.add(target.targetType);
    const bucket = assignmentBucket(
      input.siteId,
      input.sessionId,
      target.targetId,
    );
    const arm = assignmentArm(bucket, target.controlPercentage);
    const selected =
      arm === "control" ? target.fallbackContent : target.variantContent;
    if (target.targetType === "headline") content.headline = selected;
    if (target.targetType === "subheadline") content.subheadline = selected;
    if (target.targetType === "cta") content.ctaText = selected;
    assignments.push({
      targetId: target.targetId,
      targetKey: target.targetKey,
      targetType: target.targetType,
      variantId: target.variantId,
      variantVersion: target.variantVersion,
      arm,
      bucket,
      controlPercentage: target.controlPercentage,
    });
  }

  return {
    contentConfigured: assignments.length > 0,
    assignments,
    content,
  };
}
