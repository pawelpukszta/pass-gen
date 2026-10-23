/**
 * Randomness helpers. Every generator takes a RandomInt so tests can inject a
 * deterministic source; production code uses the browser's CSPRNG.
 */

/** Returns a uniformly distributed integer in [0, n). */
export type RandomInt = (n: number) => number;

const buffer = new Uint32Array(1);
const RANGE = 0x1_0000_0000; // 2^32

/**
 * Cryptographically secure, unbiased integer in [0, n).
 * Uses rejection sampling to avoid modulo bias.
 */
export const cryptoRandomInt: RandomInt = (n) => {
  if (!Number.isInteger(n) || n <= 0 || n > RANGE) {
    throw new RangeError(`cryptoRandomInt: invalid upper bound ${n}`);
  }
  const limit = Math.floor(RANGE / n) * n;
  let x: number;
  do {
    crypto.getRandomValues(buffer);
    x = buffer[0]!;
  } while (x >= limit);
  return x % n;
};

/** Picks one element of a non-empty array. */
export function pick<T>(items: readonly T[], rand: RandomInt): T {
  if (items.length === 0) throw new RangeError('pick: empty list');
  return items[rand(items.length)]!;
}

/** Random string of decimal digits (leading zeros allowed). */
export function randomDigits(count: number, rand: RandomInt): string {
  let out = '';
  for (let i = 0; i < count; i++) out += String(rand(10));
  return out;
}
