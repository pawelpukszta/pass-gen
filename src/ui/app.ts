/**
 * DOM wiring: reads controls into Settings, renders generated passwords,
 * the policy checklist and the checker view. All markup lives in index.html.
 */

import {
  entropyBits, generateCompliant, LENGTH_LIMITS, lengthFitInfo, normalizeLengthRange, WORD_BANKS,
  type Candidate, type GlossaryEntry, type HintSegment, type Mode, type ModeOptions,
} from '../lib/generators';
import {
  isCompliant, MIN_LENGTH, parseBlockedTerms, validatePassword,
  type PolicyContext, type RuleId, type RuleResult, type RuleStatus,
} from '../lib/policy';
import { suggestFit, type LengthFit } from '../lib/fit-length';
import type { LengthStats } from '../lib/length-plan';
import { cryptoRandomInt } from '../lib/random';
import { loadSettings, saveSettings, type Settings } from '../lib/settings';
import { RECOMMENDED_BITS, strengthFor } from '../lib/strength';
import { parseSpecials, plural, SPECIAL_CHAR_RE } from '../lib/text';
import { ATTACKS, averageCrackSeconds, formatBits, formatDuration } from '../lib/explain';
import { renderEntropyPopover, renderStrengthPopover, setupPopovers } from './strength-popovers';

/** Number of proposals generated at once: the main one plus alternatives. */
const PROPOSALS = 5;

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  sentence: 'An absurd sentence made of English words, e.g. "Grumpy pirate quietly polishes golden teapot". Easy to picture, so easy to remember.',
  words: 'A few random English words (the EFF list, almost 7,800 words) and a number: a classic passphrase. Easy to type.',
  slang: 'A phrase of Polish slang words mixed with ordinary ones, with an explanation of each term. Warning: potentially offensive content.',
  random: 'Random characters. The strongest per character; best when you keep the password in a password manager.',
};

/** Descriptions used when "Polish words" is on (sentence and words modes only). */
const MODE_DESCRIPTIONS_PL: Partial<Record<Mode, string>> = {
  sentence: 'An absurd sentence made of Polish words, e.g. „Rudy kot cicho je zielony ser”. Easy to picture, so easy to remember. Polish letters are replaced with plain Latin ones (ż → z).',
  words: 'A few random Polish words and a number: a classic passphrase. The list is shorter than the English one, so the same strength needs more words.',
};

/** Modes whose words follow the language checkbox (slang is always Polish). */
const LANGUAGE_MODES: readonly Mode[] = ['sentence', 'words'];

const STATUS_ICON: Record<RuleStatus, string> = { ok: '✓', fail: '✕', na: '–', info: 'i' };
const STATUS_TEXT: Record<RuleStatus, string> = {
  ok: 'met', fail: 'not met', na: 'not checked', info: 'information',
};

type View = 'gen' | 'check';

/**
 * Rules every generated password satisfies by construction (each mode always emits
 * a number, capitalized and lowercase letters, and generateCompliant rejects the rest).
 * Shown only in the checker view, where they depend on what the user typed.
 */
const GENERATOR_GUARANTEED: readonly RuleId[] = ['digit', 'upper', 'lower'];

/**
 * Rules never shown: password history (rule 8) cannot be checked locally at all.
 * It is described in "How it works" and enforced by the target system.
 */
const NEVER_SHOWN: readonly RuleId[] = ['history'];

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

/** Renders a password with per-character classes (digits, uppercase, specials). */
function paintPassword(target: HTMLElement, password: string): void {
  const chars = [...password];
  target.replaceChildren(...chars.map((ch, i) => {
    const className = /\d/.test(ch) ? 'd' : /\p{Lu}/u.test(ch) ? 'u' : SPECIAL_CHAR_RE.test(ch) ? 's' : '';
    const span = el('span', { textContent: ch, className });
    span.style.setProperty('--i', String(i)); // stagger of the per-character entry animation
    return span;
  }));
  // Character count drives the font size, so the main password fills one line.
  target.style.setProperty('--len', String(chars.length));
  target.setAttribute('aria-label', password);
}

function hintNodes(segments: readonly HintSegment[]): Node[] {
  return segments.map((s) => (s.strong ? el('b', { textContent: s.text }) : document.createTextNode(s.text)));
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function startApp(): void {
  const settings: Settings = loadSettings();
  let view: View = 'gen';
  let current: Candidate | null = null;
  let alternatives: Candidate[] = [];
  /** How the user's settings relate to the length range (exact counts); null for the random mode. */
  let lengthInfo: LengthStats | null = null;
  /** Proposed settings when nothing fits the range; applied only on the user's click. */
  let suggestion: LengthFit | null = null;
  /** Changes just applied from a suggestion, shown once as a confirmation. */
  let appliedChanges: string[] | null = null;
  const nothingFits = () => Boolean(lengthInfo && lengthInfo.fitting === 0);

  const specials = () => parseSpecials(settings.specials);
  const policyContext = (): PolicyContext => ({
    username: settings.username,
    blockedTerms: parseBlockedTerms(settings.blockedTerms),
  });
  const persist = () => saveSettings(settings);

  /** l33t setting of the active mode ('none' for the random mode). */
  const currentLeet = () => (settings.mode === 'random' ? 'none' : settings[settings.mode].leet);

  // ----- Rendering -------------------------------------------------------

  function renderStrength(): void {
    if (nothingFits()) {
      // Nothing fits the length range: there is no password to rate.
      $('bits').textContent = '—';
      $('lvl-label').textContent = '—';
      [...$('meter').children].forEach((seg) => { (seg as HTMLElement).style.background = ''; });
      const none = 'No password to rate: no combination fits the selected length range.';
      $('pop-strength').textContent = none;
      $('pop-entropy').textContent = none;
      $('tip').textContent = '';
      $('crack-time').textContent = '';
      return;
    }
    // Keeping only passwords that fit the length range removes combinations: -log2(share) bits.
    const lengthFit = lengthInfo ? lengthInfo.fraction : 1;
    const exactBits = entropyBits(settings.mode, settings, specials()) + Math.log2(lengthFit);
    const bits = exactBits;
    const level = strengthFor(bits);
    renderStrengthPopover($('pop-strength'), {
      mode: settings.mode, options: settings, specials: specials(), bits: exactBits, leet: currentLeet(),
      lengthFit, hasMaxLength: settings.mode !== 'random' && effectiveRange().max > 0,
    });
    renderEntropyPopover($('pop-entropy'), exactBits, settings);
    $('bits').textContent = `≈ ${formatBits(bits)}`;
    // At-a-glance cracking time (details in the entropy popover).
    const [, slow, fast] = ATTACKS;
    const fastText = formatDuration(averageCrackSeconds(bits, fast!.rate));
    const slowText = formatDuration(averageCrackSeconds(bits, slow!.rate));
    $('crack-time').replaceChildren(...(fastText === slowText
      ? ['Average time to crack after a leak: ', el('strong', { textContent: fastText }), ', even with a fast hash (e.g. NTLM)']
      : ['Average time to crack after a leak: ', el('strong', { textContent: fastText }), ' (fast hash, e.g. NTLM) · ',
        el('strong', { textContent: slowText }), ' (bcrypt)']));
    $('lvl-label').textContent = level.label;
    [...$('meter').children].forEach((seg, i) => {
      (seg as HTMLElement).style.background = i < level.rank ? `var(--lvl${level.rank})` : '';
    });
    let tip = '';
    if (bits < RECOMMENDED_BITS && settings.mode === 'sentence') {
      tip = 'Want it stronger? Turn on the missing parts of the sentence, add a digit or special characters.';
    } else if (bits < RECOMMENDED_BITS && settings.mode === 'words') {
      const perWord = Math.log2(WORD_BANKS[settings.language].passphrase.length);
      tip = `Want it stronger? Add a word: each one is about ${formatBits(perWord)}.`;
    } else if (bits < RECOMMENDED_BITS && settings.mode === 'slang') {
      tip = 'Want it stronger? Add a word (a slang one is about 7.5 bits, an ordinary one about 10) or special characters.';
    }
    const range = effectiveRange();
    if (lengthFit < 0.5 && settings.mode !== 'random' && range.max > 0) {
      // Under a tight length limit more words do not fit; random characters use each character best.
      const randomSame = entropyBits('random', { ...settings, random: { ...settings.random, length: range.max } }, specials());
      tip = `A short length range limits strength. For more: widen the range or use the "Random" mode (${range.max} random characters give about ${formatBits(randomSame)}).`;
    }
    if (currentLeet() === 'all') {
      tip = 'Full l33t does not add strength: password cracking tools try these substitutions first. Only random substitutions add strength.';
    }
    $('tip').textContent = tip;
  }

  function renderMain(): void {
    const hint = $('pw-hint');
    renderFitNote();
    // Messages in place of a password use the body font, not the large monospace.
    $('pw-main').classList.toggle('pw-empty', !current);
    if (!current) {
      $('pw-main').textContent = nothingFits() && lengthInfo
        ? lengthImpossibleMessage(lengthInfo)
        : 'Could not generate a password that meets the rules. Change the settings.';
      $('pw-main').removeAttribute('aria-label');
      hint.hidden = true;
      $('leet-legend').hidden = true;
      return;
    }
    paintPassword($('pw-main'), current.password);
    hint.hidden = current.hint.length === 0;
    hint.replaceChildren('Remember: ', ...hintNodes(current.hint));
    $('leet-legend').hidden = currentLeet() === 'none';
    renderGlossary(current.glossary ?? []);
  }

  function lengthImpossibleMessage(info: LengthStats): string {
    const { min, max } = effectiveRange();
    const range = max ? `${min}-${max}` : `${min}+`;
    return `With the current settings, passwords have ${info.minLength} to ${info.maxLength} characters, `
      + `so none fits the ${range} range.`;
  }

  /**
   * Under the password: either a proposal (with an "apply" button) when nothing fits the
   * range, or a one-time confirmation after the proposal was applied.
   */
  function renderFitNote(): void {
    const note = $('fit-note');
    const { min, max } = effectiveRange();
    const range = max ? `${min}-${max}` : `${min}+`;
    if (appliedChanges?.length) {
      note.hidden = false;
      note.replaceChildren(
        el('strong', { textContent: `Settings changed so the password fits the ${range} range: ` }),
        `${appliedChanges.join(', ')}.`,
      );
      return;
    }
    if (nothingFits()) {
      note.hidden = false;
      if (suggestion?.feasible) {
        const apply = el('button', { className: 'btn sm', type: 'button', textContent: 'Apply' });
        apply.addEventListener('click', applySuggestion);
        note.replaceChildren(
          el('strong', { textContent: 'Suggestion: ' }),
          `${suggestion.changes.join(', ')}. `,
          apply,
        );
      } else {
        note.replaceChildren(`This mode cannot produce a password in the ${range} range. Widen the range or use the "Random" mode, where you set the exact length.`);
      }
      return;
    }
    note.hidden = true;
  }

  /** Copies the proposed settings into the user's settings (in place, controls keep their bindings). */
  function applySuggestion(): void {
    if (!suggestion?.feasible || settings.mode === 'random') return;
    const mode = settings.mode;
    Object.assign(settings[mode], suggestion.options[mode]);
    const changes = suggestion.changes;
    persist(); syncBindings(); syncDependentControls();
    regenerate();
    appliedChanges = changes;
    renderFitNote();
  }

  function renderGlossary(entries: readonly GlossaryEntry[]): void {
    $('glossary').hidden = entries.length === 0;
    $('glossary-list').replaceChildren(...entries.map((e) => {
      const dt = el('dt', {}, [e.term]);
      if (e.vulgar) dt.append(el('span', { className: 'tag', textContent: 'vulgar' }));
      const link = el('a', { href: e.url, target: '_blank', rel: 'noopener noreferrer', textContent: 'miejski.pl ↗' });
      link.setAttribute('aria-label', `Definitions of ${e.term} on miejski.pl`);
      return el('div', { className: 'entry' }, [dt, el('dd', { textContent: e.meaning }), link]);
    }));
  }

  function renderAlternatives(): void {
    $('alts').replaceChildren(...alternatives.map((alt, index) => {
      const pw = el('p', { className: 'pw' });
      paintPassword(pw, alt.password);
      const choose = el('button', { className: 'btn sm', type: 'button', textContent: 'Choose' });
      choose.addEventListener('click', () => {
        if (!current) return;
        [current, alternatives[index]] = [alt, current];
        renderMain(); renderAlternatives(); renderRules();
      });
      const copyBtn = el('button', { className: 'btn sm', type: 'button', textContent: 'Copy' });
      copyBtn.addEventListener('click', () => void copyToClipboard(alt.password, copyBtn, pw));
      const li = el('li', {}, [pw, el('div', { className: 'alt-btns' }, [choose, copyBtn])]);
      if (alt.hint.length) li.append(el('p', { className: 'alt-hint' }, hintNodes(alt.hint)));
      return li;
    }));
  }

  function renderRules(): void {
    const ctx = policyContext();
    const password = view === 'gen' ? current?.password ?? '' : $<HTMLInputElement>('chk-input').value;
    $('rules-for').textContent = view === 'gen' ? 'For the generated password' : 'For the entered password';

    let results = validatePassword(password, ctx);
    if (!password) {
      // Nothing to check yet: show the rules as neutral.
      results = results.map((r) => (r.status === 'info' || (r.id === 'username' && r.status === 'na')
        ? r : { id: r.id, label: r.label, status: 'na' as const }));
    }
    // The verdict counts every rule; the generator view hides rules its output always satisfies.
    if (view === 'check') renderVerdict(password, results);
    const visible = results.filter((r) => !NEVER_SHOWN.includes(r.id)
      && !(view === 'gen' && GENERATOR_GUARANTEED.includes(r.id)));
    $('rules').replaceChildren(...visible.map(ruleItem));
    $('rules-note').hidden = view !== 'gen';
  }

  function ruleItem(r: RuleResult): HTMLLIElement {
    const label = el('span', { className: 'rule-label' }, [
      r.label,
      el('span', { className: 'sr', textContent: ` (${STATUS_TEXT[r.status]})` }),
    ]);
    if (r.detail) label.append(el('span', { className: 'rule-detail', textContent: r.detail }));
    const icon = el('span', { className: `st ${r.status}`, textContent: STATUS_ICON[r.status] });
    icon.setAttribute('aria-hidden', 'true');
    return el('li', {}, [icon, label]);
  }

  function renderVerdict(password: string, results: readonly RuleResult[]): void {
    const verdict = $('chk-verdict');
    const stats = $('chk-stats');
    if (!password) {
      verdict.className = 'verdict';
      verdict.textContent = 'Enter a password and the rules on the right will show what is fine and what needs fixing.';
      stats.hidden = true;
      return;
    }
    const fails = results.filter((r) => r.status === 'fail').length;
    verdict.className = fails ? 'verdict bad' : 'verdict good';
    verdict.textContent = fails
      ? `To fix: ${fails} ${plural(fails, 'rule', 'rules')}.`
      : 'The password meets every rule that can be checked here.';

    const chars = [...password];
    const count = (re: RegExp) => chars.filter((c) => re.test(c)).length;
    const upper = count(/\p{Lu}/u);
    const lower = count(/\p{Ll}/u);
    const digits = count(/\d/);
    const stat = (name: string, value: number) => el('span', {}, [`${name} `, el('strong', { textContent: String(value) })]);
    stats.hidden = false;
    stats.replaceChildren(
      stat('Length', chars.length), stat('Uppercase', upper), stat('Lowercase', lower),
      stat('Digits', digits), stat('Other', chars.length - upper - lower - digits),
    );
  }

  function regenerate(): void {
    const genCtx = { specials: specials(), rand: cryptoRandomInt };
    const policy = policyContext();
    const list: Candidate[] = [];
    const memorable = settings.mode !== 'random';
    appliedChanges = null;
    const range = effectiveRange();
    lengthInfo = memorable ? lengthFitInfo(settings.mode, settings, genCtx.specials.length, range) : null;
    suggestion = nothingFits() ? suggestFit(settings.mode, settings, genCtx.specials, range) : null;
    const opts = {
      lengthRange: memorable ? range : undefined,
      allowShort: isShortAllowed(),
      maxAttempts: 1000,
    };
    if (!nothingFits()) {
      for (let i = 0; i < PROPOSALS; i++) {
        const candidate = generateCompliant(settings.mode, settings, genCtx, policy, opts);
        if (candidate) list.push(candidate);
      }
    }
    current = list.shift() ?? null;
    alternatives = list;
    renderMain(); renderAlternatives(); renderStrength(); renderRules(); renderLengthAutoInfo();
  }

  async function copyToClipboard(text: string, button: HTMLElement, source: HTMLElement): Promise<void> {
    const label = button.querySelector('span') ?? button;
    const original = label.textContent;
    try {
      await navigator.clipboard.writeText(text);
      label.textContent = 'Copied';
    } catch {
      // Clipboard API refused: select the text so the user can copy it manually.
      const range = document.createRange();
      range.selectNodeContents(source);
      const selection = getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      label.textContent = 'Selected: Ctrl+C';
    }
    setTimeout(() => { label.textContent = original; }, 1600);
  }

  // ----- Mode switch -----------------------------------------------------

  function setMode(mode: Mode): void {
    settings.mode = mode;
    persist();
    document.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    });
    document.querySelectorAll<HTMLElement>('[data-opts]').forEach((panel) => {
      panel.hidden = panel.dataset.opts !== mode;
    });
    renderModeDescription();
    $('lang-row').hidden = !LANGUAGE_MODES.includes(mode);
    renderLengthWarning();
    regenerate();
  }

  function renderModeDescription(): void {
    const mode = settings.mode;
    $('mode-desc').textContent = (settings.language === 'pl' && MODE_DESCRIPTIONS_PL[mode]) || MODE_DESCRIPTIONS[mode];
  }

  const polishInput = $<HTMLInputElement>('opt-polish');
  polishInput.checked = settings.language === 'pl';
  polishInput.addEventListener('change', () => {
    settings.language = polishInput.checked ? 'pl' : 'en';
    persist(); renderModeDescription(); regenerate();
  });
  document.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach((b) => {
    b.addEventListener('click', () => setMode(b.dataset.mode as Mode));
  });

  // ----- Option bindings -------------------------------------------------

  type Section = keyof ModeOptions;
  type Binding = { id: string; section: Section; key: string; kind: 'bool' | 'int' | 'str' };
  const bindings: Binding[] = [
    { id: 's-adj', section: 'sentence', key: 'adjectives', kind: 'bool' },
    { id: 's-adv', section: 'sentence', key: 'adverb', kind: 'bool' },
    { id: 's-place', section: 'sentence', key: 'place', kind: 'bool' },
    { id: 's-digits', section: 'sentence', key: 'digits', kind: 'int' },
    { id: 's-numpos', section: 'sentence', key: 'numberPosition', kind: 'str' },
    { id: 's-sep', section: 'sentence', key: 'separator', kind: 'str' },
    { id: 's-spec', section: 'sentence', key: 'specials', kind: 'str' },
    { id: 's-leet', section: 'sentence', key: 'leet', kind: 'str' },
    { id: 'w-count', section: 'words', key: 'count', kind: 'int' },
    { id: 'w-caps', section: 'words', key: 'caps', kind: 'str' },
    { id: 'w-digits', section: 'words', key: 'digits', kind: 'int' },
    { id: 'w-numpos', section: 'words', key: 'numberPosition', kind: 'str' },
    { id: 'w-sep', section: 'words', key: 'separator', kind: 'str' },
    { id: 'w-spec', section: 'words', key: 'specials', kind: 'str' },
    { id: 'w-leet', section: 'words', key: 'leet', kind: 'str' },
    { id: 'sl-count', section: 'slang', key: 'slangCount', kind: 'int' },
    { id: 'sl-extra', section: 'slang', key: 'extraWords', kind: 'int' },
    { id: 'sl-vulgar', section: 'slang', key: 'allowVulgar', kind: 'bool' },
    { id: 'sl-caps', section: 'slang', key: 'caps', kind: 'str' },
    { id: 'sl-digits', section: 'slang', key: 'digits', kind: 'int' },
    { id: 'sl-numpos', section: 'slang', key: 'numberPosition', kind: 'str' },
    { id: 'sl-sep', section: 'slang', key: 'separator', kind: 'str' },
    { id: 'sl-spec', section: 'slang', key: 'specials', kind: 'str' },
    { id: 'sl-leet', section: 'slang', key: 'leet', kind: 'str' },
    { id: 'r-len', section: 'random', key: 'length', kind: 'int' },
    { id: 'r-special', section: 'random', key: 'useSpecials', kind: 'bool' },
    { id: 'r-noambig', section: 'random', key: 'excludeAmbiguous', kind: 'bool' },
    { id: 'r-minspec', section: 'random', key: 'minSpecials', kind: 'int' },
  ];

  /** Writes current settings into every bound control (e.g. after applying a suggestion). */
  function syncBindings(): void {
    for (const { id, section, key, kind } of bindings) {
      const input = $<HTMLInputElement | HTMLSelectElement>(id);
      const store = settings[section] as unknown as Record<string, unknown>;
      if (kind === 'bool') (input as HTMLInputElement).checked = Boolean(store[key]);
      else input.value = String(store[key]);
    }
    $('r-len-out').textContent = String(settings.random.length);
    $<HTMLInputElement>('r-len-num').value = String(settings.random.length);
  }
  syncBindings();

  // Number field next to the length slider: typing a value moves the slider.
  const lenNum = $<HTMLInputElement>('r-len-num');
  lenNum.addEventListener('change', () => {
    const slider = $<HTMLInputElement>('r-len');
    const value = Math.min(Number(slider.max), Math.max(Number(slider.min), Math.round(Number(lenNum.value) || settings.random.length)));
    lenNum.value = String(value);
    slider.value = String(value);
    slider.dispatchEvent(new Event('input'));
  });

  for (const { id, section, key, kind } of bindings) {
    const input = $<HTMLInputElement | HTMLSelectElement>(id);
    const store = settings[section] as unknown as Record<string, unknown>;
    const eventName = input instanceof HTMLInputElement && input.type === 'range' ? 'input' : 'change';
    input.addEventListener(eventName, () => {
      store[key] = kind === 'bool' ? (input as HTMLInputElement).checked
        : kind === 'int' ? Number.parseInt(input.value, 10) : input.value;
      if (id === 'r-len') {
        $('r-len-out').textContent = input.value;
        $<HTMLInputElement>('r-len-num').value = input.value;
      }
      persist(); syncDependentControls(); regenerate();
    });
  }
  $('r-len-out').textContent = String(settings.random.length);

  // ----- Password length -------------------------------------------------

  /** Range used for memorable modes: the custom slider range, or just the policy minimum in auto mode. */
  function effectiveRange(): { min: number; max: number } {
    return settings.lengthMode === 'custom' ? settings.lengthRange : { min: MIN_LENGTH, max: 0 };
  }

  /** True when the user deliberately chose passwords shorter than the policy minimum. */
  function isShortAllowed(): boolean {
    return settings.mode === 'random' ? settings.random.length < MIN_LENGTH : effectiveRange().min < MIN_LENGTH;
  }

  function renderLengthWarning(): void {
    const warn = $('length-warn');
    warn.hidden = !isShortAllowed();
    warn.replaceChildren(
      el('strong', { textContent: `Warning: the policy requires at least ${MIN_LENGTH} characters.` }),
      ` A shorter password will be rejected when you change your password. ${MIN_LENGTH} or more is recommended.`,
    );
    $('length-row').hidden = settings.mode === 'random';
  }

  // Length mode: "From generator" (auto) or "Custom range" (custom, dual range slider).
  const lenMin = $<HTMLInputElement>('len-min');
  const lenMax = $<HTMLInputElement>('len-max');
  for (const input of [lenMin, lenMax]) {
    input.min = String(LENGTH_LIMITS.min);
    input.max = String(LENGTH_LIMITS.max);
  }
  const toFraction = (n: number) => (n - LENGTH_LIMITS.min) / (LENGTH_LIMITS.max - LENGTH_LIMITS.min);
  $('len-track').style.setProperty('--pol', String(toFraction(MIN_LENGTH)));

  /** Paints the slider (values, highlighted span) without touching settings. */
  function paintLengthSlider(min: number, max: number): void {
    lenMin.value = String(min);
    lenMax.value = String(max);
    $('len-min-out').textContent = String(min);
    $('len-max-out').textContent = String(max);
    const track = $('len-track');
    track.style.setProperty('--lo', String(toFraction(min)));
    track.style.setProperty('--hi', String(toFraction(max)));
    // When both thumbs sit at the right end, keep the "from" thumb on top so it can still be dragged.
    lenMin.style.zIndex = min >= LENGTH_LIMITS.max - 2 ? '3' : '';
  }

  /** Writes mode buttons, slider and the "auto" description from settings. */
  function syncLengthControls(): void {
    const custom = settings.lengthMode === 'custom';
    document.querySelectorAll<HTMLButtonElement>('[data-len-mode]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.lenMode === settings.lengthMode));
    });
    $('len-custom').hidden = !custom;
    $('len-auto-info').hidden = custom;
    paintLengthSlider(settings.lengthRange.min, settings.lengthRange.max);
  }

  /** "From generator": tell what lengths the current settings produce. */
  function renderLengthAutoInfo(): void {
    if (settings.mode === 'random' || settings.lengthMode !== 'auto' || !lengthInfo) return;
    const info = lengthInfo;
    $('len-auto-info').textContent = `Length follows from the settings: usually ${info.typicalMin}-${info.typicalMax} characters `
      + `(possible ${info.minLength}-${info.maxLength}). Passwords shorter than ${MIN_LENGTH} characters are skipped.`;
  }

  /** Slider movement: thumbs never cross, so "to" is never smaller than "from". */
  let lengthFrame = 0;
  const onSliderInput = (moved: 'min' | 'max') => {
    let min = Number(lenMin.value);
    let max = Number(lenMax.value);
    if (min > max) {
      if (moved === 'min') min = max; else max = min;
    }
    paintLengthSlider(min, max);
    settings.lengthRange = { min, max };
    // Regenerate at most once per animation frame while dragging.
    cancelAnimationFrame(lengthFrame);
    lengthFrame = requestAnimationFrame(() => { persist(); renderLengthWarning(); regenerate(); });
  };
  lenMin.addEventListener('input', () => onSliderInput('min'));
  lenMax.addEventListener('input', () => onSliderInput('max'));

  document.querySelectorAll<HTMLButtonElement>('[data-len-mode]').forEach((b) => {
    b.addEventListener('click', () => {
      const mode = b.dataset.lenMode === 'custom' ? 'custom' : 'auto';
      if (mode === settings.lengthMode) return;
      if (mode === 'custom' && settings.mode !== 'random') {
        // Start from what the generator produces now (10th-90th percentile), so nothing changes until you drag.
        const info = lengthFitInfo(settings.mode, settings, specials().length, { min: MIN_LENGTH, max: 0 });
        settings.lengthRange = normalizeLengthRange(Math.max(MIN_LENGTH, info.typicalMin), info.typicalMax).range;
      }
      settings.lengthMode = mode;
      syncLengthControls();
      persist(); renderLengthWarning(); regenerate();
    });
  });
  syncLengthControls();

  // ----- Special characters ----------------------------------------------

  function syncDependentControls(): void {
    renderLengthWarning();
    $<HTMLSelectElement>('s-sep').disabled = settings.sentence.specials === 'separator';
    $<HTMLSelectElement>('w-sep').disabled = settings.words.specials === 'separator';
    $<HTMLSelectElement>('sl-sep').disabled = settings.slang.specials === 'separator';
    $<HTMLSelectElement>('r-minspec').disabled = !settings.random.useSpecials;
    const n = specials().length;
    $('specials-help').textContent = n
      ? `In use: ${n} ${plural(n, 'character', 'characters')}. Remove any your system does not accept.`
      : 'No allowed characters: passwords will have no special characters.';
  }

  const specialsInput = $<HTMLInputElement>('specials');
  specialsInput.value = settings.specials;
  let specialsTimer: ReturnType<typeof setTimeout> | undefined;
  specialsInput.addEventListener('input', () => {
    settings.specials = specialsInput.value;
    persist(); syncDependentControls();
    clearTimeout(specialsTimer);
    specialsTimer = setTimeout(regenerate, 250);
  });
  syncDependentControls();

  // ----- Context: username and blocked terms -----------------------------

  const userInput = $<HTMLInputElement>('ctx-user');
  const blockedInput = $<HTMLTextAreaElement>('ctx-blocked');
  userInput.value = settings.username;
  blockedInput.value = settings.blockedTerms;
  let contextTimer: ReturnType<typeof setTimeout> | undefined;
  const onContextInput = () => {
    settings.username = userInput.value;
    settings.blockedTerms = blockedInput.value;
    persist();
    clearTimeout(contextTimer);
    contextTimer = setTimeout(() => {
      // Keep current proposals if they still comply; otherwise regenerate.
      const ctx = policyContext();
      const stillValid = [current, ...alternatives].every((c) => c && isCompliant(validatePassword(c.password, ctx)));
      if (stillValid) renderRules(); else regenerate();
    }, 250);
  };
  userInput.addEventListener('input', onContextInput);
  blockedInput.addEventListener('input', onContextInput);

  // ----- Buttons, tabs, checker ------------------------------------------

  $('btn-gen').addEventListener('click', regenerate);
  $('btn-copy').addEventListener('click', () => {
    if (current) void copyToClipboard(current.password, $('btn-copy'), $('pw-main'));
  });

  function setView(next: View): void {
    view = next;
    $('tab-gen').setAttribute('aria-selected', String(next === 'gen'));
    $('tab-check').setAttribute('aria-selected', String(next === 'check'));
    $('view-gen').hidden = next !== 'gen';
    $('view-check').hidden = next !== 'check';
    renderRules();
    if (next === 'check') $('chk-input').focus();
  }
  $('tab-gen').addEventListener('click', () => setView('gen'));
  $('tab-check').addEventListener('click', () => setView('check'));

  const checkInput = $<HTMLInputElement>('chk-input');
  checkInput.addEventListener('input', renderRules);
  $('chk-toggle').addEventListener('click', () => {
    const show = checkInput.type === 'password';
    checkInput.type = show ? 'text' : 'password';
    $('chk-toggle').textContent = show ? 'Hide' : 'Show';
    $('chk-toggle').setAttribute('aria-pressed', String(show));
  });

  setupPopovers();
  setMode(settings.mode);
  // '#sprawdz' is the pre-translation anchor, kept so old links still work.
  if (location.hash === '#check' || location.hash === '#sprawdz') setView('check');
}
