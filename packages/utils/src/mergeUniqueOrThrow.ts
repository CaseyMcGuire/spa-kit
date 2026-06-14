/**
 * Merge two objects, throwing if they share any key.
 *
 * Unlike a plain spread, this guarantees no property from `obj1` is silently
 * overwritten by `obj2` — an overlapping key is treated as a programming error.
 *
 * @throws If a key exists in both objects.
 *
 * @example
 * mergeUniqueOrThrow({ a: 1 }, { b: 2 }) // { a: 1, b: 2 }
 * mergeUniqueOrThrow({ a: 1 }, { a: 2 }) // throws
 */
export function mergeUniqueOrThrow<T extends object, U extends object>(
  obj1: T,
  obj2: U,
): T & U {
  const keys2 = Object.keys(obj2);

  for (const key of keys2) {
    if (key in obj1) {
      throw new Error(`Duplicate key detected: "${key}" cannot be merged.`);
    }
  }

  return { ...obj1, ...obj2 } as T & U;
}