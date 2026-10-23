/**
 * Suggests memorable-mode settings that fit a password length range.
 *
 * Generation itself always respects the user's settings: words are picked only among
 * combinations that fit the range (lib/length-plan.ts). This module is used only when
 * NO combination fits (e.g. a full sentence in 8-14 characters). It then proposes the
 * strongest settings that do fit, which the user can apply with one click.
 *
 * Greedy search: at each step try every single change (drop or add a word, separators,
 * a digit, a sentence part, special characters) and keep the one with the best score:
 * effective entropy bits + log2(fitting share) when something fits, otherwise the
 * smallest distance between the possible lengths and the range.
 */

import {
  entropyBits, lengthFitInfo,
  type LengthRange, type Mode, type ModeOptions, type SpecialPlacement,
} from './generators';
import { plural } from './text';

const MAX_STEPS = 20;

export interface LengthFit {
  /** Proposed settings (the user's own settings when they already fit). */
  options: ModeOptions;
  /** True when some combination of `options` fits the range. */
  feasible: boolean;
  /** Human-readable differences from the user's settings (English UI text). */
  changes: string[];
}

type Step = (o: ModeOptions) => boolean;

const lowerSpecials = (p: SpecialPlacement): SpecialPlacement | null =>
  p === 'separator' ? 'number' : p === 'number' || p === 'word' ? 'none' : null;

/** Steps that make passwords shorter. Each mutates a copy and returns false when not applicable. */
const SHRINK: Record<Exclude<Mode, 'random'>, Step[]> = {
  sentence: [
    (o) => o.sentence.separator !== '' && ((o.sentence.separator = ''), true),
    (o) => o.sentence.place && !(o.sentence.place = false),
    (o) => o.sentence.adverb && !(o.sentence.adverb = false),
    (o) => o.sentence.adjectives && !(o.sentence.adjectives = false),
    (o) => o.sentence.digits > 1 && Boolean(o.sentence.digits--),
    (o) => { const n = lowerSpecials(o.sentence.specials); return n !== null && Boolean(o.sentence.specials = n); },
  ],
  words: [
    (o) => o.words.separator !== '' && o.words.specials !== 'separator' && ((o.words.separator = ''), true),
    (o) => o.words.count > 1 && Boolean(o.words.count--),
    (o) => o.words.digits > 1 && Boolean(o.words.digits--),
    (o) => { const n = lowerSpecials(o.words.specials); return n !== null && Boolean(o.words.specials = n); },
  ],
  slang: [
    (o) => o.slang.separator !== '' && o.slang.specials !== 'separator' && ((o.slang.separator = ''), true),
    (o) => o.slang.extraWords > 0 && Boolean(o.slang.extraWords--),
    (o) => o.slang.slangCount > 1 && Boolean(o.slang.slangCount--),
    (o) => o.slang.digits > 1 && Boolean(o.slang.digits--),
    (o) => { const n = lowerSpecials(o.slang.specials); return n !== null && Boolean(o.slang.specials = n); },
  ],
};

/** Steps that make passwords longer (used when most candidates are too short). */
const GROW: Record<Exclude<Mode, 'random'>, Step[]> = {
  sentence: [
    (o) => !o.sentence.place && (o.sentence.place = true),
    (o) => !o.sentence.adverb && (o.sentence.adverb = true),
    (o) => !o.sentence.adjectives && (o.sentence.adjectives = true),
    (o) => o.sentence.digits < 4 && Boolean(++o.sentence.digits),
    (o) => o.sentence.separator === '' && Boolean(o.sentence.separator = '-'),
  ],
  words: [
    (o) => o.words.count < 8 && Boolean(++o.words.count),
    (o) => o.words.digits < 4 && Boolean(++o.words.digits),
    (o) => o.words.separator === '' && Boolean(o.words.separator = '-'),
  ],
  slang: [
    (o) => o.slang.extraWords < 4 && Boolean(++o.slang.extraWords),
    (o) => o.slang.slangCount < 6 && Boolean(++o.slang.slangCount),
    (o) => o.slang.digits < 4 && Boolean(++o.slang.digits),
    (o) => o.slang.separator === '' && Boolean(o.slang.separator = '-'),
  ],
};

function score(mode: Mode, o: ModeOptions, specials: readonly string[], range: LengthRange): number {
  const info = lengthFitInfo(mode, o, specials.length, range);
  if (info.fitting > 0) return entropyBits(mode, o, specials) + Math.log2(info.fraction);
  const tooLong = range.max > 0 && info.minLength > range.max ? info.minLength - range.max : 0;
  const tooShort = info.maxLength < range.min ? range.min - info.maxLength : 0;
  return -1e6 - (tooLong + tooShort || 0.5);
}

export function suggestFit(mode: Mode, options: ModeOptions, specials: readonly string[], range: LengthRange): LengthFit {
  if (mode === 'random') return { options, feasible: true, changes: [] };
  let best = structuredClone(options);
  let bestScore = score(mode, best, specials, range);
  if (bestScore > -1e6) return { options, feasible: true, changes: [] };

  for (let step = 0; step < MAX_STEPS && bestScore <= -1e6; step++) {
    let next: { o: ModeOptions; score: number } | null = null;
    for (const apply of [...SHRINK[mode], ...GROW[mode]]) {
      const o = structuredClone(best);
      if (!apply(o)) continue;
      const sc = score(mode, o, specials, range);
      if (!next || sc > next.score) next = { o, score: sc };
    }
    if (!next || next.score <= bestScore) break; // no step brings us closer
    best = next.o;
    bestScore = next.score;
  }
  const feasible = bestScore > -1e6;
  return { options: feasible ? best : options, feasible, changes: feasible ? describeChanges(mode, options, best) : [] };
}

// ---------------------------------------------------------------------------
// Human-readable differences
// ---------------------------------------------------------------------------

const words = (n: number) => `${n} ${plural(n, 'word', 'words')}`;
const digits = (n: number) => `${n} ${plural(n, 'digit', 'digits')}`;
const SPECIAL_TEXT: Record<SpecialPlacement, string> = {
  none: 'no special character', number: 'special character next to the number',
  word: 'special character next to a word', separator: 'special characters as separators',
};

function common(
  out: string[],
  a: { digits: number; separator: string; specials: SpecialPlacement },
  b: { digits: number; separator: string; specials: SpecialPlacement },
): void {
  if (a.separator !== b.separator) out.push(b.separator === '' ? 'no separators' : `separator "${b.separator}"`);
  if (a.digits !== b.digits) out.push(`${digits(b.digits)} instead of ${a.digits}`);
  if (a.specials !== b.specials) out.push(SPECIAL_TEXT[b.specials]);
}

export function describeChanges(mode: Mode, before: ModeOptions, after: ModeOptions): string[] {
  const out: string[] = [];
  if (mode === 'sentence') {
    const a = before.sentence, b = after.sentence;
    if (a.adjectives !== b.adjectives) out.push(b.adjectives ? 'with adjectives' : 'no adjectives');
    if (a.adverb !== b.adverb) out.push(b.adverb ? 'with an adverb' : 'no adverb');
    if (a.place !== b.place) out.push(b.place ? 'with a place' : 'no place');
    common(out, a, b);
  } else if (mode === 'words') {
    const a = before.words, b = after.words;
    if (a.count !== b.count) out.push(`${words(b.count)} instead of ${a.count}`);
    common(out, a, b);
  } else if (mode === 'slang') {
    const a = before.slang, b = after.slang;
    if (a.slangCount !== b.slangCount) out.push(`${b.slangCount} slang ${plural(b.slangCount, 'word', 'words')} instead of ${a.slangCount}`);
    if (a.extraWords !== b.extraWords) out.push(`ordinary words: ${b.extraWords} instead of ${a.extraWords}`);
    common(out, a, b);
  }
  return out;
}

