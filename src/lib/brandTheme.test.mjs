import assert from 'node:assert/strict';
import { isHex, normalizeHex, contrast, mix, ensureContrast, deriveBrand, brandCss, brandVars, SURFACES } from './brandTheme.js';

// hex handling
assert.ok(isHex('#1A7F5A') && !isHex('1a7f5a') && !isHex('#12345') && !isHex('red') && !isHex(null));
assert.equal(normalizeHex(' #1A7F5A '), '#1a7f5a');
assert.equal(normalizeHex('nope'), null);
assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
assert.ok(Math.abs(contrast('#000000', '#ffffff') - 21) < 0.01);

// nothing chosen, nothing changed
assert.deepEqual(deriveBrand({}), { dark: {}, light: {} });
assert.equal(brandCss({}), '');
assert.equal(brandCss({ primary: 'bad' }), '');

// a colour that is already fine is kept exactly
assert.equal(ensureContrast('#ffffff', ['#172431'], 4.5, 'lighten'), '#ffffff');

// every kind of colour a tenant might pick stays readable in both themes
const picks = ['#ffffff', '#000000', '#ffff00', '#f5b301', '#ffd1dc', '#e0e0e0', '#808080', '#0b1a3a', '#001f3f', '#d00000', '#1a7f5a', '#7b2cbf', '#0097b2', '#00ff00', '#ff00ff', '#123456'];
for (const p of picks) {
  for (const a of picks) {
    const b = deriveBrand({ primary: p, accent: a });
    for (const theme of ['dark', 'light']) {
      const v = b[theme];
      const surfaces = SURFACES[theme].base;
      for (const s of surfaces) {
        assert.ok(contrast(v['--lamp-text'], s) >= 4.5, `${p} small text on ${s} in ${theme}: ${contrast(v['--lamp-text'], s).toFixed(2)}`);
        assert.ok(contrast(v['--lamp'], s) >= 3, `${p} fill on ${s} in ${theme}: ${contrast(v['--lamp'], s).toFixed(2)}`);
        assert.ok(contrast(v['--brand-accent-text'], s) >= 4.5, `${a} accent text on ${s} in ${theme}`);
        assert.ok(contrast(v['--brand-accent'], s) >= 3, `${a} accent fill on ${s} in ${theme}`);
      }
      assert.ok(contrast(v['--on-lamp'], v['--lamp']) >= 4.5, `${p} button text in ${theme}: ${contrast(v['--on-lamp'], v['--lamp']).toFixed(2)}`);
      assert.ok(contrast(v['--on-lamp'], v['--lamp-strong']) >= 4.5, `${p} button text on hover in ${theme}`);
      assert.ok(contrast(v['--on-brand-accent'], v['--brand-accent']) >= 4.5, `${a} text on accent in ${theme}`);
    }
  }
}

// only the primary: the accent settings are left alone, and the other way round
const onlyP = deriveBrand({ primary: '#1a7f5a' });
assert.ok(onlyP.dark['--lamp'] && !onlyP.dark['--brand-accent'] && !onlyP.dark['--page-glow-b']);
const onlyA = deriveBrand({ accent: '#f5b301' });
assert.ok(onlyA.dark['--brand-accent'] && !onlyA.dark['--lamp']);

// the style sheet: one rule per theme, and only colours go into it
const css = brandCss({ primary: '#1a7f5a', accent: '#f5b301' });
assert.match(css, /:root\[data-theme='dark'\]/);
assert.match(css, /:root\[data-theme='light'\] \{/);
assert.ok(!/[<>{}]\s*[<>]/.test(css) && !css.includes('url('));
assert.deepEqual(Object.keys(brandVars({ primary: '#1a7f5a' }, 'light')).filter((k) => !k.startsWith('--')), []);
assert.notEqual(brandVars({ primary: '#ffff00' }, 'dark')['--lamp-text'], brandVars({ primary: '#ffff00' }, 'light')['--lamp-text']);

console.log('brandTheme tests passed');
