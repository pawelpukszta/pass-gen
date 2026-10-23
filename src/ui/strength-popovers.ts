/**
 * Explanatory popovers next to "Strength" and "Entropy".
 *
 * Content is rebuilt on every settings change. Popovers open on hover (devices
 * with a pointer), on keyboard focus and on click/tap; click pins them open.
 * Escape or a click outside closes them.
 */

import {
  ATTACKS, averageCrackSeconds, formatBits, formatDuration, formatSearchSpace, suggestImprovements,
} from '../lib/explain';
import { entropyParts, WORD_BANKS, type Mode, type ModeOptions } from '../lib/generators';
import type { LeetMode } from '../lib/leet';
import { STRENGTH_LEVELS, strengthFor } from '../lib/strength';

export interface StrengthContext {
  mode: Mode;
  options: ModeOptions;
  specials: readonly string[];
  bits: number;
  leet: LeetMode;
  /** Share of combinations that fit the length range (memorable modes); 1 = no effect. */
  lengthFit?: number;
  /** True when an upper length limit is set. */
  hasMaxLength?: boolean;
}

const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: 'Not enough randomness. If a database of password hashes leaks, a password like this can be cracked in minutes or hours.',
  2: 'Protects against guessing through the login form. After a leak of fast hashes (e.g. NTLM) it can be cracked in hours or days.',
  3: 'Holds up even after a leak of fast hashes: a single powerful graphics card needs months or more on average.',
  4: 'Out of reach of brute-force attacks, even with fast hashes and large computing resources.',
};

const MODE_NAMES: Record<Mode, string> = {
  sentence: 'sentence', words: 'words', slang: 'slang', random: 'random characters',
};

// ---------------------------------------------------------------------------
// Tiny DOM builder
// ---------------------------------------------------------------------------

type Child = Node | string;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: Child[]) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
}
const row = (label: string, value: string, className = '') =>
  h('li', className ? { class: className } : {}, h('span', {}, label), h('span', {}, value));

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export function renderStrengthPopover(target: HTMLElement, ctx: StrengthContext): void {
  const level = strengthFor(ctx.bits);
  const next = STRENGTH_LEVELS.find((l) => l.minBits > ctx.bits);

  const scale = h('ul', { class: 'scale' }, ...STRENGTH_LEVELS.map((l, i) => {
    const upper = STRENGTH_LEVELS[i + 1];
    const range = upper ? `${l.minBits}-${upper.minBits - 1} bits` : `${l.minBits}+ bits`;
    const li = row(l.label, range, l.rank === level.rank ? 'current' : '');
    li.style.setProperty('--c', `var(--lvl${l.rank})`);
    return li;
  }));

  const parts = entropyParts(ctx.mode, ctx.options, ctx.specials)
    .filter((p) => p.bits > 0.05 || p.label.startsWith('l33t'))
    .sort((a, b) => b.bits - a.bits);
  if (ctx.lengthFit !== undefined && ctx.lengthFit > 0 && ctx.lengthFit < 0.995) {
    const pct = Math.max(1, Math.round(ctx.lengthFit * 100));
    parts.push({ label: `length limit (about ${pct}% of combinations fit)`, bits: Math.log2(ctx.lengthFit) });
  }
  const suggestions = suggestImprovements(ctx.mode, ctx.options, ctx.specials);

  const nodes: Child[] = [
    h('h3', {}, `Strength: ${level.label} (≈ ${formatBits(ctx.bits)})`),
    h('p', {}, LEVEL_DESCRIPTIONS[level.rank] ?? ''),
    scale,
  ];
  if (next) {
    const missing = next.minBits - ctx.bits;
    const enough = suggestions.find((s) => s.gain >= missing);
    nodes.push(h('p', {},
      h('b', {}, `${formatBits(missing)} short of "${next.label}".`),
      enough ? ` For example: ${enough.label.toLowerCase()}.` : suggestions.length ? ' Combine several changes from the list below.' : ''));
  }

  nodes.push(h('p', { class: 'pop-sub' }, `Where the strength comes from (${MODE_NAMES[ctx.mode]} mode)`));
  nodes.push(h('ul', {}, ...parts.map((p) => row(p.label, formatBits(p.bits)))));

  nodes.push(h('p', { class: 'pop-sub' }, 'How to increase it'));
  nodes.push(suggestions.length
    ? h('ul', {}, ...suggestions.map((s) => row(s.label, `+${formatBits(s.gain)}`, 'gain')))
    : h('p', {}, 'The settings of this mode are already at their maximum.'));

  if (ctx.hasMaxLength && suggestions.length) {
    nodes.push(h('p', {}, 'With an upper length limit, extra words may not fit; raise the limit if so.'));
  }
  if (ctx.leet === 'all') {
    nodes.push(h('p', {}, 'Full l33t counts as 0 bits: password cracking tools try these substitutions first.'));
  }
  nodes.push(h('p', {}, 'Strength and policy rules are two different things: a password can meet every rule and still have little randomness.'));
  target.replaceChildren(...nodes);
}

export function renderEntropyPopover(target: HTMLElement, bits: number, options: ModeOptions): void {
  // Example uses the passphrase list of the active language.
  const n = WORD_BANKS[options.language].passphrase.length;
  const exampleBits = 5 * Math.log2(n);
  target.replaceChildren(
    h('h3', {}, `Entropy: ≈ ${formatBits(bits)}`),
    h('p', {}, 'Entropy measures how much randomness goes into generating the password. ',
      h('b', {}, `N bits means 2ᴺ equally likely passwords`), `; here about ${formatSearchSpace(bits)}.`),
    h('p', {}, 'Each extra bit doubles the number of guesses needed. Randomness counts, not length alone: ',
      `5 words from a list of ${n} give about ${formatBits(exampleBits)}, although the password has around 30-40 characters.`),
    h('p', { class: 'pop-sub' }, 'Average time to guess'),
    h('ul', {}, ...ATTACKS.map((a) => row(a.label, formatDuration(averageCrackSeconds(bits, a.rate))))),
    h('p', {}, 'Assumption: the attacker knows the word lists and your settings, so this is a conservative estimate. Attack speeds are orders of magnitude, not exact measurements.'),
  );
}

// ---------------------------------------------------------------------------
// Behaviour
// ---------------------------------------------------------------------------

export function setupPopovers(): void {
  const wrappers = [...document.querySelectorAll<HTMLElement>('.has-pop')];
  const parts = wrappers.map((wrapper) => ({
    wrapper,
    button: wrapper.querySelector<HTMLButtonElement>('.info-btn')!,
    pop: document.getElementById(wrapper.dataset.pop ?? '')!,
    pinned: false,
  }));
  const canHover = () => window.matchMedia('(hover: hover)').matches;

  const open = (p: (typeof parts)[number]) => {
    for (const other of parts) if (other !== p) close(other);
    p.pop.hidden = false;
    p.button.setAttribute('aria-expanded', 'true');
  };
  const close = (p: (typeof parts)[number]) => {
    p.pinned = false;
    p.pop.hidden = true;
    p.button.setAttribute('aria-expanded', 'false');
  };

  for (const p of parts) {
    p.button.addEventListener('click', () => {
      if (p.pop.hidden || !p.pinned) { p.pinned = true; open(p); } else { close(p); }
    });
    p.wrapper.addEventListener('mouseenter', () => { if (canHover()) open(p); });
    p.wrapper.addEventListener('mouseleave', () => { if (!p.pinned) close(p); });
    p.button.addEventListener('focus', () => open(p));
    p.wrapper.addEventListener('focusout', (e) => {
      if (!p.pinned && !p.wrapper.contains(e.relatedTarget as Node | null)) close(p);
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') parts.forEach(close);
  });
  document.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('.has-pop')) parts.forEach(close);
  });
}
