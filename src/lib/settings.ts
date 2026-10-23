/**
 * User settings and their persistence.
 *
 * Only preferences are stored (in localStorage of the current browser);
 * generated or typed passwords are never persisted.
 */

import { LENGTH_LIMITS, normalizeLengthRange, type LengthRange, type Mode, type ModeOptions } from './generators';

export interface Settings extends ModeOptions {
  mode: Mode;
  /** Allowed special characters as typed by the user. */
  specials: string;
  username: string;
  /** Predictable terms, one per line. */
  blockedTerms: string;
  /**
   * Length of memorable passwords (sentence, words, slang):
   * auto   - whatever the settings produce (only the policy minimum applies),
   * custom - `lengthRange` set with the range slider.
   * The random mode always uses random.length.
   */
  lengthMode: 'auto' | 'custom';
  /** Custom range; used only when lengthMode is "custom". */
  lengthRange: LengthRange;
}

/** Excludes characters that are often dead keys or rejected by systems: ^ ` ~ ' " \ and space. */
export const DEFAULT_SPECIALS = '!@#$%&*?+=-_.';
/** Empty: the user enters their own organization or service names in the UI. */
export const DEFAULT_BLOCKED_TERMS = '';

export const DEFAULT_SETTINGS: Settings = {
  // Random characters give the most entropy per character, so they are the default.
  mode: 'random',
  language: 'en',
  sentence: {
    adjectives: true, adverb: true, place: true,
    digits: 3, numberPosition: 'end', separator: '', specials: 'number', leet: 'none',
  },
  words: {
    count: 5, caps: 'each',
    digits: 2, numberPosition: 'end', separator: '-', specials: 'number', leet: 'none',
  },
  slang: {
    slangCount: 3, extraWords: 2, allowVulgar: false, caps: 'each',
    digits: 2, numberPosition: 'end', separator: '-', specials: 'number', leet: 'none',
  },
  random: { length: 20, useSpecials: true, excludeAmbiguous: true, minSpecials: 2 },
  specials: DEFAULT_SPECIALS,
  username: '',
  blockedTerms: DEFAULT_BLOCKED_TERMS,
  lengthMode: 'auto',
  lengthRange: { min: 14, max: 40 },
};

const STORAGE_KEY = 'pass-gen.settings.v2';
/** Key from before the rename; read once so existing users keep their settings. */
const LEGACY_STORAGE_KEY = 'kuznia-hasel.settings.v2';
/**
 * Bumped when a default changes in a way that should reach existing users once.
 * 3: the random mode became the default (stored settings always contain a mode,
 *    because the app saves on start, so older data would keep "sentence" forever).
 */
export const SETTINGS_VERSION = 3;
const MODES: readonly Mode[] = ['sentence', 'words', 'slang', 'random'];

/** Shallow-merges each section over defaults so new options get sensible values. */
export function mergeSettings(saved: unknown): Settings {
  const base = structuredClone(DEFAULT_SETTINGS);
  if (!saved || typeof saved !== 'object') return base;
  const s = saved as Partial<Settings>;
  const merged: Settings = {
    ...base,
    ...pickStrings(s),
    sentence: { ...base.sentence, ...(s.sentence ?? {}) },
    words: { ...base.words, ...(s.words ?? {}) },
    slang: { ...base.slang, ...(s.slang ?? {}) },
    random: { ...base.random, ...(s.random ?? {}) },
    lengthRange: { ...base.lengthRange, ...(s.lengthRange ?? {}) },
  };
  // Older versions had no lengthMode: a set upper limit meant a custom range.
  if (s.lengthMode !== 'auto' && s.lengthMode !== 'custom') {
    merged.lengthMode = (s.lengthRange?.max ?? 0) > 0 ? 'custom' : 'auto';
  }
  // The slider needs a finite, valid range.
  const { range } = normalizeLengthRange(merged.lengthRange.min, merged.lengthRange.max || LENGTH_LIMITS.max);
  merged.lengthRange = range;
  if (!MODES.includes(merged.mode)) merged.mode = base.mode;
  if ((saved as { version?: number }).version !== SETTINGS_VERSION) merged.mode = base.mode;
  return merged;
}

function pickStrings(s: Partial<Settings>): Partial<Settings> {
  const out: Partial<Settings> = {};
  if (typeof s.mode === 'string') out.mode = s.mode;
  if (s.language === 'en' || s.language === 'pl') out.language = s.language;
  if (typeof s.specials === 'string') out.specials = s.specials;
  if (typeof s.username === 'string') out.username = s.username;
  if (typeof s.blockedTerms === 'string') out.blockedTerms = s.blockedTerms;
  if (s.lengthMode === 'auto' || s.lengthMode === 'custom') out.lengthMode = s.lengthMode;
  return out;
}

/** Storage can be missing or throw (private mode, blocked site data): fall back to defaults. */
export function loadSettings(storage: Storage | undefined = globalThis.localStorage): Settings {
  try {
    return mergeSettings(JSON.parse(storage?.getItem(STORAGE_KEY) ?? storage?.getItem(LEGACY_STORAGE_KEY) ?? 'null'));
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings: Settings, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ ...settings, version: SETTINGS_VERSION }));
  } catch {
    // Ignore: settings simply won't persist.
  }
}
