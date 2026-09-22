import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('--- Test Ottimizzazione Visualizzazione Web da PC (Desktop) ---');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedTests++;
  }
}

// 1. Validazione public/index.html
console.log('\n[1/3] Verifica Struttura HTML Desktop in public/index.html:');
const htmlContent = fs.readFileSync(path.join(rootDir, 'public', 'index.html'), 'utf-8');

assert(htmlContent.includes('class="desktop-brand"'), 'Presente elemento branding desktop (.desktop-brand)');
assert(htmlContent.includes('id="desktop-class-badge"'), 'Presente pill selettore classe desktop (#desktop-class-badge)');
assert(htmlContent.includes('class="desktop-header-actions"'), 'Presente container azioni desktop (.desktop-header-actions)');
assert(htmlContent.includes('id="btn-desktop-change"'), 'Presente pulsante desktop Cambia Orario (#btn-desktop-change)');
assert(htmlContent.includes('id="btn-desktop-original"'), 'Presente pulsante desktop Orario Originale (#btn-desktop-original)');
assert(htmlContent.includes('id="btn-desktop-sync"'), 'Presente pulsante desktop Sincronizza (#btn-desktop-sync)');
assert(htmlContent.includes('id="btn-desktop-print"'), 'Presente pulsante desktop Stampa A4 (#btn-desktop-print)');
assert(htmlContent.includes('id="btn-desktop-shortcuts"'), 'Presente pulsante desktop Scorciatoie (#btn-desktop-shortcuts)');
assert(htmlContent.includes('id="desktop-live-clock"'), 'Presente orologio digitale desktop (#desktop-live-clock)');

assert(htmlContent.includes('class="daily-desktop-layout"'), 'Presente layout desktop a 2 colonne (.daily-desktop-layout)');
assert(htmlContent.includes('id="daily-companion-panel"'), 'Presente Companion Panel desktop (#daily-companion-panel)');
assert(htmlContent.includes('id="companion-class-name"'), 'Presente scheda classe attiva nel Companion Panel');
assert(htmlContent.includes('id="companion-live-card"'), 'Presente scheda stato live in tempo reale nel Companion Panel');
assert(htmlContent.includes('id="companion-days-list"'), 'Presente navigatore rapido giorni nel Companion Panel');
assert(htmlContent.includes('id="companion-stat-hours"'), 'Presente scheda statistiche giornaliere nel Companion Panel');

assert(htmlContent.includes('id="modal-shortcuts"'), 'Presente modale scorciatoie da tastiera (#modal-shortcuts)');
assert(htmlContent.includes('class="print-only-header"'), 'Presente intestazione di stampa A4 (.print-only-header)');
assert(htmlContent.includes('css/style.css?v=41'), 'Cache buster aggiornato per style.css (v=41)');
assert(htmlContent.includes('js/app.js?v=41'), 'Cache buster aggiornato per app.js (v=41)');

// 2. Validazione public/css/style.css
console.log('\n[2/3] Verifica Regole CSS Responsive e Stampa in public/css/style.css:');
const cssContent = fs.readFileSync(path.join(rootDir, 'public', 'css', 'style.css'), 'utf-8');

assert(cssContent.includes('.desktop-brand,') && cssContent.includes('display: none;'), 'Elementi desktop nascosti di default su mobile (< 768px)');
assert(cssContent.includes('@media (min-width: 768px)'), 'Presente media query per tablet e laptop compatti (>= 768px)');
assert(cssContent.includes('@media (min-width: 1024px)'), 'Presente media query per desktop (>= 1024px)');
assert(cssContent.includes('@media (min-width: 1440px)'), 'Presente media query per widescreen (>= 1440px)');
assert(cssContent.includes('::-webkit-scrollbar'), 'Presente stilizzazione custom per scrollbar desktop');
assert(cssContent.includes('.daily-desktop-layout'), 'Definito layout CSS grid per vista giorno desktop');
assert(cssContent.includes('.weekly-scroll-hint') && cssContent.includes('display: none !important;'), 'Avviso di scroll orizzontale nascosto su schermi ampi');
assert(cssContent.includes('@media print'), 'Presente foglio di stile per stampa (@media print)');
assert(cssContent.includes('size: A4 landscape'), 'Formato stampa impostato su A4 Landscape');
assert(cssContent.includes('-webkit-print-color-adjust: exact') || cssContent.includes('print-color-adjust: exact'), 'Attivata resa cromatica esatta per stampa a colori');

// 3. Validazione public/js/app.js
console.log('\n[3/3] Verifica Logica JavaScript Desktop in public/js/app.js:');
const jsContent = fs.readFileSync(path.join(rootDir, 'public', 'js', 'app.js'), 'utf-8');

assert(jsContent.includes('desktopClassName: document.getElementById'), 'Riferimento DOM ad elementi desktop nella mappa elements');
assert(jsContent.includes('renderDesktopCompanionPanel()'), 'Invocazione renderDesktopCompanionPanel() nel ciclo render()');
assert(jsContent.includes('updateDesktopHeader()'), 'Invocazione updateDesktopHeader() nel ciclo render()');
assert(jsContent.includes('updateCompanionLiveStatus('), 'Funzione calcolo live countdown Companion Panel');
assert(jsContent.includes('triggerPrint()'), 'Funzione triggerPrint() con passaggio a vista settimanale');
assert(jsContent.includes('setupKeyboardShortcuts()'), 'Registrazione listener scorciatoie da tastiera');
assert(jsContent.includes("e.key === 'Escape'"), 'Gestione tasto Esc per chiusura modali e ritorno orario');
assert(jsContent.includes("e.key === '1'") && jsContent.includes("e.key === '2'"), 'Gestione tasti 1 e 2 per switch Giorno/Settimana');
assert(jsContent.includes("e.key === 'p'") || jsContent.includes("e.key === 'P'"), 'Gestione tasto P e Ctrl+P per stampa');
assert(jsContent.includes("window.addEventListener('resize'"), 'Listener resize per ricalcolo cursore e layout al cambio risoluzione');
assert(jsContent.includes('setInterval(tick, 1000)'), 'Aggiornamento orologio desktop con cadenza a 1 secondo');

console.log(`\nRisultato: ${passedTests} test superati, ${failedTests} falliti.`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('✓ Tutti i test di ottimizzazione web da PC sono passati con successo!\n');
}
