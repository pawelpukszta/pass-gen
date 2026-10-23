/**
 * Explanations behind the strength meter: improvement suggestions and
 * human-readable cracking-time estimates. Pure functions, English UI text.
 */

import { entropyBits, type Mode, type ModeOptions } from './generators';
import { plural } from './text';

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

const en1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** "3.7 bits", "1 bit", "4 bits", "12 bits". */
export function formatBits(bits: number): string {
  const rounded = Math.round(bits * 10) / 10;
  return `${en1.format(rounded)} ${plural(Math.abs(rounded), 'bit', 'bits')}`;
}

// ---------------------------------------------------------------------------
// Suggestions: "what would make this password stronger"
// ---------------------------------------------------------------------------

export interface Suggestion {
  label: string;
  /** Entropy gain in bits. */
  gain: number;
}

type Tweak = { label: string; apply: (o: ModeOptions) => boolean };

/** Candidate changes per mode. `apply` mutates a copy and returns false when not applicable. */
const TWEAKS: Record<Mode, Tweak[]> = {
  sentence: [
    { label: 'Turn on adjectives', apply: (o) => !o.sentence.adjectives && (o.sentence.adjectives = true) },
    { label: 'Turn on the adverb', apply: (o) => !o.sentence.adverb && (o.sentence.adverb = true) },
    { label: 'Turn on the place', apply: (o) => !o.sentence.place && (o.sentence.place = true) },
    { label: 'Add a digit to the number', apply: (o) => o.sentence.digits < 4 && Boolean(++o.sentence.digits) },
    { label: 'Number at a random position', apply: (o) => o.sentence.numberPosition === 'end' && Boolean(o.sentence.numberPosition = 'random') },
    { label: 'Special characters instead of separators', apply: (o) => o.sentence.specials !== 'separator' && Boolean(o.sentence.specials = 'separator') },
    { label: 'l33t: random substitutions', apply: (o) => o.sentence.leet !== 'random' && Boolean(o.sentence.leet = 'random') },
  ],
  words: [
    { label: 'Add a word', apply: (o) => o.words.count < 8 && Boolean(++o.words.count) },
    { label: 'Add a digit to the number', apply: (o) => o.words.digits < 4 && Boolean(++o.words.digits) },
    { label: 'Number at a random position', apply: (o) => o.words.numberPosition === 'end' && Boolean(o.words.numberPosition = 'random') },
    { label: 'Special characters instead of separators', apply: (o) => o.words.specials !== 'separator' && Boolean(o.words.specials = 'separator') },
    { label: 'One word in CAPITALS', apply: (o) => o.words.caps === 'each' && Boolean(o.words.caps = 'one') },
    { label: 'l33t: random substitutions', apply: (o) => o.words.leet !== 'random' && Boolean(o.words.leet = 'random') },
  ],
  slang: [
    { label: 'Add an ordinary word', apply: (o) => o.slang.extraWords < 4 && Boolean(++o.slang.extraWords) },
    { label: 'Add a slang word', apply: (o) => o.slang.slangCount < 6 && Boolean(++o.slang.slangCount) },
    { label: 'Add a digit to the number', apply: (o) => o.slang.digits < 4 && Boolean(++o.slang.digits) },
    { label: 'Number at a random position', apply: (o) => o.slang.numberPosition === 'end' && Boolean(o.slang.numberPosition = 'random') },
    { label: 'Special characters instead of separators', apply: (o) => o.slang.specials !== 'separator' && Boolean(o.slang.specials = 'separator') },
    { label: 'l33t: random substitutions', apply: (o) => o.slang.leet !== 'random' && Boolean(o.slang.leet = 'random') },
    // Allowing profanity is deliberately never suggested.
  ],
  random: [
    { label: 'Make it 4 characters longer', apply: (o) => o.random.length <= 44 && Boolean(o.random.length += 4) },
    { label: 'Turn on special characters', apply: (o) => !o.random.useSpecials && (o.random.useSpecials = true) },
    { label: 'Allow similar characters (I, l, 1, O, 0)', apply: (o) => o.random.excludeAmbiguous && !(o.random.excludeAmbiguous = false) },
  ],
};

/** Changes that would add entropy, strongest first. Gains below 0.5 bit are skipped. */
export function suggestImprovements(
  mode: Mode, options: ModeOptions, specials: readonly string[], limit = 4,
): Suggestion[] {
  const base = entropyBits(mode, options, specials);
  const out: Suggestion[] = [];
  for (const tweak of TWEAKS[mode]) {
    const copy = structuredClone(options);
    if (!tweak.apply(copy)) continue;
    const gain = entropyBits(mode, copy, specials) - base;
    if (gain >= 0.5) out.push({ label: tweak.label, gain });
  }
  return out.sort((a, b) => b.gain - a.gain).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Cracking time
// ---------------------------------------------------------------------------

export interface AttackScenario {
  label: string;
  /** Guesses per second. */
  rate: number;
}

/** Orders of magnitude only; real numbers depend on hardware and the hash function. */
export const ATTACKS: readonly AttackScenario[] = [
  { label: 'Online attack (about 100 guesses/s, no account lockout)', rate: 1e2 },
  { label: 'Offline, slow hash, e.g. bcrypt (about 10 thousand guesses/s)', rate: 1e4 },
  { label: 'Offline, fast hash, e.g. NTLM (about 100 billion guesses/s)', rate: 1e11 },
];

/** Average time to guess: half of the search space. */
export function averageCrackSeconds(bits: number, rate: number): number {
  return 2 ** (bits - 1) / rate;
}

const YEAR = 365.25 * 24 * 3600;
const UNIVERSE_AGE_YEARS = 1.38e10;

/** Rough duration: "under a second", "about 3 hours", "about 2 thousand years", "longer than the age of the universe". */
export function formatDuration(seconds: number): string {
  if (seconds < 1) return 'under a second';
  const units: [number, [string, string]][] = [
    [YEAR, ['year', 'years']],
    [24 * 3600, ['day', 'days']],
    [3600, ['hour', 'hours']],
    [60, ['minute', 'minutes']],
    [1, ['second', 'seconds']],
  ];
  const years = seconds / YEAR;
  if (years > UNIVERSE_AGE_YEARS) return 'longer than the age of the universe';
  if (years >= 1e9) return `about ${en1.format(years / 1e9)} billion years`;
  if (years >= 1e6) return `about ${en1.format(years / 1e6)} million years`;
  if (years >= 1e3) return `about ${en1.format(years / 1e3)} thousand years`;
  for (const [size, forms] of units) {
    if (seconds >= size) {
      const n = Math.round(seconds / size);
      return `about ${n} ${plural(n, ...forms)}`;
    }
  }
  return 'under a second';
}

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const toSuperscript = (n: number) => [...String(n)].map((d) => SUPERSCRIPT[Number(d)]).join('');

/** "7.2 × 10¹⁶" style count of equally likely passwords (2^bits). */
export function formatSearchSpace(bits: number): string {
  const exponent = bits * Math.log10(2);
  const power = Math.floor(exponent);
  const mantissa = 10 ** (exponent - power);
  if (power < 6) return Math.round(2 ** bits).toLocaleString('en-US');
  return `${en1.format(mantissa)} × 10${toSuperscript(power)}`;
}
