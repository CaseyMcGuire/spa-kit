/**
 * Merge two objects, throwing if they share any key.
 *
 * Unlike a plain spread, this guarantees no property from `obj1` is silently
 * overwritten by `obj2` — an overlapping key is treated as a programming error.
 * The keys compared are exactly the ones a spread copies: own enumerable keys,
 * string and symbol alike. A key `obj1` merely inherits (e.g. `toString`) is
 * not a duplicate.
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
  for (const key of Reflect.ownKeys(obj2)) {
    if (!Object.prototype.propertyIsEnumerable.call(obj2, key)) {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(obj1, key)) {
      throw new Error(`Duplicate key detected: "${String(key)}" cannot be merged.`);
    }
  }

  return { ...obj1, ...obj2 } as T & U;
}