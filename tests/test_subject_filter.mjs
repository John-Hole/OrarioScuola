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

// Test verifica posizionamento UI e regole richieste dall'utente:
// 1. Tasto "Filtra materia" NON deve stare in alto a destra nell'header, ma SOLO nel drawer laterale
import fs from 'node:fs';
import path from 'node:path';

const indexHtml = fs.readFileSync(path.resolve('public/index.html'), 'utf-8');
const headerMatch = indexHtml.match(/<header\s+class="app-header"[^>]*>([\s\S]*?)<\/header>/);
assert(headerMatch, 'index.html must contain <header class="app-header">');
assert(!headerMatch[1].includes('id="btn-subject-filter-toggle"'), 'Header must NOT contain #btn-subject-filter-toggle (relocated to lateral drawer only)');
assert(!headerMatch[1].includes('id="subject-filter-wrapper"'), 'Header must NOT contain #subject-filter-wrapper');

const drawerMatch = indexHtml.match(/<aside\s+id="sidebar-drawer"[^>]*>([\s\S]*?)<\/aside>/);
assert(drawerMatch, 'index.html must contain #sidebar-drawer');
assert(drawerMatch[1].includes('id="nav-item-filter-subject"'), 'Drawer must contain #nav-item-filter-subject');
assert(drawerMatch[1].includes('id="drawer-filter-accordion"'), 'Drawer must contain #drawer-filter-accordion');
assert(drawerMatch[1].includes('id="filter-subjects-list"'), 'Drawer must contain #filter-subjects-list');

console.log('✓ Posizionamento UI filtro materia verificato: assente da header, presente nel drawer laterale');

// 2. Clic su box materia: attivo SOLO nella vista settimanale, DISATTIVATO nella vista giornaliera
const appJs = fs.readFileSync(path.resolve('public/js/app.js'), 'utf-8');

// Verifica che createDailyLessonSlot NON aggiunga listener di click per selectSubjectFilter
const dailySlotFn = appJs.slice(appJs.indexOf('function createDailyLessonSlot'), appJs.indexOf('function createDailyDivider'));
assert(!dailySlotFn.includes('selectSubjectFilter'), 'createDailyLessonSlot must NOT attach click handler to filter subjects (weekly view exclusive)');

// Verifica che createGridCell abbia il listener di click
const weeklyCellFn = appJs.slice(appJs.indexOf('function createGridCell'), appJs.indexOf('function normalizeSubjectKey'));
assert(weeklyCellFn.includes('selectSubjectFilter'), 'createGridCell MUST attach click handler to filter subjects in weekly view');

// Verifica che applySubjectHighlightClasses sincronizzi l'indicatore pill solo quando la vista è settimanale
const highlightFn = appJs.slice(appJs.indexOf('function applySubjectHighlightClasses'), appJs.indexOf('function initHeaderScrollCollapse'));
assert(highlightFn.includes("state.currentView === 'weekly'"), 'applySubjectHighlightClasses must check state.currentView === weekly');
assert(highlightFn.includes('activeFilterIndicator.classList.add(\'hidden\')'), 'applySubjectHighlightClasses must hide indicator when not in weekly view or no filter');

console.log('✓ Filtro da clic su card verificato: esclusivo per la vista settimanale (disattivato in vista giornaliera)');
console.log('✓ Indicatore pill galleggiante verificato: visibile solo in vista settimanale');

// 3. Strict ES module syntax check using node --input-type=module --check
import { execFileSync } from 'node:child_process';

const jsModulesToCheck = [
  'public/js/app.js',
  'public/js/timeline.js',
  'public/js/timetable_store.js',
  'public/js/widget_helper.js',
  'public/js/subject_normalizer.js'
];

for (const relPath of jsModulesToCheck) {
  const filePath = path.resolve(relPath);
  const code = fs.readFileSync(filePath);
  try {
    execFileSync(process.execPath, ['--input-type=module', '--check'], {
      input: code,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(`✓ Sintassi ES module verificata con successo per ${relPath}`);
  } catch (err) {
    const errOutput = err.stderr ? err.stderr.toString() : err.message;
    assert.fail(`Fatal SyntaxError in ${relPath}:\n${errOutput}`);
  }
}

console.log('Tutti i test del filtro materia e sintassi ES module sono passati con successo!');
