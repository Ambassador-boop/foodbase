/**
 * WCAG 2.2 contrast gate for the FoodBase design system.
 *
 *   pnpm check:contrast
 *
 * Reads the real token values out of styles/globals.css (it does not keep a
 * second copy of the palette, so the check can never drift from the product),
 * resolves every var() chain for both themes, computes the WCAG relative
 * luminance contrast ratio of each pair below, prints a table and exits
 * non-zero if any pair misses its threshold.
 *
 * Thresholds: 4.5:1 for text, 3:1 for icons, control borders and focus rings
 * (WCAG 1.4.3 and 1.4.11).
 *
 * Plain Node, no dependencies, no build step. Run directly with
 * `node --experimental-strip-types scripts/check-contrast.ts`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = resolve(HERE, '..', 'styles', 'globals.css');

/* ------------------------------------------------------------------ colour */

type RGB = { r: number; g: number; b: number };

function parseHex(value: string): RGB | null {
  const hex = value.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance({ r, g, b }: RGB): number {
  return (
    0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
  );
}

function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/* -------------------------------------------------------------------- parse */

type TokenMap = Map<string, string>;

/** Strips comments so a commented-out declaration is never read as a value. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Collects the `--name: value` declarations inside every block whose selector
 * list matches `selectorTest`. Later blocks win, which mirrors the cascade for
 * the simple, non-nested blocks used here.
 */
function collect(css: string, selectorTest: (selector: string) => boolean): TokenMap {
  const map: TokenMap = new Map();
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(css))) {
    // A block's captured prefix can still carry the statements that preceded
    // it (`@import ...;`), so only the final segment is the real selector.
    const raw = block[1];
    const selector = raw
      .slice(raw.lastIndexOf(';') + 1)
      .trim()
      .replace(/\s+/g, ' ');
    if (!selectorTest(selector)) continue;
    const body = block[2];
    const declRe = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
    let decl: RegExpExecArray | null;
    while ((decl = declRe.exec(body))) {
      map.set(decl[1], decl[2].trim());
    }
  }
  return map;
}

function resolveToken(tokens: TokenMap, name: string, depth = 0): string | null {
  if (depth > 12) return null;
  const raw = tokens.get(name);
  if (!raw) return null;
  const varRe = /var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*([^)]+))?\)/;
  const match = varRe.exec(raw);
  if (!match) return raw;
  const inner = resolveToken(tokens, match[1], depth + 1);
  if (inner) return inner;
  return match[2] ? match[2].trim() : null;
}

function colourOf(tokens: TokenMap, name: string): RGB {
  const value = resolveToken(tokens, name);
  if (!value) {
    throw new Error(`Token ${name} is not declared in styles/globals.css`);
  }
  const rgb = parseHex(value);
  if (!rgb) {
    throw new Error(`Token ${name} resolves to "${value}", which is not a hex colour`);
  }
  return rgb;
}

/* -------------------------------------------------------------------- pairs */

type Pair = {
  /** Label shown in the table. */
  label: string;
  fg: string;
  bg: string;
  /** 4.5 for text, 3 for icons, control borders and focus rings. */
  min: 4.5 | 3;
  kind: 'text' | 'icon' | 'border';
};

const TEXT = 4.5 as const;
const NON_TEXT = 3 as const;

/** Pairs that must hold in the light theme. */
const LIGHT: Pair[] = [
  { label: 'Body text on page', fg: '--ink', bg: '--paper', min: TEXT, kind: 'text' },
  { label: 'Body text on card', fg: '--ink', bg: '--surface', min: TEXT, kind: 'text' },
  { label: 'Muted text on page', fg: '--ink-muted', bg: '--paper', min: TEXT, kind: 'text' },
  { label: 'Muted text on card', fg: '--ink-muted', bg: '--surface', min: TEXT, kind: 'text' },
  { label: 'Muted text on muted fill', fg: '--ink-muted', bg: '--muted', min: TEXT, kind: 'text' },
  { label: 'Primary button label', fg: '--primary-foreground', bg: '--primary', min: TEXT, kind: 'text' },
  { label: 'Secondary button label', fg: '--secondary-foreground', bg: '--secondary', min: TEXT, kind: 'text' },
  { label: 'Accent label', fg: '--accent-foreground', bg: '--accent', min: TEXT, kind: 'text' },
  { label: 'Destructive button label', fg: '--destructive-foreground', bg: '--destructive', min: TEXT, kind: 'text' },
  { label: 'Link on page', fg: '--link', bg: '--paper', min: TEXT, kind: 'text' },
  { label: 'Link on card', fg: '--link', bg: '--surface', min: TEXT, kind: 'text' },
  { label: 'Link on cream', fg: '--color-brand-700', bg: '--color-brand-100', min: TEXT, kind: 'text' },
  { label: 'Success word on soft', fg: '--success', bg: '--success-soft', min: TEXT, kind: 'text' },
  { label: 'Success word on card', fg: '--success', bg: '--surface', min: TEXT, kind: 'text' },
  { label: 'Warning word on soft', fg: '--warning', bg: '--warning-soft', min: TEXT, kind: 'text' },
  { label: 'Warning word on card', fg: '--warning', bg: '--surface', min: TEXT, kind: 'text' },
  { label: 'Danger word on soft', fg: '--danger', bg: '--danger-soft', min: TEXT, kind: 'text' },
  { label: 'Danger word on card', fg: '--danger', bg: '--surface', min: TEXT, kind: 'text' },
  { label: 'Info word on soft', fg: '--info', bg: '--info-soft', min: TEXT, kind: 'text' },
  { label: 'Neutral word on soft', fg: '--neutral', bg: '--neutral-soft', min: TEXT, kind: 'text' },
  { label: 'Settled word on soft', fg: '--settle', bg: '--settle-bg', min: TEXT, kind: 'text' },
  { label: 'Control border on page', fg: '--line-strong', bg: '--paper', min: NON_TEXT, kind: 'border' },
  { label: 'Control border on card', fg: '--line-strong', bg: '--surface', min: NON_TEXT, kind: 'border' },
  { label: 'Control border on muted', fg: '--line-strong', bg: '--muted', min: NON_TEXT, kind: 'border' },
  { label: 'Focus ring on page', fg: '--focus-ring', bg: '--paper', min: NON_TEXT, kind: 'border' },
  { label: 'Focus ring on card', fg: '--focus-ring', bg: '--surface', min: NON_TEXT, kind: 'border' },
  { label: 'Focus ring on cream', fg: '--focus-ring', bg: '--color-brand-100', min: NON_TEXT, kind: 'border' },
  { label: 'Icon on page', fg: '--ink-muted', bg: '--paper', min: NON_TEXT, kind: 'icon' },
  { label: 'Icon on primary button', fg: '--primary-foreground', bg: '--primary', min: NON_TEXT, kind: 'icon' },
  { label: 'Primary fill on page', fg: '--primary', bg: '--paper', min: NON_TEXT, kind: 'border' },
];

/** Pairs that must hold in the dark theme. */
const DARK: Pair[] = [
  { label: 'Body text on page', fg: '--ink', bg: '--paper', min: TEXT, kind: 'text' },
  { label: 'Body text on card', fg: '--ink', bg: '--surface', min: TEXT, kind: 'text' },
  { label: 'Muted text on page', fg: '--ink-muted', bg: '--paper', min: TEXT, kind: 'text' },
  { label: 'Muted text on card', fg: '--ink-muted', bg: '--surface', min: TEXT, kind: 'text' },
  { label: 'Muted text on muted fill', fg: '--ink-muted', bg: '--muted', min: TEXT, kind: 'text' },
  { label: 'Primary button label', fg: '--primary-foreground', bg: '--primary', min: TEXT, kind: 'text' },
  { label: 'Secondary button label', fg: '--secondary-foreground', bg: '--secondary', min: TEXT, kind: 'text' },
  { label: 'Accent label', fg: '--accent-foreground', bg: '--accent', min: TEXT, kind: 'text' },
  { label: 'Destructive button label', fg: '--destructive-foreground', bg: '--destructive', min: TEXT, kind: 'text' },
  { label: 'Link on page', fg: '--link', bg: '--paper', min: TEXT, kind: 'text' },
  { label: 'Link on card', fg: '--link', bg: '--surface', min: TEXT, kind: 'text' },
  { label: 'Link on muted fill', fg: '--link', bg: '--muted', min: TEXT, kind: 'text' },
  { label: 'Success word on soft', fg: '--success', bg: '--success-soft', min: TEXT, kind: 'text' },
  { label: 'Success word on card', fg: '--success', bg: '--surface', min: TEXT, kind: 'text' },
  { label: 'Warning word on soft', fg: '--warning', bg: '--warning-soft', min: TEXT, kind: 'text' },
  { label: 'Warning word on card', fg: '--warning', bg: '--surface', min: TEXT, kind: 'text' },
  { label: 'Danger word on soft', fg: '--danger', bg: '--danger-soft', min: TEXT, kind: 'text' },
  { label: 'Danger word on card', fg: '--danger', bg: '--surface', min: TEXT, kind: 'text' },
  { label: 'Info word on soft', fg: '--info', bg: '--info-soft', min: TEXT, kind: 'text' },
  { label: 'Neutral word on soft', fg: '--neutral', bg: '--neutral-soft', min: TEXT, kind: 'text' },
  { label: 'Settled word on soft', fg: '--settle', bg: '--settle-bg', min: TEXT, kind: 'text' },
  { label: 'Control border on page', fg: '--line-strong', bg: '--paper', min: NON_TEXT, kind: 'border' },
  { label: 'Control border on card', fg: '--line-strong', bg: '--surface', min: NON_TEXT, kind: 'border' },
  { label: 'Control border on muted', fg: '--line-strong', bg: '--muted', min: NON_TEXT, kind: 'border' },
  { label: 'Focus ring on page', fg: '--focus-ring', bg: '--paper', min: NON_TEXT, kind: 'border' },
  { label: 'Focus ring on card', fg: '--focus-ring', bg: '--surface', min: NON_TEXT, kind: 'border' },
  { label: 'Icon on page', fg: '--ink-muted', bg: '--paper', min: NON_TEXT, kind: 'icon' },
  { label: 'Icon on primary button', fg: '--primary-foreground', bg: '--primary', min: NON_TEXT, kind: 'icon' },
  { label: 'Primary fill on page', fg: '--primary', bg: '--paper', min: NON_TEXT, kind: 'border' },
];

/* --------------------------------------------------------------------- main */

function isRoot(selector: string): boolean {
  return selector.split(',').some((s) => s.trim() === ':root');
}

function isThemeBlock(selector: string): boolean {
  return selector.split(',').some((s) => {
    const t = s.trim();
    return t === '.dark' || t === "[data-theme='dark']" || t === '[data-theme="dark"]';
  });
}

function isThemeAtRule(selector: string): boolean {
  return selector.trim() === '@theme';
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function padStart(value: string, width: number): string {
  return value.length >= width ? value : ' '.repeat(width - value.length) + value;
}

function main(): void {
  const css = stripComments(readFileSync(CSS_PATH, 'utf8'));

  const palette = collect(css, isThemeAtRule);
  const root = collect(css, isRoot);
  const dark = collect(css, isThemeBlock);

  // The cascade for a light screen: palette, then :root.
  const lightTokens: TokenMap = new Map([...palette, ...root]);
  // A dark screen gets the palette, then :root, then the dark overrides.
  const darkTokens: TokenMap = new Map([...palette, ...root, ...dark]);

  const themes: Array<[string, TokenMap, Pair[]]> = [
    ['Light', lightTokens, LIGHT],
    ['Dark', darkTokens, DARK],
  ];

  const failures: string[] = [];
  let checked = 0;

  for (const [themeName, tokens, pairs] of themes) {
    console.log(`\n${themeName} theme`);
    console.log(
      `${pad('Pair', 34)}${pad('Kind', 8)}${padStart('Ratio', 8)}${padStart('Min', 6)}  Result`,
    );
    console.log('-'.repeat(72));

    for (const pair of pairs) {
      const ratio = contrast(colourOf(tokens, pair.fg), colourOf(tokens, pair.bg));
      const pass = ratio >= pair.min;
      checked += 1;
      if (!pass) {
        failures.push(
          `${themeName}: ${pair.label} is ${ratio.toFixed(2)}:1, needs ${pair.min}:1 ` +
            `(${pair.fg} on ${pair.bg})`,
        );
      }
      console.log(
        `${pad(pair.label, 34)}${pad(pair.kind, 8)}${padStart(ratio.toFixed(2) + ':1', 8)}` +
          `${padStart(pair.min.toFixed(1), 6)}  ${pass ? 'pass' : 'FAIL'}`,
      );
    }
  }

  console.log(`\n${checked} pairs checked.`);

  if (failures.length > 0) {
    console.error(`\n${failures.length} pair(s) below the WCAG 2.2 AA threshold:\n`);
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error('\nAdjust the token in styles/globals.css by the smallest amount that passes.');
    process.exit(1);
  }

  console.log('All pairs meet WCAG 2.2 AA (4.5:1 text, 3:1 icons, borders and focus rings).');
}

main();
