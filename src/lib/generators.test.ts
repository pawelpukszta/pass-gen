import { describe, expect, it } from 'vitest';
import { miejskiUrl, SLANG } from '../data/slang';
import { WEAK_PASSWORDS } from '../data/weak-passwords';
import {
  entropyBits, lengthFitInfo, generate, generateCompliant, normalizeLengthRange, SLANG_WORDS, slangPool, WORD_BANKS,
  type GeneratorContext, type Language, type Mode, type ModeOptions,
} from './generators';
import { isCompliant, parseBlockedTerms, validatePassword } from './policy';
import { cryptoRandomInt, type RandomInt } from './random';
import { DEFAULT_SETTINGS } from './settings';
import { parseSpecials, SPECIAL_CHAR_RE } from './text';

const specials = parseSpecials(DEFAULT_SETTINGS.specials);
const ctx: GeneratorContext = { specials, rand: cryptoRandomInt };
const policy = { username: 'jan.kowalski', blockedTerms: parseBlockedTerms(DEFAULT_SETTINGS.blockedTerms) };
const options = (patch: (o: ModeOptions) => void = () => {}): ModeOptions => {
  const o = structuredClone(DEFAULT_SETTINGS);
  patch(o);
  return o;
};
const countSpecials = (pw: string) => [...pw].filter((c) => SPECIAL_CHAR_RE.test(c)).length;
const MODES: Mode[] = ['sentence', 'words', 'slang', 'random'];

describe('word bank', () => {
  const allLists = (): (readonly [string, readonly { ascii: string }[]])[] => [
    ...Object.entries(WORD_BANKS).flatMap(([lang, bank]) => Object.entries(bank).map(([name, list]) => [`${lang}.${name}`, list] as const)),
    ['slang', SLANG_WORDS] as const,
  ];

  it('has no duplicates after transliteration', () => {
    for (const [name, list] of allLists()) {
      const ascii = list.map((w) => w.ascii);
      expect(new Set(ascii).size, name).toBe(ascii.length);
    }
  });

  it('produces ASCII-only forms', () => {
    for (const [, list] of allLists()) {
      for (const w of list) expect(w.ascii).toMatch(/^[a-z ]+$/);
    }
  });

  it('uses the EFF Large Wordlist for English passphrases', () => {
    expect(WORD_BANKS.en.passphrase.length).toBe(7772);
  });

  it('keeps the weak password list ASCII and lowercase', () => {
    for (const w of WEAK_PASSWORDS) expect(w).toBe(w.toLowerCase().normalize('NFKD').replace(/[^\x20-\x7e]/g, ''));
  });
});

describe('generateCompliant', () => {
  const LANGS: Language[] = ['en', 'pl'];
  it.each(MODES.flatMap((m) => LANGS.map((l) => [m, l] as const)))('always returns compliant passwords in %s mode (%s)', (mode, language) => {
    for (let i = 0; i < 150; i++) {
      const c = generateCompliant(mode, options((o) => { o.language = language; }), ctx, policy);
      expect(c).not.toBeNull();
      expect(isCompliant(validatePassword(c!.password, policy))).toBe(true);
    }
  });

  it('defaults to English words', () => {
    expect(DEFAULT_SETTINGS.language).toBe('en');
    const english = new Set(WORD_BANKS.en.passphrase.map((w) => w.ascii));
    const o = options((x) => { x.words.specials = 'none'; x.words.leet = 'none'; });
    const c = generate('words', o, ctx);
    for (const w of c.password.split('-').slice(0, -1)) expect(english.has(w.toLowerCase())).toBe(true);
  });

  it('returns null when no candidate can comply', () => {
    // A source that always returns 0 yields the number "0000", which breaks the repeat rule.
    const zeros: GeneratorContext = { specials, rand: () => 0 };
    const o = options((x) => { x.words.digits = 4; x.words.specials = 'none'; });
    expect(generateCompliant('words', o, zeros, policy, 5)).toBeNull();
  });
});

describe('special characters', () => {
  it('adds one special after the number in "number" placement', () => {
    const c = generate('words', options((o) => { o.words.specials = 'number'; o.words.separator = '-'; }), ctx);
    expect(c.password.slice(-3, -1)).toMatch(/^\d{2}$/);
    expect(specials).toContain(c.password.slice(-1));
  });

  it('uses specials as separators in "separator" placement', () => {
    const o = options((x) => { x.words.specials = 'separator'; x.words.count = 5; });
    const c = generate('words', o, ctx);
    expect(countSpecials(c.password)).toBe(5); // 5 words + number => 5 joins
    expect(c.password).not.toContain('-'.repeat(2));
  });

  it('adds no specials when the allowed set is empty', () => {
    const empty: GeneratorContext = { specials: [], rand: cryptoRandomInt };
    for (const mode of MODES) {
      const o = options((x) => { x.words.separator = ''; x.slang.separator = ''; x.sentence.specials = 'separator'; x.words.specials = 'word'; });
      expect(countSpecials(generate(mode, o, empty).password)).toBe(0);
    }
  });

  it('guarantees the minimum number of specials in random mode', () => {
    const o = options((x) => { x.random.minSpecials = 4; });
    const only = { specials: ['#'], rand: cryptoRandomInt };
    for (let i = 0; i < 200; i++) expect(countSpecials(generate('random', o, only).password)).toBeGreaterThanOrEqual(4);
  });
});

describe('deterministic structure', () => {
  // Always picks index 0: makes the output predictable.
  const zero: RandomInt = () => 0;

  it('builds the sentence in template order with the number at the end', () => {
    const o = options((x) => { x.sentence.specials = 'none'; x.sentence.separator = '-'; x.sentence.digits = 2; });
    const c = generate('sentence', o, { specials, rand: zero });
    const b = WORD_BANKS[o.language];
    const expected = [b.adjectives[0], b.subjects[0], b.adverbs[0], b.verbs[0], b.adjectives[0], b.objects[0], b.places[0]]
      .flatMap((w) => w!.ascii.split(' '))
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1));
    expect(c.password).toBe([...expected, '00'].join('-'));
    expect(c.hint.map((s) => s.text).join('')).toMatch(/^[A-ZŻŹĆĄŚĘŁÓŃ]/);
  });
});

describe('entropyBits', () => {
  it('grows with stronger settings', () => {
    const base = entropyBits('words', options(), specials);
    expect(entropyBits('words', options((o) => { o.words.count = 6; }), specials)).toBeGreaterThan(base);
    expect(entropyBits('words', options((o) => { o.words.specials = 'separator'; }), specials)).toBeGreaterThan(base);
    expect(entropyBits('words', options((o) => { o.words.specials = 'none'; }), specials)).toBeLessThan(base);
  });

  it('gives the default sentence at least 60 bits', () => {
    expect(entropyBits('sentence', options(), specials)).toBeGreaterThanOrEqual(60);
  });
});

describe('slang mode', () => {
  it('has a meaning for every term and no duplicate terms', () => {
    for (const e of SLANG) expect(e.meaning.trim().length, e.term).toBeGreaterThan(3);
    expect(SLANG_WORDS.length).toBe(SLANG.length);
  });

  it('never uses vulgar terms without the opt-in', () => {
    const o = options((x) => { x.slang.allowVulgar = false; x.slang.slangCount = 6; });
    const vulgar = new Set(SLANG_WORDS.filter((w) => w.vulgar).map((w) => w.ascii));
    for (let i = 0; i < 300; i++) {
      const c = generate('slang', o, ctx);
      expect(c.glossary!.every((g) => !g.vulgar)).toBe(true);
      expect(c.password.toLowerCase().split(/[^a-z]+/).some((t) => vulgar.has(t))).toBe(false);
    }
  });

  it('explains every slang term used, linking to miejski.pl', () => {
    const o = options((x) => { x.slang.slangCount = 3; x.slang.extraWords = 2; x.slang.specials = 'none'; });
    for (let i = 0; i < 100; i++) {
      const c = generate('slang', o, ctx);
      const words = c.password.split('-').slice(0, 5).map((w) => w.toLowerCase());
      const glossaryAscii = c.glossary!.map((g) => SLANG_WORDS.find((w) => w.original === g.term)!.ascii);
      for (const a of glossaryAscii) expect(words).toContain(a);
      expect(c.glossary!.length).toBeGreaterThanOrEqual(1);
      expect(c.glossary!.length).toBeLessThanOrEqual(3);
    }
  });

  it('builds miejski.pl links with a capitalized, encoded slug', () => {
    expect(miejskiUrl('sztos')).toBe('https://www.miejski.pl/slowo-Sztos');
    expect(miejskiUrl('ogarniać')).toBe('https://www.miejski.pl/slowo-Ogarnia%C4%87');
  });

  it('counts more entropy with vulgar words allowed', () => {
    expect(slangPool(true).length).toBeGreaterThan(slangPool(false).length);
    const clean = entropyBits('slang', options(), specials);
    const all = entropyBits('slang', options((x) => { x.slang.allowVulgar = true; }), specials);
    expect(all).toBeGreaterThan(clean);
  });
});

describe('password length', () => {
  it('keeps memorable passwords inside the requested range', () => {
    const range = { min: 24, max: 32 };
    for (const mode of ['sentence', 'words', 'slang'] as Mode[]) {
      const o = options((x) => { x.sentence.adjectives = false; x.sentence.place = false; });
      for (let i = 0; i < 50; i++) {
        const c = generateCompliant(mode, o, ctx, policy, { lengthRange: range, maxAttempts: 4000 });
        expect(c, mode).not.toBeNull();
        expect(c!.password.length).toBeGreaterThanOrEqual(24);
        expect(c!.password.length).toBeLessThanOrEqual(32);
      }
    }
  });

  it('returns null when the range cannot be met', () => {
    const c = generateCompliant('sentence', options(), ctx, policy, { lengthRange: { min: 14, max: 16 }, maxAttempts: 300 });
    expect(c).toBeNull();
  });

  it('generates shorter passwords only when explicitly allowed, failing just the length rule', () => {
    const o = options((x) => { x.random.length = 10; });
    expect(generateCompliant('random', o, ctx, policy, 50)).toBeNull();
    const c = generateCompliant('random', o, ctx, policy, { allowShort: true });
    expect(c!.password).toHaveLength(10);
    const fails = validatePassword(c!.password, policy).filter((r) => r.status === 'fail').map((r) => r.id);
    expect(fails).toEqual(['length']);
  });

  it('computes exactly how many combinations fit the range', () => {
    const all = lengthFitInfo('words', options(), specials.length, { min: 8, max: 0 });
    expect(all.fraction).toBe(1);
    const tight = lengthFitInfo('words', options(), specials.length, { min: 14, max: 40 });
    expect(tight.fraction).toBeGreaterThan(0);
    expect(tight.fraction).toBeLessThan(1);
    expect(tight.minLength).toBeLessThan(40);
  });

  it('keeps every user setting when a length range is set', () => {
    // 5 words with "-" separators and a special after the number, in 30-40 characters.
    const o = options((x) => { x.words.count = 5; x.words.separator = '-'; x.words.digits = 2; x.words.specials = 'number'; });
    const range = { min: 30, max: 40 };
    for (let i = 0; i < 100; i++) {
      const c = generateCompliant('words', o, ctx, policy, { lengthRange: range })!;
      expect(c).not.toBeNull();
      // 5 capitalized words joined by "-", then 2 digits and one special character.
      expect(c.password).toMatch(/^([A-Z][a-z]+-){5}\d{2}[^A-Za-z0-9]$/);
      expect(c.password.length).toBeGreaterThanOrEqual(30);
      expect(c.password.length).toBeLessThanOrEqual(40);
    }
  });

  it('never lets "do" (max) be smaller than "od" (min)', () => {
    expect(normalizeLengthRange(20, 15)).toEqual({ range: { min: 20, max: 20 }, maxRaised: true });
    expect(normalizeLengthRange(20, 20)).toEqual({ range: { min: 20, max: 20 }, maxRaised: false });
    expect(normalizeLengthRange(20, 30)).toEqual({ range: { min: 20, max: 30 }, maxRaised: false });
  });

  it('treats an empty or zero max as no limit and clamps values', () => {
    expect(normalizeLengthRange(20, 0).range).toEqual({ min: 20, max: 0 });
    expect(normalizeLengthRange(20, Number.NaN).range).toEqual({ min: 20, max: 0 });
    expect(normalizeLengthRange(3, 500).range).toEqual({ min: 8, max: 100 });
    expect(normalizeLengthRange(Number.NaN, 0, 14).range).toEqual({ min: 14, max: 0 });
  });

  it('raises max when min is moved above it', () => {
    // e.g. range 14-20, user sets "od" to 25
    expect(normalizeLengthRange(25, 20)).toEqual({ range: { min: 25, max: 25 }, maxRaised: true });
  });

  it('accepts a bare number as maxAttempts (backward compatible)', () => {
    expect(generateCompliant('words', options(), ctx, policy, 1000)).not.toBeNull();
  });
});
