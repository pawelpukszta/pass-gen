/**
 * Maps entropy (bits) to a strength level shown in the UI.
 *
 * Thresholds assume an offline attack against fast hashes (e.g. NTLM in Active
 * Directory), where 60+ bits is a reasonable floor for a long-lived password.
 */

export interface StrengthLevel {
  /** 1..4, used to fill the meter segments. */
  rank: 1 | 2 | 3 | 4;
  label: string;
  minBits: number;
}

export const STRENGTH_LEVELS: readonly StrengthLevel[] = [
  { rank: 1, label: 'weak', minBits: 0 },
  { rank: 2, label: 'fair', minBits: 45 },
  { rank: 3, label: 'strong', minBits: 60 },
  { rank: 4, label: 'very strong', minBits: 80 },
];

/** Bits below which the UI suggests strengthening a memorable password. */
export const RECOMMENDED_BITS = 60;

export function strengthFor(bits: number): StrengthLevel {
  let level = STRENGTH_LEVELS[0]!;
  for (const l of STRENGTH_LEVELS) if (bits >= l.minBits) level = l;
  return level;
}
