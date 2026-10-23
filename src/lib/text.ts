/** Small text helpers shared by the policy, the generators and the UI. */

const POLISH_TO_ASCII: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
};

/** Replaces Polish diacritics with their ASCII base letters, preserving case. */
export function deburr(input: string): string {
  return input.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => {
    const lower = ch.toLowerCase();
    const ascii = POLISH_TO_ASCII[lower] ?? lower;
    return ch === lower ? ascii : ascii.toUpperCase();
  });
}

/** Upper-cases the first character. */
export function capitalize(input: string): string {
  return input ? input.charAt(0).toUpperCase() + input.slice(1) : input;
}

/**
 * English plural form picker.
 * plural(1, 'character', 'characters') -> 'character'; 0, 3 or 12 -> 'characters'.
 */
export function plural(n: number, one: string, other: string): string {
  return n === 1 ? one : other;
}

/** ASCII punctuation, i.e. what password policies usually call "special characters". */
export const SPECIAL_CHAR_RE = /^[!-/:-@[-`{-~]$/;

/** Turns free text into a de-duplicated list of allowed special characters. */
export function parseSpecials(text: string): string[] {
  return [...new Set([...text].filter((ch) => SPECIAL_CHAR_RE.test(ch)))];
}
