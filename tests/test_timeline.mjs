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
