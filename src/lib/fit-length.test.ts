import { describe, expect, it } from 'vitest';
import { describeChanges, suggestFit } from './fit-length';
import { lengthFitInfo, type Mode, type ModeOptions } from './generators';
import { DEFAULT_SETTINGS } from './settings';
import { parseSpecials } from './text';

const specials = parseSpecials(DEFAULT_SETTINGS.specials);
const options = (patch: (o: ModeOptions) => void = () => {}): ModeOptions => {
  const o = structuredClone(DEFAULT_SETTINGS);
  patch(o);
  return o;
};

describe('suggestFit', () => {
  it('suggests nothing when the settings already fit', () => {
    const fit = suggestFit('words', options(), specials, { min: 14, max: 0 });
    expect(fit).toEqual({ options: options(), feasible: true, changes: [] });
  });

  it.each(['sentence', 'words', 'slang'] as Mode[])('proposes %s settings that fit 8-14 characters', (mode) => {
    const range = { min: 8, max: 14 };
    expect(lengthFitInfo(mode, options(), specials.length, range).fitting).toBe(0);
    const fit = suggestFit(mode, options(), specials, range);
    expect(fit.feasible).toBe(true);
    expect(fit.changes.length).toBeGreaterThan(0);
    expect(lengthFitInfo(mode, fit.options, specials.length, range).fitting).toBeGreaterThan(0);
  });

  it('reports ranges no setting can reach', () => {
    const fit = suggestFit('sentence', options(), specials, { min: 8, max: 9 });
    expect(fit.feasible).toBe(false);
    expect(fit.changes).toEqual([]);
  });

  it('proposes longer settings when passwords are too short', () => {
    const o = options((x) => { x.words.count = 3; });
    const fit = suggestFit('words', o, specials, { min: 60, max: 0 });
    expect(fit.feasible).toBe(true);
    expect(fit.options.words.count).toBeGreaterThan(3);
  });

  it('does nothing for the random mode', () => {
    expect(suggestFit('random', options(), specials, { min: 8, max: 10 })).toMatchObject({ feasible: true, changes: [] });
  });
});

describe('describeChanges', () => {
  it('lists changes in English', () => {
    const before = options();
    const after = options((o) => { o.words.count = 2; o.words.separator = ''; o.words.digits = 1; o.words.specials = 'none'; });
    expect(describeChanges('words', before, after)).toEqual([
      '2 words instead of 5', 'no separators', '1 digit instead of 2', 'no special character',
    ]);
  });
});
