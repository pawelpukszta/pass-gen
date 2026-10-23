import { describe, expect, it } from 'vitest';
import { entropyBits, generate, generateCompliant, type GeneratorContext, type Mode, type ModeOptions } from './generators';
import { eligibleIndexes, leetBitsForWord, leetify } from './leet';
import { isCompliant, normalizedVariants, parseBlockedTerms, validatePassword } from './policy';
import { cryptoRandomInt, type RandomInt } from './random';
import { DEFAULT_SETTINGS } from './settings';
import { parseSpecials } from './text';

const always: RandomInt = (n) => n - 1; // rand(2) === 1 -> every letter replaced in "random" mode
const never: RandomInt = () => 0;

describe('leetify', () => {
  it('replaces every eligible letter except the first in "all" mode', () => {
    expect(leetify('Zielony', 'Zielony', 'all', never).password).toBe('Z13l0ny');
    expect(leetify('Ogien', 'Ogień', 'all', never).password).toBe('O913n');
  });

  it('never touches the first character', () => {
    expect(eligibleIndexes('Astro')).toEqual([1, 2, 4]); // s, t, o; the leading "A" is kept
    expect(leetify('Astro', 'Astro', 'all', never).password.charAt(0)).toBe('A');
  });

  it('works on uppercase words', () => {
    expect(leetify('GITARA', 'gitara', 'all', never).password).toBe('G174R4');
  });

  it('replaces exactly one letter in "one" mode', () => {
    for (let i = 0; i < 50; i++) {
      const out = leetify('kosmos', 'kosmos', 'one', cryptoRandomInt).password;
      expect([...out].filter((c, j) => c !== 'kosmos'[j]).length).toBe(1);
    }
  });

  it('keeps Polish letters in the hint and marks digits as strong', () => {
    const { password, hint } = leetify('zolw', 'żółw', 'all', never);
    expect(password).toBe('z0lw');
    expect(hint).toEqual([{ text: 'ż' }, { text: '0', strong: true }, { text: 'łw' }]);
  });

  it('returns the word unchanged in "none" mode', () => {
    expect(leetify('Kot', 'kot', 'none', always)).toEqual({ password: 'Kot', hint: [{ text: 'kot' }] });
  });

  it('round-trips through the policy normalizer', () => {
    const { password } = leetify('Haslo', 'Haslo', 'all', never);
    expect(normalizedVariants(password)).toContain('haslo');
  });
});

describe('l33t entropy and compliance', () => {
  const specials = parseSpecials(DEFAULT_SETTINGS.specials);
  const ctx: GeneratorContext = { specials, rand: cryptoRandomInt };
  const policy = { username: '', blockedTerms: parseBlockedTerms(DEFAULT_SETTINGS.blockedTerms) };
  const withLeet = (leet: 'none' | 'one' | 'random' | 'all'): ModeOptions => {
    const o = structuredClone(DEFAULT_SETTINGS);
    o.sentence.leet = leet; o.words.leet = leet; o.slang.leet = leet;
    return o;
  };

  it('counts bits per word correctly', () => {
    // kosmos: eligible o(1) s(2) o(4) s(5)
    expect(leetBitsForWord('kosmos', 'random')).toBe(4);
    expect(leetBitsForWord('kosmos', 'one')).toBe(2);
    expect(leetBitsForWord('kosmos', 'all')).toBe(0);
    // Phrases: each token keeps its first letter ("na dachu": a(1) + a(2) in "dachu" -> 2)
    expect(leetBitsForWord('na dachu', 'random')).toBe(2);
  });

  it.each(['sentence', 'words', 'slang'] as Mode[])('adds no bits for "all" and some for random modes in %s', (mode) => {
    const none = entropyBits(mode, withLeet('none'), specials);
    expect(entropyBits(mode, withLeet('all'), specials)).toBe(none);
    expect(entropyBits(mode, withLeet('one'), specials)).toBeGreaterThan(none);
    expect(entropyBits(mode, withLeet('random'), specials)).toBeGreaterThan(entropyBits(mode, withLeet('one'), specials));
  });

  it.each(['sentence', 'words', 'slang'] as Mode[])('keeps passwords compliant in %s mode', (mode) => {
    for (const leet of ['one', 'random', 'all'] as const) {
      for (let i = 0; i < 100; i++) {
        const c = generateCompliant(mode, withLeet(leet), ctx, policy);
        expect(c).not.toBeNull();
        expect(isCompliant(validatePassword(c!.password, policy))).toBe(true);
      }
    }
  });

  it('applies l33t in generated passwords', () => {
    const c = generate('words', withLeet('all'), ctx);
    const words = c.password.split('-').slice(0, -1);
    for (const w of words) expect(w.slice(1)).not.toMatch(/[aeiostbg]/i);
  });
});
