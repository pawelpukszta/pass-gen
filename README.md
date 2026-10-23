# Password Generator

Password generator and checker that produces passwords compliant with a strict password policy (rules below).
Four generation modes: memorable sentences and passphrases in English (default) or Polish, Polish slang passphrases with explanations, and random characters.
Everything runs in the browser; passwords are never sent anywhere or stored.

## Quick start

```bash
pnpm install
pnpm dev           # dev server with hot reload
pnpm test          # Vitest: policy rules and generators
pnpm build         # typecheck + single-file build to dist/index.html
pnpm preview       # serve the production build
```

Requires Node.js 20+. npm works as well (`npm install`, `npm run dev`), but use npm 11+:
npm 10 fails on this dependency set with `Cannot read properties of null (reading 'edgesOut')`.
Keep a single lockfile for the package manager you use. The UI, code, comments and docs are in English.

`dist/index.html` is fully self-contained (JS and CSS inlined by `vite-plugin-singlefile`),
so it can be opened directly from disk or published as a single page.
Only the Google Fonts stylesheet is loaded from the network; without it the page falls back to system fonts.

## Policy

Implemented in [`src/lib/policy.ts`](src/lib/policy.ts):

| # | Rule | How it is checked |
|---|------|-------------------|
| 1 | At least 14 characters | Counted in Unicode code points |
| 2 | At least one digit, one uppercase and one lowercase letter | Unicode-aware (`\p{Lu}`, `\p{Ll}`), so Polish letters count |
| 3 | No more than 2 identical consecutive characters | Case-insensitive: `aaA` fails |
| 4 | Not on the weak / common password list | Substring match on normalized variants (see below), list in `src/data/weak-passwords.ts` |
| 5 | No predictable terms (organization, service names) | Same matching; terms are entered in the UI, the list is empty by default |
| 6 | No 5 consecutive characters of the username | Every 5-character window of the username, separators kept |
| 7 | Not a palindrome | Whole password, also with separators removed |
| 8 | Not one of the last 10 passwords | Cannot be checked locally; enforced by the target system only |

In the generator view the checklist hides rule 2 (digit, uppercase, lowercase): every mode always produces them
and `generateCompliant` rejects anything else, so those rows could never change (`GENERATOR_GUARANTEED` in `src/ui/app.ts`).
The checker view still shows rule 2. Rule 8 (history) is never listed in the UI because it cannot be checked
locally at all (`NEVER_SHOWN`); the "How it works" section explains it instead.

Normalized variants: lowercase, Polish diacritics removed, common leetspeak substitutions
(`4→a`, `0→o`, `1→i` or `1→l`, `3→e`, `5→s`, `7→t`, `@→a`, `$→s`, `!→i`, `+→t`),
and the same forms with non-alphanumeric characters stripped.

### Interpretation decisions

The policy text leaves some details open. The choices below are deliberately **stricter** than the literal wording,
so that anything accepted here is also accepted by the target system.

- **Case-insensitive repeat check (rule 3).**
  Pros: no false "OK" if the system compares case-insensitively.
  Cons: the checker may reject passwords the system would accept.
  Long term: if the real implementation turns out to be case-sensitive, change the `iu` flags in `validatePassword` to `u`.
- **Substring and leetspeak matching (rules 4, 5).**
  Mirrors how tools like Microsoft Entra Password Protection evaluate banned passwords.
  Pros: catches `P4ssw0rd` and `Acme2026`.
  Cons: possible false positives for short tokens, hence the 4-character minimum for weak list entries and 3 for blocked terms.
  Long term: the bundled weak list (~120 entries) is a sample; replace it with the official list if one is available.
- **No password history (rule 8).**
  Storing previous passwords, even hashed, in the browser would create a new attack surface for little benefit,
  because every generated password is new anyway.

## Generation modes

Implemented in [`src/lib/generators.ts`](src/lib/generators.ts). All randomness comes from
`crypto.getRandomValues` with rejection sampling (no modulo bias), see [`src/lib/random.ts`](src/lib/random.ts).
`generateCompliant` regenerates until a candidate passes every checkable rule.

**The random mode is the default** and the first tab: random characters carry the most entropy per character
(20 characters ≈ 122 bits). Saved settings from older versions switch to it once (`SETTINGS_VERSION` in
[`src/lib/settings.ts`](src/lib/settings.ts)); a mode chosen afterwards is kept.

Random mode UI, inspired by the generators of Proton Pass, Avast, McAfee and haslomat.pl:
length slider with a number field (8-64), character-set chips (ABC, abc, 123 are locked on because the policy
requires them; #$& is optional), "No similar characters" and a minimum number of special characters.
Under the strength meter a one-line cracking-time estimate is always visible (details in the entropy popover).

Decision: **uppercase, lowercase and digits cannot be switched off**, unlike in the inspiration tools.
Pros: every generated password stays compliant. Cons: less flexibility for systems with other rules.
Long term: if the tool is reused for other policies, unlock the chips and let the checklist show the failing rule,
as already done for lengths below 14.

| Mode | Example | Default entropy |
|------|---------|-----------------|
| `sentence` (en) | `InflatableSquidNightlySniffsCrystalBananaOnMars917&` | ~66 bits |
| `sentence` (pl) | `PieprznyKrokodylDziarskoPrzemycaSlonyKalafiorWBibliotece725?` | ~65 bits |
| `words` (en) | `Marauding-Seclusion-Bouncing-Pegboard-Evacuate-51_` | ~75 bits |
| `words` (pl) | `Radosny-Budka-Wachlarz-Gasi-Uparty-61+` | ~61 bits |
| `slang` | `Budka-Spoczko-Staw-Mulic-Siema-67*` | ~56 bits |
| `random` | `xb#ee$jo%6U#yzEdUp%W` | ~120 bits |

### Password length

- **Random mode:** the length slider (8-64, default 20) sets the exact length.
- **Memorable modes** have two length modes (`lengthMode` in settings):
  - **"From generator"** (default): the length follows from the settings; only the policy minimum (14) applies.
    The UI shows the typical length (10th-90th percentile) and the possible range, computed exactly from the word lists.
  - **"Custom range"**: a dual-handle range slider (8-100). When switched on it starts at the typical range of the
    current settings, so nothing changes until a handle is dragged. The handles cannot cross, so "to" is never below "from".
    The policy minimum is marked on the track. Regeneration runs live while dragging (at most once per frame).
  **All other settings are always respected** (number of words, separators, digits, special characters, sentence parts):
  the range only decides which words are picked ([`src/lib/length-plan.ts`](src/lib/length-plan.ts)).
- Older saved settings migrate automatically: a stored upper limit becomes "Custom range", otherwise "From generator".
- **Below 14 characters** is allowed on purpose (e.g. for other systems), but the UI shows a warning that the policy
  requires 14, and the length rule appears as failed in the checklist (`allowShort` in `generateCompliant`).

How words are picked: a memorable password's length is `Σ weight(word) + overhead`, where
`weight = letters + joinLength × tokens` (joins between words and before the number) and
`overhead = digits + attached special character`. A dynamic program counts word combinations per length;
generation then picks uniformly among only the combinations that fit, and the entropy meter subtracts the exact
`-log2(fitting / all)` bits (popover: "length limit"). Tests check that the model predicts real lengths in every mode.

When **no combination of the current settings fits** (e.g. 5 words in 8-14 characters), nothing is generated and
the result card says why ("With the current settings, passwords have 23 to 53 characters…"). If other settings would fit,
it shows a proposal from `suggestFit` ([`src/lib/fit-length.ts`](src/lib/fit-length.ts)), e.g.
"3 words instead of 5, no separators", with an "Apply" button. Applying it changes the visible controls.

Decision: **slider with an explicit "From generator" option instead of always-on number fields.**
Pros: most users never need a range, and the default shows what the settings produce; the slider makes an invalid
range impossible instead of correcting it afterwards. Cons: a slider is less precise than typing; arrow keys move
a focused handle by one character. Long term: the slider bounds (8-100) live in `LENGTH_LIMITS`.

Decision: **never override settings silently; propose and let the user apply.**
An earlier version adapted settings automatically, which made the visible controls meaningless whenever a range was set.
Pros now: what the controls say is what the generator does; length-aware picking makes narrow ranges work without
rejection sampling, and the entropy loss is exact rather than sampled. Cons: one extra click when the settings cannot fit.
Long term: the length model must be updated if a new option changes password length (the model test will fail if not).

### Language

The sentence and words modes use **English by default**; the "Polish words" checkbox switches them to Polish
(`language` in settings). The slang mode is always Polish, including its ordinary words, so the phrase reads in one language.

- English sentence lists: [`src/data/wordlists-en.ts`](src/data/wordlists-en.ts), written for this project.
- English passphrase list: [EFF Large Wordlist](https://www.eff.org/dice) (7,772 words after dropping 4 hyphenated ones),
  vendored in [`src/data/eff-large-wordlist.ts`](src/data/eff-large-wordlist.ts).
  License: [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/); attribution is shown in the app footer.
- Polish lists: [`src/data/wordlists.ts`](src/data/wordlists.ts).

Decision: **English default with the EFF list for passphrases.**
Pros: ~12.9 bits per word instead of ~10 for the Polish list, so 5 words give ~75 bits instead of ~61;
no diacritics, so passwords type the same on every keyboard layout.
Cons: less memorable for people who think in Polish (hence the checkbox); EFF words can be uncommon (e.g. "seclusion").
Long term: the list is vendored, so it never changes under the app; updating it is a deliberate data change, and the
attribution must stay in the UI because of the CC BY license.

The sentence template is `[ADJ] SUBJECT [ADVERB] VERB [ADJ] OBJECT [PLACE] NUMBER` in both languages.
English skips articles on purpose (headline style: "Grumpy pirate quietly polishes golden teapot on the roof 472").
Polish categories are chosen so that every random combination is grammatical:
masculine animate subjects, masculine inanimate objects (accusative equals nominative),
masculine adjectives and transitive verbs in the 3rd person singular.
Polish letters are transliterated to ASCII in the password (`ż → z`) and kept in the memory hint.

Special characters (memorable modes): `none`, `number` (after the number), `word` (after a random word)
or `separator` (every separator is a random special character). The allowed set is editable in the UI;
the default `!@#$%&*?+=-_.` skips characters that are often dead keys or rejected (`^ ~ \` ' " \` and space).

### Slang mode

Marked in the UI with "Warning: potentially offensive content". Mixes Polish slang terms
(`src/data/slang.ts`, ~190 clean + ~30 vulgar) with ordinary words at random positions and shows a glossary:
each term with a short explanation and a link to its entry in
[Miejski Słownik Slangu](https://www.miejski.pl) (`https://www.miejski.pl/slowo-{Term}`).
Profanity is used only after the explicit "Allow profanity (18+)" opt-in. Slurs and words targeting groups of people are excluded on purpose.

Design decisions:

- **Bundled list with our own explanations, no copying from miejski.pl.**
  Definitions on miejski.pl are user-generated content whose license is not clearly stated,
  so only the terms (common language) are used and each explanation is written from scratch.
  Pros: no copyright risk, works offline, stable. Cons: a smaller vocabulary than the whole dictionary;
  new slang has to be added by hand.
- **No live fetching from miejski.pl.**
  Downloading a random entry at generation time would tell a third party (and any network log) which word
  is in the password, and browsers would block the request anyway (CORS, and the published page's CSP).
  The glossary links are opened only on click; the UI warns that clicking reveals that word to the site.
- **Entropy cost.** The slang list is smaller than the passphrase list (~7.5 vs ~10 bits per word),
  which is why ordinary words are mixed in. Positions of slang words add `log2(C(n, k))` bits.
  Long term: growing `slang.ts` to ~1000 terms would make slang-only passwords as strong as passphrases.

### l33t option

Available in the sentence, words and slang modes ([`src/lib/leet.ts`](src/lib/leet.ts)):
letters are replaced with similar digits (`a→4 e→3 i→1 o→0 s→5 t→7 b→8 g→9`).
The first letter of each word is never replaced, so capitalization stays readable and the uppercase rule holds.
The memory hint shows the replaced digits in bold and keeps Polish letters around them.

| Setting | Example (`zielony`) | Added entropy |
|---------|---------------------|---------------|
| `none` | `zielony` | 0 |
| `one` (one random letter per word) | `zi3lony` | ~1.5-2 bits per word |
| `random` (each eligible letter with 50% chance) | `z13lony` | ~3 bits per word |
| `all` | `z13l0ny` | 0 |

Decision: **full l33t is offered but counted as 0 bits.** Cracking tools (hashcat/John rules) try these
substitutions first, so `all` only changes the look. The UI says so when it is selected.
Pros: honest strength meter. Cons: users may expect `all` to help.
Long term: if the policy ever requires a minimum entropy, only the random settings should count toward it.
The policy checker normalizes l33t back to letters, so `4cm3` is still blocked like `acme`.

Entropy (`entropyBits`) assumes the attacker knows the word lists and settings.
Strength levels are defined in [`src/lib/strength.ts`](src/lib/strength.ts): 45 / 60 / 80 bits.

The "Strength" and "Entropy" labels have explanatory popovers ([`src/ui/strength-popovers.ts`](src/ui/strength-popovers.ts)),
open on hover, keyboard focus or tap:

- **Strength:** what the current level means, the level scale, how many bits are missing to the next level,
  where the bits come from (`entropyParts`, one labelled part per random choice) and the best improvements
  (`suggestImprovements` in [`src/lib/explain.ts`](src/lib/explain.ts): each candidate change is applied to a copy
  of the settings and the entropy gain is measured; allowing profanity is never suggested).
- **Entropy:** what entropy is, the size of the search space and average guessing time for three attack scenarios
  (online ~100/s, bcrypt ~10k/s, NTLM ~100 bn/s; orders of magnitude only).

Decision: **explanations are computed from the same functions as the meter**, not written by hand per level.
Pros: they can never disagree with the number shown and stay correct when lists or options change.
Cons: wording is more generic than hand-written copy. Long term: new options only need a part in `entropyParts`
and a tweak in `TWEAKS` to appear in both popovers.

## Project structure

```
index.html                 Markup (English UI)
src/
  main.ts                  Entry point
  styles.css               Design tokens (light/dark) and layout
  data/
    wordlists.ts           Polish word lists by grammatical role
    wordlists-en.ts        English word lists by grammatical role
    eff-large-wordlist.ts  EFF Large Wordlist (CC BY 3.0 US), English passphrases
    weak-passwords.ts      Weak password sample list
    slang.ts               Slang terms with our own explanations + miejski.pl links
  lib/                     Framework-free logic, fully unit-tested
    policy.ts              Rules and validation
    generators.ts          Generators, word bank, entropy
    explain.ts             Improvement suggestions, cracking-time estimates
    length-plan.ts         Length model and length-aware word picking (dynamic programming)
    fit-length.ts          Proposing settings that fit a length range
    leet.ts                l33t substitutions and their entropy
    random.ts              CSPRNG helpers
    settings.ts            Defaults and localStorage persistence
    strength.ts            Entropy → strength level
    text.ts                Transliteration, plural forms, specials parsing
  ui/
    app.ts                 DOM wiring
    strength-popovers.ts   Popovers explaining strength and entropy
```

## Extending

- **New slang term:** add `{ term, meaning }` to `CLEAN` or `VULGAR` in `src/data/slang.ts`; write the explanation yourself.
- **New word:** add it to the right list in `src/data/wordlists.ts`, respecting the grammatical role in the comment.
  Tests fail on duplicates after transliteration.
- **New rule:** add a `RuleId`, a label in `RULE_LABELS` and the check in `validatePassword`, then a test in `policy.test.ts`.
  The generator picks it up automatically through `generateCompliant`.
- **New mode:** add options to `ModeOptions`, a generator and an entropy function, then wire the controls in `ui/app.ts`.

## Privacy

- Passwords are generated and checked locally; nothing is sent over the network.
- Only settings (mode, options, allowed specials, username, blocked terms) are saved in `localStorage`.
- Clipboard: copying uses the Clipboard API; the clipboard is not cleared automatically.
