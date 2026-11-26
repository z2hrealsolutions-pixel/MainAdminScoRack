// A tenant's two brand colours, turned into the colour settings the apps use, and made readable.
// Pure, so it can be tested. The same file is used by the live and referee app and by the admin preview.
//
// The tenant picks any colour. Text and buttons must stay readable, so the colour that is actually used is
// moved lighter or darker until it passes the contrast bar against the surfaces it sits on:
//   3:1  for fills and borders (large or graphic parts)
//   4.5:1 for small text, and for the text on a filled button
// The page surfaces themselves never change, so nothing a tenant picks can make the page unreadable.

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHex(value) {
  return typeof value === 'string' && HEX.test(value.trim());
}

export function normalizeHex(value) {
  return isHex(value) ? value.trim().toLowerCase() : null;
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex2 = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
export const toHex = ([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

export function luminance(hex) {
  const c = rgb(hex).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// t = 0 is a, t = 1 is b
export function mix(a, b, t) {
  const x = rgb(a);
  const y = rgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

export const rgba = (hex, alpha) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// the colour moved toward white ('lighten') or black ('darken') until it reaches `min` against every surface
export function ensureContrast(hex, surfaces, min, direction) {
  const target = direction === 'lighten' ? '#ffffff' : '#000000';
  const worst = (c) => Math.min(...surfaces.map((s) => contrast(c, s)));
  if (worst(hex) >= min) return hex;
  for (let step = 1; step <= 50; step += 1) {
    const c = mix(hex, target, step / 50);
    if (worst(c) >= min) return c;
  }
  return target;
}

// the surfaces of each theme: these are the ones in tokens.css, and they stay as they are
export const SURFACES = {
  dark: {
    page: '#132030',
    base: ['#172431', '#20313f', '#283c4d', '#263a4b', '#2a3e50', '#223445'],
    dark: true,
  },
  light: {
    page: '#e9f1f6',
    base: ['#f2f6f9', '#ffffff', '#f5f8fa', '#e9f1f6', '#f4f9fc'],
    dark: false,
  },
};

const DARK_TEXT = '#0b1218';
const LIGHT_TEXT = '#ffffff';

// the text colour that sits on a fill, and the fill's lighter or darker hover shade
function fillWithText(fill) {
  const onDark = contrast(DARK_TEXT, fill) >= contrast(LIGHT_TEXT, fill);
  const on = onDark ? DARK_TEXT : LIGHT_TEXT;
  // the hover shade moves away from the text colour, so the text only gets easier to read
  const strong = mix(fill, onDark ? '#ffffff' : '#000000', 0.15);
  return { on, strong };
}

function themeVars(theme, primary, accent) {
  const s = SURFACES[theme];
  const dir = s.dark ? 'lighten' : 'darken';
  const vars = {};

  if (primary) {
    const lamp = ensureContrast(primary, s.base, 3, dir);
    const { on, strong } = fillWithText(lamp);
    const text = ensureContrast(primary, s.base, 4.5, dir);
    vars['--lamp'] = lamp;
    vars['--lamp-strong'] = strong;
    vars['--lamp-dim'] = s.dark ? mix(lamp, '#000000', 0.12) : mix(lamp, '#ffffff', 0.5);
    vars['--lamp-text'] = text;
    vars['--lamp-small'] = text;
    vars['--lamp-score'] = lamp;
    vars['--on-lamp'] = on;
    vars['--page-glow-a'] = rgba(lamp, s.dark ? 0.3 : 0.2);
    vars['--live-bg'] = `linear-gradient(160deg, ${rgba(lamp, s.dark ? 0.17 : 0.15)}, ${rgba(lamp, s.dark ? 0.05 : 0.04)})`;
    vars['--live-line'] = rgba(strong, s.dark ? 0.6 : 0.55);
    vars['--live-glow'] = `0 10px ${s.dark ? 34 : 30}px ${rgba(lamp, s.dark ? 0.22 : 0.16)}`;
    vars['--win-tint'] = rgba(lamp, s.dark ? 0.1 : 0.16);
  }

  if (accent) {
    const fill = ensureContrast(accent, s.base, 3, dir);
    const text = ensureContrast(accent, s.base, 4.5, dir);
    const { on } = fillWithText(fill);
    vars['--brand-accent'] = fill;
    vars['--brand-accent-text'] = text;
    vars['--on-brand-accent'] = on;
    vars['--page-glow-b'] = rgba(fill, s.dark ? 0.16 : 0.13);
  }
  return vars;
}

// { dark: {--var: value}, light: {...} }. Empty objects when there is no colour to apply.
export function deriveBrand({ primary, accent } = {}) {
  const p = normalizeHex(primary);
  const a = normalizeHex(accent);
  return { dark: themeVars('dark', p, a), light: themeVars('light', p, a) };
}

const decl = (vars) => Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join(' ');

// the style sheet text that applies a tenant's colours to the whole page, in both themes. '' when there are none.
export function brandCss(colors) {
  const { dark, light } = deriveBrand(colors);
  const out = [];
  if (Object.keys(dark).length) out.push(`:root, :root[data-theme='dark'], .force-dark { ${decl(dark)} }`);
  if (Object.keys(light).length) out.push(`:root[data-theme='light'] { ${decl(light)} }`);
  return out.join('\n');
}

// the settings for one theme as an object, to put on one element (the admin preview)
export function brandVars(colors, theme) {
  return deriveBrand(colors)[theme === 'light' ? 'light' : 'dark'];
}
