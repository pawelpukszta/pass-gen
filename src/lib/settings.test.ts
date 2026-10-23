import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings, SETTINGS_VERSION } from './settings';

describe('mergeSettings', () => {
  it('defaults to the generator-driven length', () => {
    expect(DEFAULT_SETTINGS.lengthMode).toBe('auto');
    expect(mergeSettings(null).lengthMode).toBe('auto');
  });

  it('migrates an old saved range with an upper limit to a custom range', () => {
    const s = mergeSettings({ lengthRange: { min: 20, max: 30 } });
    expect(s.lengthMode).toBe('custom');
    expect(s.lengthRange).toEqual({ min: 20, max: 30 });
  });

  it('migrates an old range without upper limit to auto and keeps a valid slider range', () => {
    const s = mergeSettings({ lengthRange: { min: 14, max: 0 } });
    expect(s.lengthMode).toBe('auto');
    expect(s.lengthRange.max).toBeGreaterThanOrEqual(s.lengthRange.min);
    expect(s.lengthRange.max).toBeLessThanOrEqual(100);
  });

  it('repairs an invalid stored range (max below min)', () => {
    const s = mergeSettings({ lengthMode: 'custom', lengthRange: { min: 40, max: 20 } });
    expect(s.lengthRange).toEqual({ min: 40, max: 40 });
  });
});

describe('default mode', () => {
  it('is the random mode', () => {
    expect(DEFAULT_SETTINGS.mode).toBe('random');
    expect(mergeSettings(null).mode).toBe('random');
  });

  it('switches settings saved by older versions to the random mode once', () => {
    expect(mergeSettings({ mode: 'sentence' }).mode).toBe('random');
  });

  it('keeps a mode chosen after the change', () => {
    expect(mergeSettings({ mode: 'words', version: SETTINGS_VERSION }).mode).toBe('words');
  });
});
