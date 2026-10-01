import assert from 'node:assert';
import { getSmartDefaultDay } from '../public/js/timeline.js';

const mockDays = [
  { giorno: 'Lunedì', lezioni: [{ inizio: '08:00', fine: '11:42' }] },
  { giorno: 'Martedì', lezioni: [{ inizio: '08:00', fine: '11:42' }] },
  { giorno: 'Mercoledì', lezioni: [{ inizio: '08:00', fine: '11:42' }] },
  { giorno: 'Giovedì', lezioni: [{ inizio: '08:00', fine: '11:42' }] },
  { giorno: 'Venerdì', lezioni: [{ inizio: '08:00', fine: '11:42' }] },
];

console.log('--- Test getSmartDefaultDay logic ---');

// 1. Mercoledì alle 08:00 (mattina prima/durante lezione)
const wedMorning = new Date('2026-09-16T08:00:00'); // 16 Settembre 2026 è Mercoledì
assert.strictEqual(getSmartDefaultDay(mockDays, wedMorning), 'Mercoledì', 'Mercoledì mattina deve mostrare Mercoledì');

// 2. Mercoledì alle 12:30 (subito dopo termine lezioni)
const wedPostSchool = new Date('2026-09-16T12:30:00');
assert.strictEqual(getSmartDefaultDay(mockDays, wedPostSchool), 'Mercoledì', 'Mercoledì post-lezioni deve mostrare Mercoledì');

// 3. Mercoledì alle 16:00 (4 di pomeriggio richiesto dall\'utente)
const wedAfternoon = new Date('2026-09-16T16:00:00');
assert.strictEqual(getSmartDefaultDay(mockDays, wedAfternoon), 'Mercoledì', 'Mercoledì ore 16:00 deve mostrare Mercoledì');

// 4. Mercoledì alle 23:59:59 (fino all\'ultimo secondo del giorno)
const wedLateNight = new Date('2026-09-16T23:59:59');
assert.strictEqual(getSmartDefaultDay(mockDays, wedLateNight), 'Mercoledì', 'Mercoledì ore 23:59 deve mostrare ancora Mercoledì');

// 5. Giovedì alle 00:00:01 (scatto a mezzanotte)
const thuMidnight = new Date('2026-09-17T00:00:01');
assert.strictEqual(getSmartDefaultDay(mockDays, thuMidnight), 'Giovedì', 'Giovedì dopo mezzanotte deve mostrare Giovedì');

// 6. Venerdì pomeriggio alle 16:30
const friAfternoon = new Date('2026-09-18T16:30:00');
assert.strictEqual(getSmartDefaultDay(mockDays, friAfternoon), 'Venerdì', 'Venerdì alle 16:30 deve mostrare Venerdì (non Lunedì)');

// 7. Venerdì notte alle 23:59
const friNight = new Date('2026-09-18T23:59:00');
assert.strictEqual(getSmartDefaultDay(mockDays, friNight), 'Venerdì', 'Venerdì notte deve mostrare Venerdì');

// 8. Sabato mattina alle 10:00 (weekend senza lezioni del sabato)
const satMorning = new Date('2026-09-19T10:00:00');
assert.strictEqual(getSmartDefaultDay(mockDays, satMorning), 'Lunedì', 'Sabato deve mostrare Lunedì');

// 9. Domenica pomeriggio alle 15:00 (weekend)
const sunAfternoon = new Date('2026-09-20T15:00:00');
assert.strictEqual(getSmartDefaultDay(mockDays, sunAfternoon), 'Lunedì', 'Domenica deve mostrare Lunedì');

console.log('Tutti i test di getSmartDefaultDay sono passati con successo!');

import { extractTimetableStructure } from '../public/js/timeline.js';

console.log('--- Test extractTimetableStructure (Orari Dinamici) ---');

// Test 1: Orario custom a 5 ore con orari non-Volta (es. Liceo 08:15 - 13:10)
const mock5HourTimetable = {
  giorni: [
    {
      giorno: 'Lunedì',
      lezioni: [
        { ora: 1, inizio: '08:15', fine: '09:10', materia: 'ITALIANO' },
        { ora: 2, inizio: '09:10', fine: '10:05', materia: 'LATINO' },
        { ora: 3, inizio: '10:20', fine: '11:15', materia: 'FILOSOFIA' }, // ricreazione 10:05 - 10:20 (15 min)
        { ora: 4, inizio: '11:15', fine: '12:10', materia: 'STORIA' },
        { ora: 5, inizio: '12:10', fine: '13:05', materia: 'INGLESE' }
      ]
    }
  ]
};

const struct5 = extractTimetableStructure(mock5HourTimetable);
const lessons5 = struct5.filter(s => s.type === 'lesson');
const breaks5 = struct5.filter(s => s.type === 'break');

assert.strictEqual(lessons5.length, 5, 'Deve rilevare esattamente 5 ore di lezione per la scuola a 5 ore');
assert.strictEqual(breaks5.length, 1, 'Deve rilevare esattamente 1 ricreazione (10:05 - 10:20)');
assert.strictEqual(breaks5[0].duration, 15, 'La ricreazione rilevata deve essere di 15 minuti');
assert.strictEqual(lessons5[0].start, '08:15', 'La prima ora deve iniziare alle 08:15 e non alle 08:00');
assert.strictEqual(lessons5[4].end, '13:05', 'La quinta ora deve terminare alle 13:05');

// Test 2: Orario Volta 4 BINF con 7ª e 8ª ora (Telecomunicazioni 14:00 - 15:40) e 3ª ricreazione (13:36 - 14:00)
import fs from 'fs';
const timetableData = JSON.parse(fs.readFileSync('./public/data/timetable.json', 'utf-8'));
const structVolta = extractTimetableStructure(timetableData);
const lessonsVolta = structVolta.filter(s => s.type === 'lesson');
const breaksVolta = structVolta.filter(s => s.type === 'break');

assert.strictEqual(lessonsVolta.length, 8, 'Deve rilevare 8 ore di lezione (ora 1..8)');
assert.strictEqual(breaksVolta.length, 3, 'Deve rilevare esattamente 3 ricreazioni');
assert.strictEqual(breaksVolta[0].label, '1ª RICREAZIONE');
assert.strictEqual(breaksVolta[0].start, '09:48');
assert.strictEqual(breaksVolta[0].end, '09:58');
assert.strictEqual(breaksVolta[1].label, '2ª RICREAZIONE');
assert.strictEqual(breaksVolta[1].start, '11:42');
assert.strictEqual(breaksVolta[1].end, '11:52');
assert.strictEqual(breaksVolta[2].label, 'PRANZO');
assert.strictEqual(breaksVolta[2].start, '13:36');
assert.strictEqual(breaksVolta[2].end, '14:00');
assert.strictEqual(breaksVolta[2].duration, 24);

// Test 3: Verifica che non ci sia alcuna ricreazione tra ora 3 e ora 4 (consente unione Italiano / TPSIT)
const slotOra3 = lessonsVolta.find(l => l.ora === 3);
const slotOra4 = lessonsVolta.find(l => l.ora === 4);
const hasBreakBetween3and4 = structVolta.some(s => s.type === 'break' && s.startMin >= slotOra3.endMin && s.endMin <= slotOra4.startMin);
assert.strictEqual(hasBreakBetween3and4, false, 'NON deve esserci ricreazione tra ora 3 e ora 4');

// Test 4: Tra ora 4 e ora 5 deve esserci la 2ª ricreazione
const slotOra5 = lessonsVolta.find(l => l.ora === 5);
const hasBreakBetween4and5 = structVolta.some(s => s.type === 'break' && s.startMin >= slotOra4.endMin && s.endMin <= slotOra5.startMin);
assert.strictEqual(hasBreakBetween4and5, true, 'Deve esserci ricreazione tra ora 4 e ora 5');

// Test 5: Tra ora 6 e ora 7 deve esserci la 3ª ricreazione
const slotOra6 = lessonsVolta.find(l => l.ora === 6);
const slotOra7 = lessonsVolta.find(l => l.ora === 7);
const hasBreakBetween6and7 = structVolta.some(s => s.type === 'break' && s.startMin >= slotOra6.endMin && s.endMin <= slotOra7.startMin);
assert.strictEqual(hasBreakBetween6and7, true, 'Deve esserci 3ª ricreazione tra ora 6 e ora 7');

console.log('Tutti i test di extractTimetableStructure sono passati con successo!');

import { getFormattedDateForDay } from '../public/js/timeline.js';

console.log('--- Test getFormattedDateForDay (Date Dinamiche Intestazione) ---');

// 1. Data odierna: Lunedì 21 Settembre 2026
const todayMonday = new Date('2026-09-21T12:00:00');
assert.strictEqual(getFormattedDateForDay('Lunedì', todayMonday), 'LUNEDÌ 21 SETTEMBRE');
assert.strictEqual(getFormattedDateForDay('Martedì', todayMonday), 'MARTEDÌ 22 SETTEMBRE');
assert.strictEqual(getFormattedDateForDay('Mercoledì', todayMonday), 'MERCOLEDÌ 23 SETTEMBRE');
assert.strictEqual(getFormattedDateForDay('Giovedì', todayMonday), 'GIOVEDÌ 24 SETTEMBRE');
assert.strictEqual(getFormattedDateForDay('Venerdì', todayMonday), 'VENERDÌ 25 SETTEMBRE');

// 2. Domenica 20 Settembre 2026 (weekend: punta alla settimana entrante 21-25 Settembre)
const sundayPre = new Date('2026-09-20T18:00:00');
assert.strictEqual(getFormattedDateForDay('Lunedì', sundayPre), 'LUNEDÌ 21 SETTEMBRE');
assert.strictEqual(getFormattedDateForDay('Martedì', sundayPre), 'MARTEDÌ 22 SETTEMBRE');

// 3. Sabato 26 Settembre 2026 (weekend: punta alla settimana entrante 28 Settembre)
const saturdayPost = new Date('2026-09-26T10:00:00');
assert.strictEqual(getFormattedDateForDay('Lunedì', saturdayPost), 'LUNEDÌ 28 SETTEMBRE');

// 4. Cambio mese (es. Mercoledì 30 Settembre 2026)
const endOfMonth = new Date('2026-09-30T10:00:00');
assert.strictEqual(getFormattedDateForDay('Mercoledì', endOfMonth), 'MERCOLEDÌ 30 SETTEMBRE');
assert.strictEqual(getFormattedDateForDay('Giovedì', endOfMonth), 'GIOVEDÌ 1 OTTOBRE');
assert.strictEqual(getFormattedDateForDay('Venerdì', endOfMonth), 'VENERDÌ 2 OTTOBRE');

console.log('Tutti i test di getFormattedDateForDay sono passati con successo!');

import { getDayOfWeekIndex, areDaysEqual, updateTimelineCursor, updateWeeklyLiveCursor } from '../public/js/timeline.js';

console.log('--- Test getDayOfWeekIndex e areDaysEqual ---');
assert.strictEqual(getDayOfWeekIndex('Lunedì'), 1);
assert.strictEqual(getDayOfWeekIndex('Lunedi'), 1);
assert.strictEqual(getDayOfWeekIndex('LUNEDÌ'), 1);
assert.strictEqual(getDayOfWeekIndex('lun'), 1);
assert.strictEqual(getDayOfWeekIndex('Martedì'), 2);
assert.strictEqual(getDayOfWeekIndex('martedi'), 2);
assert.strictEqual(getDayOfWeekIndex('Mercoledì'), 3);
assert.strictEqual(getDayOfWeekIndex('Giovedì'), 4);
assert.strictEqual(getDayOfWeekIndex('Giovedi'), 4);
assert.strictEqual(getDayOfWeekIndex('Venerdì'), 5);
assert.strictEqual(getDayOfWeekIndex('Sabato'), 6);
assert.strictEqual(getDayOfWeekIndex('Domenica'), 0);

assert.strictEqual(areDaysEqual('Giovedì', 'Giovedi'), true);
assert.strictEqual(areDaysEqual('LUNEDÌ', 'lunedì'), true);
assert.strictEqual(areDaysEqual('Martedì', 'mercoledì'), false);

// Test fallback getSmartDefaultDay senza dati precaricati (array vuoto o null)
const thuTest = new Date('2026-10-01T10:15:00'); // Giovedì
assert.strictEqual(getSmartDefaultDay(null, thuTest), 'Giovedì', 'Nei giorni feriali senza timetable deve selezionare Giovedì');
assert.strictEqual(getSmartDefaultDay([], thuTest), 'Giovedì', 'Con array vuoto nei giorni feriali deve selezionare Giovedì');

console.log('--- Test updateTimelineCursor con righe ricreazione e lezioni in ordine sparso ---');

// Mock DOM container
function createMockElement(tagName, attributes = {}, textContent = '') {
  const children = [];
  const classList = new Set((attributes.class || '').split(' ').filter(Boolean));
  const style = {};
  const attrs = { ...attributes };

  return {
    tagName,
    attributes: attrs,
    style,
    textContent,
    children,
    classList: {
      add: (c) => classList.add(c),
      remove: (c) => classList.delete(c),
      contains: (c) => classList.has(c)
    },
    getAttribute: (name) => attrs[name] || null,
    setAttribute: (name, val) => { attrs[name] = String(val); },
    appendChild: (child) => { children.push(child); child.parentElement = this; },
    querySelector: (selector) => {
      const match = (el) => {
        if (selector.startsWith('.')) {
          return el.classList.contains(selector.slice(1));
        }
        if (selector.startsWith('#')) {
          return el.attributes.id === selector.slice(1);
        }
        if (selector.includes('[')) {
          const m = selector.match(/\[([^=\]]+)(?:="([^"]+)")?\]/);
          if (m) {
            const attrVal = el.getAttribute(m[1]);
            return m[2] !== undefined ? attrVal === m[2] : attrVal !== null;
          }
        }
        return false;
      };
      const search = (nodes) => {
        for (const node of nodes) {
          if (match(node)) return node;
          const found = search(node.children);
          if (found) return found;
        }
        return null;
      };
      return search(children);
    },
    querySelectorAll: (selector) => {
      const selectors = selector.split(',').map(s => s.trim());
      const results = [];
      const matchOne = (el, sel) => {
        if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
        if (sel.includes('[')) {
          const m = sel.match(/([.\w-]*)(?:\[([^=\]]+)(?:="([^"]+)")?\])/);
          if (m) {
            if (m[1] && m[1].startsWith('.') && !el.classList.contains(m[1].slice(1))) return false;
            const attrVal = el.getAttribute(m[2]);
            return m[3] !== undefined ? attrVal === m[3] : attrVal !== null;
          }
        }
        return false;
      };
      const search = (nodes) => {
        for (const node of nodes) {
          if (selectors.some(s => matchOne(node, s))) results.push(node);
          search(node.children);
        }
      };
      search(children);
      return results;
    },
    offsetTop: 0,
    offsetHeight: 80
  };
}

// Costruisci il container per Giovedì (con Break aggiunti prima dei Lesson slot come in app.js)
const mockContainer = createMockElement('div');
const liveCursor = createMockElement('div', { class: 'live-cursor' });
const cursorTime = createMockElement('span', { class: 'cursor-time' });
liveCursor.appendChild(cursorTime);
mockContainer.appendChild(liveCursor);

const liveLine = createMockElement('div', { class: 'live-timeline-line' });
mockContainer.appendChild(liveLine);

const grid = createMockElement('div', { class: 'daily-timeline-grid', 'data-day': 'Giovedì' });
mockContainer.appendChild(grid);

// 1. Appendi Break 1 e Break 2
const break1 = createMockElement('div', { class: 'timeline-break-row', 'data-start': '09:48', 'data-end': '09:58' });
const break1Bar = createMockElement('div', { class: 'timeline-break-bar' });
break1.appendChild(break1Bar);
grid.appendChild(break1);

const break2 = createMockElement('div', { class: 'timeline-break-row', 'data-start': '11:42', 'data-end': '11:52' });
const break2Bar = createMockElement('div', { class: 'timeline-break-bar' });
break2.appendChild(break2Bar);
grid.appendChild(break2);

// 2. Appendi Lezioni: Ora 1-2 (Informatica Lab double), Ora 3 (Storia), Ora 4 (Matematica), Ora 5 (Inglese), Ora 6 (Sistemi)
const lessonSlots = [
  { start: '08:00', end: '09:48', name: 'INFORMATICA LAB.' },
  { start: '09:58', end: '10:48', name: 'STORIA' },
  { start: '10:52', end: '11:42', name: 'MATEMATICA' },
  { start: '11:52', end: '12:42', name: 'INGLESE' },
  { start: '12:46', end: '13:36', name: 'SISTEMI e RETI' }
];

const lessonCardElements = [];
for (const s of lessonSlots) {
  const row = createMockElement('div', { class: 'timeline-lesson-row', 'data-start': s.start, 'data-end': s.end });
  const card = createMockElement('article', { class: 'lesson-card', 'data-start': s.start, 'data-end': s.end });
  const timeLeft = createMockElement('span', { class: 'time-left-text' });
  card.appendChild(timeLeft);
  row.appendChild(card);
  grid.appendChild(row);
  lessonCardElements.push({ row, card, name: s.name });
}

// Test 1: Giovedì ore 10:15 (Ora 3 - Storia)
// PRECEDENTEMENTE QUESTO FALLIVA perché break1 e break2 creavano un finto gap che abortiva il ciclo!
const now1015 = new Date('2026-10-01T10:15:00');
updateTimelineCursor(mockContainer, now1015);

const storiaCard = lessonCardElements.find(l => l.name === 'STORIA').card;
assert.strictEqual(storiaCard.classList.contains('is-active'), true, 'STORIA alle 10:15 DEVE essere attiva con .is-active!');
assert.strictEqual(liveCursor.style.display, 'flex', 'Il cursore live deve essere visibile');

// Test 2: Giovedì ore 11:00 (Ora 4 - Matematica)
const now1100 = new Date('2026-10-01T11:00:00');
updateTimelineCursor(mockContainer, now1100);

const mateCard = lessonCardElements.find(l => l.name === 'MATEMATICA').card;
assert.strictEqual(mateCard.classList.contains('is-active'), true, 'MATEMATICA alle 11:00 DEVE essere attiva con .is-active!');
assert.strictEqual(storiaCard.classList.contains('is-active'), false, 'Storia non deve più essere attiva alle 11:00');

// Test 3: Giovedì ore 11:45 (Ricreazione 2)
const now1145 = new Date('2026-10-01T11:45:00');
updateTimelineCursor(mockContainer, now1145);
assert.strictEqual(break2Bar.classList.contains('is-active-break'), true, 'Ricreazione 2 deve essere attiva alle 11:45');
assert.strictEqual(mateCard.classList.contains('is-active'), false);

// Test 4: Giovedì ore 13:00 (Ora 6 - Sistemi e Reti)
const now1300 = new Date('2026-10-01T13:00:00');
updateTimelineCursor(mockContainer, now1300);
const sistemiCard = lessonCardElements.find(l => l.name === 'SISTEMI e RETI').card;
assert.strictEqual(sistemiCard.classList.contains('is-active'), true, 'SISTEMI e RETI alle 13:00 DEVE essere attiva!');

// Test 5: Giorno diverso (es. l\'utente sta visualizzando Venerdì oggi che è Giovedì)
grid.setAttribute('data-day', 'Venerdì');
updateTimelineCursor(mockContainer, now1015);
assert.strictEqual(storiaCard.classList.contains('is-active'), false, 'Non deve attivare card se si visualizza un giorno diverso da oggi');
assert.strictEqual(liveCursor.style.display, 'none', 'Il cursore non deve essere mostrato in un giorno diverso da oggi');

console.log('✓ Tutti i test per updateTimelineCursor e gestione attiva sono passati con successo!');


