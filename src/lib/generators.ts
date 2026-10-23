/**
 * Password generators.
 *
 * Four modes:
 *  - sentence: a grammatical, absurd sentence in English (default) or Polish,
 *              e.g. "Grumpy pirate quietly polishes golden teapot on the roof 472"
 *              or "Rudy kot cicho je zielony ser na dachu 472"
 *  - words:    a classic passphrase made of random words and a number
 *              (English: EFF Large Wordlist; Polish: all single words from the Polish lists)
 *  - slang:    a passphrase mixing Polish slang (with explanations) and ordinary words
 *  - random:   random characters
 *
 * Generators are pure given a RandomInt, which makes them easy to test.
 * Compliance with the policy is enforced by generateCompliant (rejection sampling).
 */

import { EFF_LARGE_WORDLIST } from '../data/eff-large-wordlist';
import {
  ADJECTIVES, ADVERBS, EXTRA_NOUNS, OBJECTS, PLACES, SUBJECTS, VERBS,
} from '../data/wordlists';
import {
  EN_ADJECTIVES, EN_ADVERBS, EN_OBJECTS, EN_PLACES, EN_SUBJECTS, EN_VERBS,
} from '../data/wordlists-en';
import { miejskiUrl, SLANG } from '../data/slang';
import { averageLeetBits, leetify, type LeetMode } from './leet';
import { lengthStats, pickForLength, type LengthPlan, type LengthStats } from './length-plan';
import { isCompliant, validatePassword, type PolicyContext } from './policy';
import { pick, randomDigits, type RandomInt } from './random';
import { capitalize, deburr } from './text';

export type Mode = 'sentence' | 'words' | 'slang' | 'random';
/** Word language for the sentence and words modes. The slang mode is always Polish. */
export type Language = 'en' | 'pl';
export type NumberPosition = 'end' | 'random';
/**
 * Where special characters go in memorable modes:
 * none   - no special characters,
 * number - one, right after the number ("472?"),
 * word   - one, appended to a random word ("Ser@"),
 * separator - every separator is a random special character ("Kot&Ser$Na...").
 */
export type SpecialPlacement = 'none' | 'number' | 'word' | 'separator';

export interface SentenceOptions {
  adjectives: boolean;
  adverb: boolean;
  place: boolean;
  digits: number;
  numberPosition: NumberPosition;
  separator: string;
  specials: SpecialPlacement;
  /** Letter -> digit substitutions in words, see lib/leet.ts. */
  leet: LeetMode;
}

export interface WordsOptions {
  count: number;
  /** each = every word capitalized; one = a single random word in UPPERCASE. */
  caps: 'each' | 'one';
  digits: number;
  numberPosition: NumberPosition;
  separator: string;
  specials: SpecialPlacement;
  /** Letter -> digit substitutions in words, see lib/leet.ts. */
  leet: LeetMode;
}

export interface SlangOptions extends Omit<WordsOptions, 'count'> {
  /** Number of slang terms. */
  slangCount: number;
  /** Number of ordinary words mixed in at random positions. */
  extraWords: number;
  /** Include profanity (explicit opt-in). */
  allowVulgar: boolean;
}

export interface RandomOptions {
  length: number;
  useSpecials: boolean;
  excludeAmbiguous: boolean;
  /** Guaranteed minimum count of special characters when useSpecials is on. */
  minSpecials: number;
}

export interface ModeOptions {
  language: Language;
  sentence: SentenceOptions;
  words: WordsOptions;
  slang: SlangOptions;
  random: RandomOptions;
}

export interface GeneratorContext {
  /** Allowed special characters; empty disables special characters everywhere. */
  specials: readonly string[];
  rand: RandomInt;
  /**
   * When set, memorable modes pick words only among combinations whose password length
   * fits this range (see lib/length-plan.ts). All other settings are kept as they are.
   */
  lengthRange?: LengthRange;
}

/** A piece of the human-readable memory hint; strong pieces are rendered bold. */
export interface HintSegment {
  text: string;
  strong?: boolean;
}

/** Explanation of a slang term used in a password. */
export interface GlossaryEntry {
  term: string;
  meaning: string;
  vulgar: boolean;
  /** Entry in Miejski Słownik Slangu. Opening it reveals the word to that site. */
  url: string;
}

export interface Candidate {
  password: string;
  /** Empty for the random mode. */
  hint: HintSegment[];
  /** Present in the slang mode only. */
  glossary?: GlossaryEntry[];
}

// ---------------------------------------------------------------------------
// Word bank: original spelling for the hint + ASCII form for the password.
// ---------------------------------------------------------------------------

export interface Word {
  /** Original spelling (Polish letters kept), may contain spaces (phrases). */
  original: string;
  /** Lowercase ASCII form used in passwords. */
  ascii: string;
}

export interface SlangWord extends Word {
  meaning: string;
  vulgar: boolean;
}

function toSlangWords(): SlangWord[] {
  const seen = new Set<string>();
  const out: SlangWord[] = [];
  for (const e of SLANG) {
    const ascii = deburr(e.term.toLowerCase());
    if (seen.has(ascii) || e.term.includes(' ') || ascii.length < 3 || ascii.length > 12) continue;
    seen.add(ascii);
    out.push({ original: e.term, ascii, meaning: e.meaning, vulgar: Boolean(e.vulgar) });
  }
  return out;
}

function toWords(list: readonly string[], singleOnly = false): Word[] {
  const seen = new Set<string>();
  const out: Word[] = [];
  for (const raw of list) {
    const original = raw.trim();
    const ascii = deburr(original.toLowerCase());
    if (!original || seen.has(ascii)) continue;
    if (singleOnly && (original.includes(' ') || ascii.length < 3 || ascii.length > 11)) continue;
    seen.add(ascii);
    out.push({ original, ascii });
  }
  return out;
}

/** Word lists of one language, grouped by grammatical role. */
export interface WordBank {
  adjectives: Word[];
  subjects: Word[];
  adverbs: Word[];
  verbs: Word[];
  objects: Word[];
  places: Word[];
  /** Single words for the passphrase ("words") mode. */
  passphrase: Word[];
}

export const WORD_BANKS: Record<Language, WordBank> = {
  en: {
    adjectives: toWords(EN_ADJECTIVES),
    subjects: toWords(EN_SUBJECTS),
    adverbs: toWords(EN_ADVERBS),
    verbs: toWords(EN_VERBS),
    objects: toWords(EN_OBJECTS),
    places: toWords(EN_PLACES),
    passphrase: toWords(EFF_LARGE_WORDLIST, true),
  },
  pl: {
    adjectives: toWords(ADJECTIVES),
    subjects: toWords(SUBJECTS),
    adverbs: toWords(ADVERBS),
    verbs: toWords(VERBS),
    objects: toWords(OBJECTS),
    places: toWords(PLACES),
    passphrase: toWords([...ADJECTIVES, ...SUBJECTS, ...OBJECTS, ...EXTRA_NOUNS, ...VERBS], true),
  },
};

/** Polish slang terms with explanations (slang mode). */
export const SLANG_WORDS: readonly SlangWord[] = toSlangWords();

const CLEAN_SLANG_WORDS: readonly SlangWord[] = SLANG_WORDS.filter((w) => !w.vulgar);

/** Stable array identities, so per-list caches (l33t averages) stay warm. */
export const slangPool = (allowVulgar: boolean): readonly SlangWord[] =>
  allowVulgar ? SLANG_WORDS : CLEAN_SLANG_WORDS;

// ---------------------------------------------------------------------------
// Assembly of memorable passwords
// ---------------------------------------------------------------------------

interface Item {
  password: string;
  hint: HintSegment[];
}

interface AssembleOptions {
  digits: number;
  numberPosition: NumberPosition;
  separator: string;
  specials: SpecialPlacement;
  leet: LeetMode;
  /** Transforms an ASCII token; groupIndex is the index of the word/phrase. */
  caseFn: (token: string, groupIndex: number) => string;
  /** Text placed between hint items when separators are not special characters. */
  hintJoin: string;
}

function assemble(groups: readonly Word[], opts: AssembleOptions, ctx: GeneratorContext): Candidate {
  const { rand } = ctx;
  const placement: SpecialPlacement = ctx.specials.length ? opts.specials : 'none';

  // Flatten phrases ("na dachu") into separate tokens, remembering group starts.
  const items: Item[] = [];
  const groupStart: number[] = [];
  groups.forEach((group, gi) => {
    groupStart.push(items.length);
    const asciiTokens = group.ascii.split(' ');
    const originalTokens = group.original.split(' ');
    asciiTokens.forEach((token, ti) => {
      items.push(leetify(opts.caseFn(token, gi), originalTokens[ti] ?? token, opts.leet, rand));
    });
  });
  groupStart.push(items.length);

  if (placement === 'word') {
    const item = items[rand(items.length)]!;
    const ch = pick(ctx.specials, rand);
    item.password += ch;
    item.hint.push({ text: ch, strong: true });
  }

  let number = randomDigits(opts.digits, rand);
  if (placement === 'number') number += pick(ctx.specials, rand);
  const position = opts.numberPosition === 'random' ? rand(groups.length + 1) : groups.length;
  items.splice(groupStart[position]!, 0, { password: number, hint: [{ text: number, strong: true }] });

  if (placement === 'separator') {
    const seps = items.slice(1).map(() => pick(ctx.specials, rand));
    return {
      password: items.map((it, i) => (i ? seps[i - 1] : '') + it.password).join(''),
      hint: items.flatMap((it, i) =>
        i ? [{ text: ' ' }, { text: seps[i - 1]!, strong: true }, { text: ' ' }, ...it.hint] : it.hint),
    };
  }
  return {
    password: items.map((it) => it.password).join(opts.separator),
    hint: items.flatMap((it, i) => (i ? [{ text: opts.hintJoin }, ...it.hint] : it.hint)),
  };
}

/** Join length and fixed characters of a memorable password, see lib/length-plan.ts. */
function layoutOf(
  o: { separator: string; specials: SpecialPlacement; digits: number }, specialsCount: number,
): { joinLength: number; overhead: number } {
  const placement = specialsCount ? o.specials : 'none';
  return {
    joinLength: placement === 'separator' ? 1 : o.separator.length,
    overhead: o.digits + (placement === 'number' || placement === 'word' ? 1 : 0),
  };
}

/** One word per slot: uniformly among length-fitting combinations when a range is set, else freely. */
function chooseGroups<T extends Word>(slots: readonly (readonly T[])[], layout: { joinLength: number; overhead: number },
  ctx: GeneratorContext): T[] {
  if (ctx.lengthRange) {
    const picked = pickForLength({ slots, ...layout }, ctx.lengthRange, ctx.rand);
    if (picked) return picked as T[];
  }
  return slots.map((list) => pick(list, ctx.rand));
}

function sentenceSlots(o: SentenceOptions, language: Language): Word[][] {
  const bank = WORD_BANKS[language];
  const slots: Word[][] = [];
  if (o.adjectives) slots.push(bank.adjectives);
  slots.push(bank.subjects);
  if (o.adverb) slots.push(bank.adverbs);
  slots.push(bank.verbs);
  if (o.adjectives) slots.push(bank.adjectives);
  slots.push(bank.objects);
  if (o.place) slots.push(bank.places);
  return slots;
}

export function generateSentence(o: SentenceOptions, ctx: GeneratorContext, language: Language = 'en'): Candidate {
  const groups = chooseGroups(sentenceSlots(o, language), layoutOf(o, ctx.specials.length), ctx);

  const candidate = assemble(groups, { ...o, caseFn: capitalize, hintJoin: ' ' }, ctx);
  const first = candidate.hint[0];
  if (first) first.text = capitalize(first.text);
  return candidate;
}

export function generateWords(o: WordsOptions, ctx: GeneratorContext, language: Language = 'en'): Candidate {
  const { rand } = ctx;
  const list = WORD_BANKS[language].passphrase;
  const groups = chooseGroups(Array.from({ length: o.count }, () => list), layoutOf(o, ctx.specials.length), ctx);
  const upperIndex = o.caps === 'one' ? rand(o.count) : -1;
  const caseFn = (token: string, gi: number) =>
    o.caps === 'one' ? (gi === upperIndex ? token.toUpperCase() : token) : capitalize(token);
  return assemble(groups, { ...o, caseFn, hintJoin: ' · ' }, ctx);
}

/** Fisher-Yates shuffle (returns a new array). */
function shuffle<T>(items: readonly T[], rand: RandomInt): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function generateSlang(o: SlangOptions, ctx: GeneratorContext): Candidate {
  const { rand } = ctx;
  const pool = slangPool(o.allowVulgar);
  const total = o.slangCount + o.extraWords;
  // Decide which positions hold slang, then fill them.
  const slots = shuffle([...Array<boolean>(o.slangCount).fill(true), ...Array<boolean>(o.extraWords).fill(false)], rand);
  // Ordinary words stay Polish so the phrase reads in one language.
  const ordinary = WORD_BANKS.pl.passphrase;
  const groups: (Word | SlangWord)[] = chooseGroups<Word | SlangWord>(
    slots.map((isSlang) => (isSlang ? pool : ordinary)), layoutOf(o, ctx.specials.length), ctx);
  const upperIndex = o.caps === 'one' ? rand(total) : -1;
  const caseFn = (token: string, gi: number) =>
    o.caps === 'one' ? (gi === upperIndex ? token.toUpperCase() : token) : capitalize(token);
  const candidate = assemble(groups, { ...o, caseFn, hintJoin: ' · ' }, ctx);

  const glossary: GlossaryEntry[] = [];
  const seen = new Set<string>();
  groups.forEach((g, i) => {
    if (!slots[i] || seen.has(g.ascii)) return;
    seen.add(g.ascii);
    const w = g as SlangWord;
    glossary.push({ term: w.original, meaning: w.meaning, vulgar: w.vulgar, url: miejskiUrl(w.original) });
  });
  return { ...candidate, glossary };
}

const CHARSETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  upperClear: 'ABCDEFGHJKLMNPQRSTUVWXYZ', // without I, O
  lower: 'abcdefghijklmnopqrstuvwxyz',
  lowerClear: 'abcdefghijkmnopqrstuvwxyz', // without l
  digits: '0123456789',
  digitsClear: '23456789', // without 0, 1
} as const;

export function randomCharset(o: RandomOptions, specials: readonly string[]): string {
  const clear = o.excludeAmbiguous;
  return (clear ? CHARSETS.upperClear : CHARSETS.upper)
    + (clear ? CHARSETS.lowerClear : CHARSETS.lower)
    + (clear ? CHARSETS.digitsClear : CHARSETS.digits)
    + (o.useSpecials ? specials.join('') : '');
}

export function generateRandom(o: RandomOptions, ctx: GeneratorContext): Candidate {
  const { rand } = ctx;
  const charset = randomCharset(o, ctx.specials);
  const chars = Array.from({ length: o.length }, () => charset[rand(charset.length)]!);
  if (o.useSpecials && ctx.specials.length) {
    // Guarantee the minimum number of special characters at distinct random positions.
    const free = chars.map((_, i) => i);
    for (let k = 0; k < Math.min(o.minSpecials, o.length); k++) {
      const index = free.splice(rand(free.length), 1)[0]!;
      chars[index] = pick(ctx.specials, rand);
    }
  }
  return { password: chars.join(''), hint: [] };
}

// ---------------------------------------------------------------------------
// Entropy estimates (bits), assuming the attacker knows the lists and settings.
// They ignore the small loss caused by rejecting non-compliant candidates.
// Each mode returns labelled parts so the UI can explain where the bits come from;
// entropyBits is simply their sum.
// ---------------------------------------------------------------------------

const { log2 } = Math;

/** One labelled contribution to the total entropy (labels are English UI text). */
export interface EntropyPart {
  label: string;
  bits: number;
}

const SPECIAL_LABELS: Record<Exclude<SpecialPlacement, 'none'>, string> = {
  number: 'special character next to the number',
  word: 'special character next to a random word',
  separator: 'special characters as separators',
};
const LEET_LABELS: Record<LeetMode, string> = {
  none: 'l33t', one: 'l33t: one substitution per word', random: 'l33t: random substitutions', all: 'l33t: all (no effect)',
};

function numberParts(digits: number, position: NumberPosition, groups: number): EntropyPart[] {
  const parts = [{ label: `number (${digits} ${digits === 1 ? 'digit' : 'digits'})`, bits: digits * log2(10) }];
  if (position === 'random') parts.push({ label: 'random position of the number', bits: log2(groups + 1) });
  return parts;
}

/** Lower bound: multi-word phrases only add more separators. */
function specialParts(placement: SpecialPlacement, specialsCount: number, groups: number): EntropyPart[] {
  if (!specialsCount || placement === 'none') return [];
  const bits = placement === 'number' ? log2(specialsCount)
    : placement === 'word' ? log2(specialsCount) + log2(groups)
    : groups * log2(specialsCount); // separator: groups + number => `groups` joins
  return [{ label: SPECIAL_LABELS[placement], bits }];
}

function leetPart(mode: LeetMode, bits: number): EntropyPart[] {
  return mode === 'none' ? [] : [{ label: LEET_LABELS[mode], bits }];
}

/** Expected l33t bits for one word drawn from each of the given lists. */
function leetBits(mode: LeetMode, lists: readonly (readonly Word[])[]): number {
  return lists.reduce((sum, list) => sum + averageLeetBits(list, mode), 0);
}

const pick1 = (label: string, list: readonly unknown[]): EntropyPart =>
  ({ label: `${label} (1 of ${list.length})`, bits: log2(list.length) });

export function sentenceParts(o: SentenceOptions, specialsCount: number, language: Language = 'en'): EntropyPart[] {
  const b = WORD_BANKS[language];
  const parts: EntropyPart[] = [pick1('subject', b.subjects), pick1('verb', b.verbs), pick1('object', b.objects)];
  if (o.adjectives) parts.push({ label: `2 adjectives (of ${b.adjectives.length})`, bits: 2 * log2(b.adjectives.length) });
  if (o.adverb) parts.push(pick1('adverb', b.adverbs));
  if (o.place) parts.push(pick1('place', b.places));
  const groups = 3 + (o.adjectives ? 2 : 0) + (o.adverb ? 1 : 0) + (o.place ? 1 : 0);
  parts.push(...leetPart(o.leet, leetBits(o.leet, [
    b.subjects, b.verbs, b.objects,
    ...(o.adjectives ? [b.adjectives, b.adjectives] : []),
    ...(o.adverb ? [b.adverbs] : []),
    ...(o.place ? [b.places] : []),
  ])));
  return [...parts, ...numberParts(o.digits, o.numberPosition, groups), ...specialParts(o.specials, specialsCount, groups)];
}

export function wordsParts(o: WordsOptions, specialsCount: number, language: Language = 'en'): EntropyPart[] {
  const list = WORD_BANKS[language].passphrase;
  const n = list.length;
  return [
    { label: `${o.count} words (each of ${n})`, bits: o.count * log2(n) },
    ...(o.caps === 'one' ? [{ label: 'which word is in CAPITALS', bits: log2(o.count) }] : []),
    ...leetPart(o.leet, o.count * averageLeetBits(list, o.leet)),
    ...numberParts(o.digits, o.numberPosition, o.count),
    ...specialParts(o.specials, specialsCount, o.count),
  ];
}

/** log2 of the binomial coefficient C(n, k). */
function log2Binomial(n: number, k: number): number {
  let bits = 0;
  for (let i = 1; i <= k; i++) bits += log2(n - k + i) - log2(i);
  return bits;
}

export function slangParts(o: SlangOptions, specialsCount: number): EntropyPart[] {
  const total = o.slangCount + o.extraWords;
  const pool = slangPool(o.allowVulgar);
  const ordinary = WORD_BANKS.pl.passphrase;
  const n = ordinary.length;
  const leet = o.slangCount * averageLeetBits(pool, o.leet) + o.extraWords * averageLeetBits(ordinary, o.leet);
  return [
    { label: `slang words: ${o.slangCount} (each of ${pool.length})`, bits: o.slangCount * log2(pool.length) },
    ...(o.extraWords ? [{ label: `ordinary words: ${o.extraWords} (each of ${n})`, bits: o.extraWords * log2(n) }] : []),
    ...(o.extraWords ? [{ label: 'order of slang and ordinary words', bits: log2Binomial(total, o.slangCount) }] : []),
    ...(o.caps === 'one' ? [{ label: 'which word is in CAPITALS', bits: log2(total) }] : []),
    ...leetPart(o.leet, leet),
    ...numberParts(o.digits, o.numberPosition, total),
    ...specialParts(o.specials, specialsCount, total),
  ];
}

export function randomParts(o: RandomOptions, specials: readonly string[]): EntropyPart[] {
  const size = randomCharset(o, specials).length;
  return [{ label: `${o.length} characters (each of ${size})`, bits: o.length * log2(size) }];
}

export function entropyParts(mode: Mode, options: ModeOptions, specials: readonly string[]): EntropyPart[] {
  switch (mode) {
    case 'sentence': return sentenceParts(options.sentence, specials.length, options.language);
    case 'words': return wordsParts(options.words, specials.length, options.language);
    case 'slang': return slangParts(options.slang, specials.length);
    case 'random': return randomParts(options.random, specials);
  }
}

const sum = (parts: readonly EntropyPart[]) => parts.reduce((s, p) => s + p.bits, 0);

export const sentenceBits = (o: SentenceOptions, specialsCount: number, language: Language = 'en') =>
  sum(sentenceParts(o, specialsCount, language));
export const wordsBits = (o: WordsOptions, specialsCount: number, language: Language = 'en') =>
  sum(wordsParts(o, specialsCount, language));
export const slangBits = (o: SlangOptions, specialsCount: number) => sum(slangParts(o, specialsCount));
export const randomBits = (o: RandomOptions, specials: readonly string[]) => sum(randomParts(o, specials));

export function entropyBits(mode: Mode, options: ModeOptions, specials: readonly string[]): number {
  return sum(entropyParts(mode, options, specials));
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function generate(mode: Mode, options: ModeOptions, ctx: GeneratorContext): Candidate {
  switch (mode) {
    case 'sentence': return generateSentence(options.sentence, ctx, options.language);
    case 'words': return generateWords(options.words, ctx, options.language);
    case 'slang': return generateSlang(options.slang, ctx);
    case 'random': return generateRandom(options.random, ctx);
  }
}

/** Allowed password length for memorable modes. `max` 0 means no upper limit. */
export interface LengthRange {
  min: number;
  max: number;
}

/** Shortest and longest length the custom range slider allows. */
export const LENGTH_LIMITS = { min: 8, max: 100 } as const;

export interface NormalizedLengthRange {
  range: LengthRange;
  /** "max" was below "min" and has been raised to "min". */
  maxRaised: boolean;
}

/**
 * Validates user input for the length range. Rules:
 * min is clamped to LENGTH_LIMITS; empty/0 max means no limit; max is never below min
 * (if it is, it is raised to min and the caller is told so it can inform the user).
 */
export function normalizeLengthRange(min: number, max: number, fallbackMin = 14): NormalizedLengthRange {
  const clamp = (n: number) => Math.min(LENGTH_LIMITS.max, Math.max(LENGTH_LIMITS.min, Math.round(n)));
  const safeMin = clamp(Number.isFinite(min) && min > 0 ? min : fallbackMin);
  if (!Number.isFinite(max) || max <= 0) return { range: { min: safeMin, max: 0 }, maxRaised: false };
  const safeMax = clamp(max);
  return safeMax < safeMin
    ? { range: { min: safeMin, max: safeMin }, maxRaised: true }
    : { range: { min: safeMin, max: safeMax }, maxRaised: false };
}

export function fitsLength(password: string, range: LengthRange): boolean {
  const length = [...password].length;
  return length >= range.min && (range.max === 0 || length <= range.max);
}

export interface CompliantOptions {
  maxAttempts?: number;
  /** Reject candidates outside this length range (memorable modes). */
  lengthRange?: LengthRange;
  /**
   * Accept passwords shorter than the policy minimum. Set only when the user
   * deliberately asked for a shorter password; the length rule then shows as failed.
   */
  allowShort?: boolean;
}

/**
 * Generates a candidate that passes every checkable policy rule (and the length range).
 * Returns null when no compliant password was found (e.g. a length range that the
 * chosen settings cannot fit, or overly strict blocked terms).
 */
export function generateCompliant(
  mode: Mode,
  options: ModeOptions,
  ctx: GeneratorContext,
  policy: PolicyContext,
  opts: CompliantOptions | number = {},
): Candidate | null {
  const { maxAttempts = 1000, lengthRange, allowShort = false } = typeof opts === 'number' ? { maxAttempts: opts } : opts;
  const genCtx = lengthRange ? { ...ctx, lengthRange } : ctx;
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generate(mode, options, genCtx);
    if (lengthRange && !fitsLength(candidate.password, lengthRange)) continue;
    const results = validatePassword(candidate.password, policy)
      .filter((r) => !(allowShort && r.id === 'length'));
    if (isCompliant(results)) return candidate;
  }
  return null;
}

/** Word slots and layout of a memorable mode (null for the random mode). */
export function planFor(mode: Mode, options: ModeOptions, specialsCount: number): LengthPlan | null {
  switch (mode) {
    case 'sentence':
      return { slots: sentenceSlots(options.sentence, options.language), ...layoutOf(options.sentence, specialsCount) };
    case 'words': {
      const list = WORD_BANKS[options.language].passphrase;
      return { slots: Array.from({ length: options.words.count }, () => list), ...layoutOf(options.words, specialsCount) };
    }
    case 'slang': {
      const o = options.slang;
      // Order does not change the counts, so any arrangement of slang/ordinary slots works.
      const slots = [...Array.from({ length: o.slangCount }, () => slangPool(o.allowVulgar)),
        ...Array.from({ length: o.extraWords }, () => WORD_BANKS.pl.passphrase)];
      return { slots, ...layoutOf(o, specialsCount) };
    }
    case 'random':
      return null;
  }
}

/**
 * Exact share of word combinations that fit the length range, plus the shortest and longest
 * possible length. Picking uniformly among fitting combinations leaves `2^bits × fraction`
 * equally likely passwords, so the entropy drops by -log2(fraction) bits.
 */
export function lengthFitInfo(mode: Mode, options: ModeOptions, specialsCount: number, range: LengthRange): LengthStats {
  const plan = planFor(mode, options, specialsCount);
  if (!plan) {
    const len = options.random.length;
    return { combinations: 1, fitting: 1, fraction: 1, minLength: len, maxLength: len, typicalMin: len, typicalMax: len };
  }
  return lengthStats(plan, range);
}
