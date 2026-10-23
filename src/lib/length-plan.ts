/**
 * Length-aware word selection for memorable passwords.
 *
 * A memorable password is: words (or phrases) joined by a separator, plus a number and
 * an optional special character. Its length is therefore
 *
 *   length = Σ weight(word_i) + overhead
 *   weight(word) = letters(word) + joinLength × tokens(word)
 *   overhead     = digits + (1 if a special character is attached to the number or a word)
 *
 * where `joinLength` is the separator length (or 1 when special characters are the separators)
 * and `tokens` is the number of words in a phrase ("on the roof" = 3). One join per token
 * accounts for the joins between words and the join before/after the number.
 *
 * Given that, a dynamic program counts how many word combinations produce each length, which lets us
 *  - pick words uniformly at random among ONLY the combinations that fit a length range
 *    (no rejection sampling, the user's settings stay exactly as chosen), and
 *  - compute exactly what share of combinations fits, for the entropy estimate.
 */

import type { LengthRange, Word } from './generators';
import type { RandomInt } from './random';

export interface LengthPlan {
  /** One word list per position, in password order (order does not affect counts). */
  slots: readonly (readonly Word[])[];
  /** Characters each token adds through joins. */
  joinLength: number;
  /** Fixed characters: digits and an attached special character. */
  overhead: number;
}

export interface LengthStats {
  /** All word combinations (product of list sizes). */
  combinations: number;
  /** Combinations whose password length fits the range. */
  fitting: number;
  /** fitting / combinations (0..1). */
  fraction: number;
  /** Shortest and longest password length these settings can produce. */
  minLength: number;
  maxLength: number;
  /** Typical lengths: 10th and 90th percentile over all combinations (ignores the range). */
  typicalMin: number;
  typicalMax: number;
}

export function tokenWeight(word: Word, joinLength: number): number {
  const tokens = word.ascii.split(' ');
  return tokens.join('').length + joinLength * tokens.length;
}

const histogramCache = new WeakMap<readonly Word[], Map<number, Map<number, Word[]>>>();

/** Words of a list grouped by weight (memoized per list and join length). */
export function histogram(list: readonly Word[], joinLength: number): Map<number, Word[]> {
  let perJoin = histogramCache.get(list);
  if (!perJoin) histogramCache.set(list, (perJoin = new Map()));
  let hist = perJoin.get(joinLength);
  if (!hist) {
    hist = new Map();
    for (const w of list) {
      const weight = tokenWeight(w, joinLength);
      const bucket = hist.get(weight);
      if (bucket) bucket.push(w); else hist.set(weight, [w]);
    }
    perJoin.set(joinLength, hist);
  }
  return hist;
}

/** dp[i] maps a weight sum to the number of combinations of the first i slots giving that sum. */
function table(plan: LengthPlan): Map<number, number>[] {
  const dp: Map<number, number>[] = [new Map([[0, 1]])];
  plan.slots.forEach((list, i) => {
    const next = new Map<number, number>();
    const hist = histogram(list, plan.joinLength);
    for (const [sum, count] of dp[i]!) {
      for (const [weight, words] of hist) {
        next.set(sum + weight, (next.get(sum + weight) ?? 0) + count * words.length);
      }
    }
    dp.push(next);
  });
  return dp;
}

const fits = (length: number, range: LengthRange) => length >= range.min && (range.max === 0 || length <= range.max);

export function lengthStats(plan: LengthPlan, range: LengthRange): LengthStats {
  const final = [...table(plan).at(-1)!].sort((a, b) => a[0] - b[0]);
  let combinations = 0, fitting = 0;
  for (const [sum, count] of final) {
    combinations += count;
    if (fits(sum + plan.overhead, range)) fitting += count;
  }
  // Percentiles of the length distribution (every combination is equally likely).
  const quantile = (q: number) => {
    let seen = 0;
    for (const [sum, count] of final) {
      seen += count;
      if (seen >= q * combinations) return sum + plan.overhead;
    }
    return 0;
  };
  return {
    combinations, fitting, fraction: combinations ? fitting / combinations : 0,
    minLength: final.length ? final[0]![0] + plan.overhead : 0,
    maxLength: final.length ? final.at(-1)![0] + plan.overhead : 0,
    typicalMin: quantile(0.1),
    typicalMax: quantile(0.9),
  };
}

/** Uniform float in [0, 1) with 53 random bits, built from the injected integer source. */
export function randomUnit(rand: RandomInt): number {
  return (rand(2 ** 26) * 2 ** 27 + rand(2 ** 27)) / 2 ** 53;
}

/** Picks from `entries` with probability proportional to their weights. */
function weightedPick<T>(entries: readonly [T, number][], rand: RandomInt): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = randomUnit(rand) * total;
  for (const [value, weight] of entries) {
    if (r < weight) return value;
    r -= weight;
  }
  return entries.at(-1)![0];
}

/**
 * Picks one word per slot, uniformly among the combinations whose password length fits the range.
 * Returns null when no combination fits.
 */
export function pickForLength(plan: LengthPlan, range: LengthRange, rand: RandomInt): Word[] | null {
  const dp = table(plan);
  const final = dp.at(-1)!;
  const sums = [...final].filter(([sum]) => fits(sum + plan.overhead, range));
  if (sums.length === 0) return null;

  // 1) Choose the total weight, proportionally to how many combinations reach it.
  let remaining = weightedPick(sums.map(([sum, count]) => [sum, count] as [number, number]), rand);
  // 2) Walk back through the slots, choosing each word's weight consistently with the total.
  const picked: Word[] = new Array(plan.slots.length);
  for (let i = plan.slots.length - 1; i >= 0; i--) {
    const hist = histogram(plan.slots[i]!, plan.joinLength);
    const options: [number, number][] = [];
    for (const [weight, words] of hist) {
      const before = dp[i]!.get(remaining - weight);
      if (before) options.push([weight, before * words.length]);
    }
    const weight = weightedPick(options, rand);
    const words = hist.get(weight)!;
    picked[i] = words[rand(words.length)]!;
    remaining -= weight;
  }
  return picked;
}
