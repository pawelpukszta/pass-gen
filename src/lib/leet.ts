/**
 * l33t ("leetspeak"): replacing letters with similar-looking digits, e.g. "zielony" -> "z13l0ny".
 *
 * Applied to word tokens of memorable passwords only (never to the number or specials).
 * The first character of each token is never replaced, so capitalization stays readable
 * and the uppercase rule is not weakened.
 *
 * Security note: full substitution ("all") adds no entropy, because cracking tools try
 * these substitutions by default. Only the random modes ("one", "random") add bits,
 * at the cost of memorability.
 */

import type { HintSegment } from './generators';
import type { RandomInt } from './random';

/** none | one per word | each eligible letter with 50% chance | every eligible letter. */
export type LeetMode = 'none' | 'one' | 'random' | 'all';

/** Letter -> digit. Kept in sync with the LEET map used by the policy normalizer. */
export const LEET_SUBSTITUTIONS: Readonly<Record<string, string>> = {
  a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', b: '8', g: '9',
};

export interface LeetToken {
  password: string;
  hint: HintSegment[];
}

/** Indexes of characters that may be replaced (never the first one). */
export function eligibleIndexes(token: string): number[] {
  const out: number[] = [];
  [...token].forEach((ch, i) => {
    if (i > 0 && LEET_SUBSTITUTIONS[ch.toLowerCase()]) out.push(i);
  });
  return out;
}

/**
 * Applies l33t to one ASCII token.
 * `original` is the same token in Polish spelling; deburr maps characters 1:1,
 * so positions match and the hint can keep diacritics around the replaced letters.
 */
export function leetify(token: string, original: string, mode: LeetMode, rand: RandomInt): LeetToken {
  if (mode === 'none') return { password: token, hint: [{ text: original }] };

  const eligible = eligibleIndexes(token);
  let chosen: number[];
  if (mode === 'all') chosen = eligible;
  else if (mode === 'one') chosen = eligible.length ? [eligible[rand(eligible.length)]!] : [];
  else chosen = eligible.filter(() => rand(2) === 1);
  const replace = new Set(chosen);

  const chars = [...token];
  const originalChars = [...original];
  const hint: HintSegment[] = [];
  let plain = '';
  chars.forEach((ch, i) => {
    if (replace.has(i)) {
      const digit = LEET_SUBSTITUTIONS[ch.toLowerCase()]!;
      chars[i] = digit;
      if (plain) { hint.push({ text: plain }); plain = ''; }
      hint.push({ text: digit, strong: true });
    } else {
      plain += originalChars[i] ?? ch;
    }
  });
  if (plain) hint.push({ text: plain });
  return { password: chars.join(''), hint };
}

/** Entropy (bits) that l33t adds to one word or phrase (tokens separated by spaces). */
export function leetBitsForWord(ascii: string, mode: LeetMode): number {
  if (mode === 'none' || mode === 'all') return 0;
  return ascii.split(' ').reduce((sum, token) => {
    const n = eligibleIndexes(token).length;
    if (mode === 'one') return sum + (n > 1 ? Math.log2(n) : 0);
    return sum + n; // random: one bit per eligible letter
  }, 0);
}

const averageCache = new WeakMap<readonly { ascii: string }[], Map<LeetMode, number>>();

/** Average l33t bits over a word list (memoized per list and mode). */
export function averageLeetBits(list: readonly { ascii: string }[], mode: LeetMode): number {
  if (mode === 'none' || mode === 'all' || list.length === 0) return 0;
  let perMode = averageCache.get(list);
  if (!perMode) averageCache.set(list, (perMode = new Map()));
  let value = perMode.get(mode);
  if (value === undefined) {
    value = list.reduce((sum, w) => sum + leetBitsForWord(w.ascii, mode), 0) / list.length;
    perMode.set(mode, value);
  }
  return value;
}
