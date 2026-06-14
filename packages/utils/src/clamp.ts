/**
 * Restrict a number to be within the inclusive range `[min, max]`.
 *
 * @example
 * clamp(5, 0, 10) // 5
 * clamp(-3, 0, 10) // 0
 * clamp(42, 0, 10) // 10
 */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError(`clamp: min (${min}) must not be greater than max (${max})`);
  }
  return Math.min(Math.max(value, min), max);
}