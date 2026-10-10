import assert from 'assert';
import { getSubjectColor, shortenSubject } from '../public/js/subject_normalizer.js';
import { getSubjectThemeClass } from '../public/js/timeline.js';

console.log('--- Test Subject Normalization & Theming ---');

// Test colori e classi tema
assert.strictEqual(getSubjectThemeClass('INFORMATICA LAB.'), 'theme-informatica');
assert.strictEqual(getSubjectThemeClass('SISTEMI E RETI'), 'theme-sistemi');
assert.strictEqual(getSubjectThemeClass('MATEMATICA'), 'theme-matematica');
assert.strictEqual(getSubjectThemeClass('TPSIT LAB.'), 'theme-tpsit');
assert.strictEqual(getSubjectThemeClass('TELECOMUNICAZIONI LAB.'), 'theme-telecom');
assert.strictEqual(getSubjectThemeClass('STORIA'), 'theme-storia');
assert.strictEqual(getSubjectThemeClass('ITALIANO'), 'theme-lettere');
assert.strictEqual(getSubjectThemeClass('RELIGIONE'), 'theme-religione');

console.log('✓ Temi materie corretti');

// Test colori
const infColor = getSubjectColor('INFORMATICA LAB.');
assert.ok(infColor && infColor.bg);
assert.strictEqual(infColor.name, 'Blu Indigo');

const sisColor = getSubjectColor('SISTEMI E RETI');
assert.ok(sisColor && sisColor.bg);
assert.strictEqual(sisColor.name, 'Blu Acciaio');

console.log('✓ Palette colori fedele e verificata');

// Test matching radice materia (es. INFORMATICA vs INFORMATICA LAB.)
function normalizeSubjectKey(name) {
  if (!name) return '';
  return name.trim().toUpperCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ');
}

function isSameSubject(subA, subB) {
  if (!subA || !subB) return false;
  const kA = normalizeSubjectKey(subA);
  const kB = normalizeSubjectKey(subB);
  if (kA === kB) return true;
  const cleanA = kA.replace(/\s+LAB$/i, '').trim();
  const cleanB = kB.replace(/\s+LAB$/i, '').trim();
  return cleanA === cleanB;
}

assert.strictEqual(isSameSubject('INFORMATICA', 'INFORMATICA LAB.'), true);
assert.strictEqual(isSameSubject('SISTEMI E RETI', 'SISTEMI E RETI LAB.'), true);
assert.strictEqual(isSameSubject('MATEMATICA', 'ITALIANO'), false);
assert.strictEqual(isSameSubject('TPSIT', 'TPSIT LAB.'), true);
assert.strictEqual(isSameSubject('TELECOMUNICAZIONI', 'TELECOMUNICAZIONI LAB.'), true);

console.log('✓ Corrispondenza e raggruppamento teoria/lab superato');
console.log('Tutti i test del filtro materia sono passati con successo!');
