import { describe, expect, it } from 'vitest';
import { generate, planFor, type GeneratorContext, type Mode, type ModeOptions } from './generators';
import { lengthStats, pickForLength, tokenWeight } from './length-plan';
import { cryptoRandomInt } from './random';
import { DEFAULT_SETTINGS } from './settings';
import { parseSpecials } from './text';

const specials = parseSpecials(DEFAULT_SETTINGS.specials);
const ctx: GeneratorContext = { specials, rand: cryptoRandomInt };
const options = (patch: (o: ModeOptions) => void = () => {}): ModeOptions => {
  const o = structuredClone(DEFAULT_SETTINGS);
  patch(o);
  return o;
};

describe('length model', () => {
  // The formula in length-plan.ts must match what the generators actually produce.
  const variants: [string, (o: ModeOptions) => void][] = [
    ['defaults', () => {}],
    ['no separator', (o) => { o.words.separator = ''; o.sentence.separator = ''; o.slang.separator = ''; }],
    ['separator specials', (o) => { o.words.specials = 'separator'; o.sentence.specials = 'separator'; o.slang.specials = 'separator'; }],
    ['special at word', (o) => { o.words.specials = 'word'; o.sentence.specials = 'word'; o.slang.specials = 'word'; }],
    ['no specials, dot', (o) => { o.words.specials = 'none'; o.words.separator = '.'; o.sentence.specials = 'none'; o.sentence.separator = '_'; }],
    ['polish + leet', (o) => { o.language = 'pl'; o.words.leet = 'random'; o.sentence.leet = 'all'; }],
  ];
  it.each(variants.flatMap(([name, patch]) => (['sentence', 'words', 'slang'] as Mode[]).map((m) => [m, name, patch] as const)))(
    'predicts the exact length in %s mode (%s)', (mode, _name, patch) => {
      const o = options(patch);
      const plan = planFor(mode, o, specials.length)!;
      const stats = lengthStats(plan, { min: 0, max: 0 });
      for (let i = 0; i < 200; i++) {
        const len = generate(mode, o, ctx).password.length;
        expect(len).toBeGreaterThanOrEqual(stats.minLength);
        expect(len).toBeLessThanOrEqual(stats.maxLength);
      }
      // Fixed-word check: length = Σ weights + overhead.
      const fixedCtx: GeneratorContext = { specials, rand: () => 0 };
      const pw = generate(mode, o, fixedCtx).password;
      const expected = plan.slots.reduce((s, list) => s + tokenWeight(list[0]!, plan.joinLength), 0) + plan.overhead;
      if (mode !== 'slang') expect(pw.length).toBe(expected); // slang order shuffles slots with rand
    });
});

describe('pickForLength', () => {
  it('only returns combinations inside the range', () => {
    const plan = planFor('words', options(), specials.length)!;
    const range = { min: 30, max: 32 };
    for (let i = 0; i < 300; i++) {
      const words = pickForLength(plan, range, cryptoRandomInt)!;
      const len = words.reduce((s, w) => s + tokenWeight(w, plan.joinLength), 0) + plan.overhead;
      expect(len).toBeGreaterThanOrEqual(30);
      expect(len).toBeLessThanOrEqual(32);
    }
  });

  it('is uniform over fitting combinations (small example)', () => {
    const w = (ascii: string) => ({ original: ascii, ascii });
    const plan = { slots: [[w('aa'), w('bbb'), w('c')], [w('dd'), w('e')]], joinLength: 0, overhead: 0 };
    // Combinations with length 3: aa+e, bbb? no (3+? min 4), c+dd → 2 combos → ~50% each.
    const seen = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      const key = pickForLength(plan, { min: 3, max: 3 }, cryptoRandomInt)!.map((x) => x.ascii).join('+');
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    expect([...seen.keys()].sort()).toEqual(['aa+e', 'c+dd']);
    for (const n of seen.values()) expect(n / 4000).toBeGreaterThan(0.45);
  });

  it('returns null when nothing fits', () => {
    const plan = planFor('sentence', options(), specials.length)!;
    expect(pickForLength(plan, { min: 8, max: 9 }, cryptoRandomInt)).toBeNull();
    expect(lengthStats(plan, { min: 8, max: 9 }).fitting).toBe(0);
  });
});

describe('typical length', () => {
  it('lies within the possible range and orders correctly', () => {
    for (const mode of ['sentence', 'words', 'slang'] as Mode[]) {
      const stats = lengthStats(planFor(mode, options(), specials.length)!, { min: 0, max: 0 });
      expect(stats.minLength).toBeLessThanOrEqual(stats.typicalMin);
      expect(stats.typicalMin).toBeLessThanOrEqual(stats.typicalMax);
      expect(stats.typicalMax).toBeLessThanOrEqual(stats.maxLength);
    }
  });

  it('matches observed lengths (about 80% fall inside the typical range)', () => {
    const o = options();
    const stats = lengthStats(planFor('words', o, specials.length)!, { min: 0, max: 0 });
    let inside = 0;
    for (let i = 0; i < 2000; i++) {
      const len = generate('words', o, ctx).password.length;
      if (len >= stats.typicalMin && len <= stats.typicalMax) inside++;
    }
    expect(inside / 2000).toBeGreaterThan(0.75);
  });
});
