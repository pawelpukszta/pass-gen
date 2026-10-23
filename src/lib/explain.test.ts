import { describe, expect, it } from 'vitest';
import {
  averageCrackSeconds, formatBits, formatDuration, formatSearchSpace, suggestImprovements,
} from './explain';
import { entropyBits, entropyParts, type Mode, type ModeOptions } from './generators';
import { DEFAULT_SETTINGS } from './settings';
import { parseSpecials } from './text';

const specials = parseSpecials(DEFAULT_SETTINGS.specials);
const MODES: Mode[] = ['sentence', 'words', 'slang', 'random'];
const options = (patch: (o: ModeOptions) => void = () => {}): ModeOptions => {
  const o = structuredClone(DEFAULT_SETTINGS);
  patch(o);
  return o;
};

describe('formatBits', () => {
  it('uses English plural forms and a decimal point', () => {
    expect(formatBits(1)).toBe('1 bit');
    expect(formatBits(3)).toBe('3 bits');
    expect(formatBits(12)).toBe('12 bits');
    expect(formatBits(3.71)).toBe('3.7 bits');
  });
});

describe('formatDuration', () => {
  it('covers the whole range', () => {
    expect(formatDuration(0.2)).toBe('under a second');
    expect(formatDuration(45)).toBe('about 45 seconds');
    expect(formatDuration(2 * 3600)).toBe('about 2 hours');
    expect(formatDuration(5 * 86400)).toBe('about 5 days');
    expect(formatDuration(2500 * 365.25 * 86400)).toBe('about 2.5 thousand years');
    expect(formatDuration(1e30)).toBe('longer than the age of the universe');
  });

  it('matches the expected order of magnitude for 60 bits at 10^11 guesses/s', () => {
    const days = averageCrackSeconds(60, 1e11) / 86400;
    expect(days).toBeGreaterThan(60);
    expect(days).toBeLessThan(75);
  });
});

describe('formatSearchSpace', () => {
  it('prints small spaces exactly and large ones in scientific notation', () => {
    expect(formatSearchSpace(10)).toBe('1,024');
    expect(formatSearchSpace(56)).toBe('7.2 × 10¹⁶');
  });
});

describe('entropyParts', () => {
  it.each(MODES)('sums to entropyBits in %s mode', (mode) => {
    const o = options();
    const total = entropyParts(mode, o, specials).reduce((s, p) => s + p.bits, 0);
    expect(total).toBeCloseTo(entropyBits(mode, o, specials), 10);
  });
});

describe('suggestImprovements', () => {
  it.each(MODES)('returns positive gains sorted from strongest in %s mode', (mode) => {
    const list = suggestImprovements(mode, options(), specials);
    expect(list.length).toBeGreaterThan(0);
    for (const s of list) expect(s.gain).toBeGreaterThanOrEqual(0.5);
    for (let i = 1; i < list.length; i++) expect(list[i - 1]!.gain).toBeGreaterThanOrEqual(list[i]!.gain);
  });

  it('reports real gains', () => {
    const base = options();
    const [best] = suggestImprovements('words', base, specials);
    expect(best).toBeDefined();
    expect(best!.gain).toBeGreaterThan(9); // e.g. separators or an extra word (~10 bits)
  });

  it('never suggests allowing profanity', () => {
    const list = suggestImprovements('slang', options(), specials, 20);
    expect(list.some((s) => /wulgar/i.test(s.label))).toBe(false);
  });

  it('skips changes that are already applied', () => {
    const maxed = options((o) => {
      o.words.count = 8; o.words.digits = 4; o.words.numberPosition = 'random';
      o.words.specials = 'separator'; o.words.caps = 'one'; o.words.leet = 'random';
    });
    expect(suggestImprovements('words', maxed, specials)).toEqual([]);
  });

  it('does not suggest specials when none are allowed', () => {
    const list = suggestImprovements('words', options(), [], 20);
    expect(list.some((s) => /specjaln/.test(s.label))).toBe(false);
  });
});
