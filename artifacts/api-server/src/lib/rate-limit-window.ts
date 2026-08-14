export function fixedWindowStart(now: number, windowMs: number): number {
  return Math.floor(now / windowMs) * windowMs;
}
