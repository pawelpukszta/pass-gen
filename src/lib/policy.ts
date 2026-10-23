/**
 * Password policy rules and validation.
 *
 * Policy:
 *  1. Minimum length: 14 characters.
 *  2. At least one digit, one uppercase and one lowercase letter.
 *  3. No more than 2 identical consecutive characters.
 *  4. Passwords on the weak / commonly used list are blocked.
 *  5. Passwords containing predictable terms (organization or service name) are blocked.
 *  6. Passwords containing 5 consecutive characters of the username are blocked.
 *  7. Palindromes are blocked.
 *  8. The last 10 passwords cannot be reused (enforced by the target system only).
 *
 * Interpretation notes (deliberately stricter than the literal wording, so that
 * anything accepted here is also accepted by the real system):
 *  - Rule 3 is case-insensitive ("aaA" fails).
 *  - Rules 4 and 5 use substring matching on normalized variants: lowercase,
 *    no Polish diacritics, common leetspeak substitutions (4->a, 0->o, 1->i/l...)
 *    and with separators stripped.
 *  - Rule 7 also checks the password with separators stripped.
 */

import { WEAK_PASSWORDS } from '../data/weak-passwords';
import { deburr, plural } from './text';

export const MIN_LENGTH = 14;
export const MAX_IDENTICAL_RUN = 2;
export const USERNAME_WINDOW = 5;
export const PASSWORD_HISTORY = 10;
/** Weak list entries shorter than this are ignored for substring matching. */
const MIN_WEAK_TOKEN = 4;
/** Blocked terms shorter than this are ignored (too many false positives). */
const MIN_BLOCKED_TERM = 3;

export type RuleId =
  | 'length' | 'digit' | 'upper' | 'lower' | 'repeat'
  | 'weak' | 'blocked' | 'username' | 'palindrome' | 'history';

/** ok = passes, fail = violates, na = cannot be checked (missing input), info = checked elsewhere. */
export type RuleStatus = 'ok' | 'fail' | 'na' | 'info';

export interface RuleResult {
  id: RuleId;
  label: string;
  status: RuleStatus;
  /** Plain text (never HTML); the UI is responsible for escaping. */
  detail?: string;
}

export interface PolicyContext {
  /** Username of the account; empty string when unknown. */
  username: string;
  /** Normalized predictable terms, see parseBlockedTerms. */
  blockedTerms: readonly string[];
}

export const RULE_LABELS: Record<RuleId, string> = {
  length: `At least ${MIN_LENGTH} characters`,
  digit: 'At least one digit',
  upper: 'At least one uppercase letter',
  lower: 'At least one lowercase letter',
  repeat: `At most ${MAX_IDENTICAL_RUN} identical characters in a row`,
  weak: 'Does not resemble common passwords',
  blocked: 'No predictable terms',
  username: `No ${USERNAME_WINDOW} consecutive characters from the username`,
  palindrome: 'Not a palindrome',
  history: `Different from the previous ${PASSWORD_HISTORY} passwords`,
};

const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g',
  '@': 'a', $: 's', '!': 'i', '+': 't',
};

const stripNonAlnum = (s: string) => s.replace(/[^a-z0-9]/g, '');
const mapChars = (s: string, map: (ch: string) => string) => [...s].map(map).join('');

/**
 * Normalized forms of a password used for dictionary-style checks.
 * The first element is always the plain lowercase, diacritic-free form.
 */
export function normalizedVariants(password: string): string[] {
  const literal = literalVariants(password);
  return [...new Set([...literal, ...literal.map(stripNonAlnum)])];
}

/** Lowercase form plus its two leetspeak readings, separators kept. */
function literalVariants(password: string): [string, string, string] {
  const lower = deburr(password.toLowerCase());
  const leetI = mapChars(lower, (c) => LEET[c] ?? c);
  const leetL = mapChars(lower, (c) => (c === '1' ? 'l' : LEET[c] ?? c));
  return [lower, leetI, leetL];
}

/** Splits user input (newlines, commas, semicolons) into normalized blocked terms. */
export function parseBlockedTerms(text: string): string[] {
  const terms = text
    .split(/[\n,;]+/)
    .map((t) => deburr(t.trim().toLowerCase()))
    .filter((t) => t.length >= MIN_BLOCKED_TERM);
  return [...new Set(terms)];
}

/** Returns the first token found in any variant, checking also the token without punctuation. */
function findToken(variants: readonly string[], tokens: readonly string[]): string | null {
  for (const token of tokens) {
    const forms = [token, stripNonAlnum(token)].filter((f) => f.length >= MIN_BLOCKED_TERM);
    if (forms.some((form) => variants.some((v) => v.includes(form)))) return token;
  }
  return null;
}

const WEAK_TOKENS = WEAK_PASSWORDS.filter((w) => w.length >= MIN_WEAK_TOKEN);

function isPalindrome(s: string): boolean {
  return s.length > 1 && s === [...s].reverse().join('');
}

/** Validates a password against every rule. Never throws. */
export function validatePassword(password: string, ctx: PolicyContext): RuleResult[] {
  const variants = normalizedVariants(password);
  const lower = variants[0]!;
  const result = (id: RuleId, status: RuleStatus, detail?: string): RuleResult =>
    ({ id, label: RULE_LABELS[id], status, ...(detail ? { detail } : {}) });

  const length = [...password].length;
  const run = password.match(new RegExp(`(.)\\1{${MAX_IDENTICAL_RUN}}`, 'iu'));
  const weak = findToken(variants, WEAK_TOKENS);
  const blocked = findToken(variants, ctx.blockedTerms);

  const results: RuleResult[] = [
    result('length', length >= MIN_LENGTH ? 'ok' : 'fail', `${length} ${plural(length, 'character', 'characters')}`),
    result('digit', /\d/.test(password) ? 'ok' : 'fail'),
    result('upper', /\p{Lu}/u.test(password) ? 'ok' : 'fail'),
    result('lower', /\p{Ll}/u.test(password) ? 'ok' : 'fail'),
    result('repeat', run ? 'fail' : 'ok', run ? `contains "${run[0]}"` : undefined),
    result('weak', weak ? 'fail' : 'ok', weak ? `contains "${weak}"` : undefined),
    result('blocked', blocked ? 'fail' : 'ok',
      blocked ? `contains "${blocked}"` : ctx.blockedTerms.length ? undefined : 'the list of terms is empty'),
    usernameRule(literalVariants(password), ctx.username),
    result('palindrome', isPalindrome(lower) || isPalindrome(lower.replace(/[^\p{L}\p{N}]/gu, '')) ? 'fail' : 'ok'),
    result('history', 'info', 'Checked by the system when you change your password'),
  ];
  return results;

  function usernameRule(vars: readonly string[], username: string): RuleResult {
    const user = deburr(username.trim().toLowerCase());
    if (!user) return result('username', 'na', 'Enter a username to check this');
    // Separators are kept: a window crossing a stripped separator is not "consecutive".
    const candidates = vars;
    for (let i = 0; i + USERNAME_WINDOW <= user.length; i++) {
      const window = user.slice(i, i + USERNAME_WINDOW);
      if (candidates.some((v) => v.includes(window))) return result('username', 'fail', `contains "${window}"`);
    }
    return result('username', 'ok');
  }
}

/** True when no rule fails ("na" and "info" do not block). */
export function isCompliant(results: readonly RuleResult[]): boolean {
  return results.every((r) => r.status !== 'fail');
}
