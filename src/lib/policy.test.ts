import { describe, expect, it } from 'vitest';
import {
  isCompliant, normalizedVariants, parseBlockedTerms, validatePassword,
  type PolicyContext, type RuleId,
} from './policy';

const ctx = (username = 'pawel.pukszta'): PolicyContext => ({
  username,
  blockedTerms: parseBlockedTerms('acme\nacme.com'),
});

const failing = (password: string, c: PolicyContext = ctx()): RuleId[] =>
  validatePassword(password, c).filter((r) => r.status === 'fail').map((r) => r.id);

describe('validatePassword', () => {
  it('accepts a compliant passphrase', () => {
    expect(failing('Rudy-Kot-Je-Zielony-Ser-47')).toEqual([]);
    expect(isCompliant(validatePassword('Rudy-Kot-Je-Zielony-Ser-47', ctx()))).toBe(true);
  });

  it('requires at least 14 characters', () => {
    expect(failing('Kot-Ser-47ab')).toContain('length');
    expect(failing('Kot-Ser-47abcX')).not.toContain('length');
  });

  it('requires a digit, an uppercase and a lowercase letter', () => {
    expect(failing('zielony-kot-je-ser')).toEqual(expect.arrayContaining(['digit', 'upper']));
    expect(failing('ZIELONY-KOT-JE-47')).toContain('lower');
  });

  it('treats Polish letters as letters of the right case', () => {
    expect(failing('Żółwie-Gęsi-Łąka-47')).toEqual([]);
  });

  it('blocks more than 2 identical consecutive characters, ignoring case', () => {
    expect(failing('Zielony-Kot-Ser-777')).toContain('repeat');
    expect(failing('Zielony-Kot-SerrR-47')).toContain('repeat');
    expect(failing('Zielony-Kot-Serr-77')).not.toContain('repeat');
  });

  it('blocks weak passwords, also in leetspeak', () => {
    expect(failing('P4ssw0rd-Zielony-12')).toContain('weak');
    expect(failing('Zielony-Kot-123456')).toContain('weak');
    expect(failing('Qwerty-Zielony-Kot-9')).toContain('weak');
  });

  it('blocks predictable terms, case- and leet-insensitive', () => {
    expect(failing('Acme2026!abcXyz')).toContain('blocked');
    expect(failing('4cm3-Zielony-Kot-9')).toContain('blocked');
    expect(failing('Zielony-Kot-acmeCOM-9')).toContain('blocked');
  });

  it('blocks 5 consecutive characters of the username', () => {
    expect(failing('Pawel-Zielony-Kot-91')).toContain('username');
    expect(failing('Zielony-Kot-Puksz-91')).toContain('username');
    // A window crossing the dot in "pawel.pukszta" is not "consecutive" in the password.
    expect(failing('Zielony-Elpuk-Kot-91')).not.toContain('username');
  });

  it('marks the username rule as not checked when the username is empty', () => {
    const rule = validatePassword('Rudy-Kot-Je-Zielony-Ser-47', ctx('')).find((r) => r.id === 'username');
    expect(rule?.status).toBe('na');
  });

  it('blocks palindromes, also with separators removed', () => {
    expect(failing('Kajak1-Zz-1kajaK')).toContain('palindrome');
    expect(failing('Ab12CdeedC21bA')).toContain('palindrome');
    expect(failing('Rudy-Kot-Je-Zielony-Ser-47')).not.toContain('palindrome');
  });

  it('reports password history as an informational rule', () => {
    const rule = validatePassword('anything', ctx()).find((r) => r.id === 'history');
    expect(rule?.status).toBe('info');
  });
});

describe('helpers', () => {
  it('normalizes diacritics and leetspeak', () => {
    const variants = normalizedVariants('Żółw-P4$$');
    expect(variants[0]).toBe('zolw-p4$$');
    expect(variants).toContain('zolw-pass');
    expect(variants).toContain('zolwpass');
  });

  it('parses blocked terms from lines, commas and semicolons', () => {
    expect(parseBlockedTerms(' Acme \nfoo, Bar;x\n\nŁÓDŹ')).toEqual(['acme', 'foo', 'bar', 'lodz']);
  });
});
