import assert from 'assert';
import { normalizeTimetableMultiHourSlots } from '../public/js/timetable_store.js';

console.log('--- Test normalizeTimetableMultiHourSlots ---');

// Test 1: Mercoledì con TPSIT LAB che copre 3ª e 4ª ora (09:58 - 11:42)
const timetableWithMultiHour = {
  classe: "4 CINF** (art. con 4 DGR)",
  giorni: [
    {
      giorno: "Mercoledì",
      lezioni: [
        {
          ora: 1,
          inizio: "08:00",
          fine: "08:54",
          materia: "ITALIANO",
          docenti: ["GUIDANTONI S."],
          aula: "C 140",
          is_lab: false
        },
        {
          ora: 2,
          inizio: "08:58",
          fine: "09:48",
          materia: "RELIGIONE",
          docenti: ["DE TONI A."],
          aula: "C 140",
          is_lab: false
        },
        {
          ora: 3,
          inizio: "09:58",
          fine: "11:42",
          materia: "TPSIT LAB.",
          docenti: ["GIAPPICHINI A.", "VALECCHI F."],
          aula: "B 045 - P.T. EST",
          is_lab: true
        }
      ]
    },
    {
      giorno: "Giovedì",
      lezioni: [
        {
          ora: 1,
          inizio: "08:00",
          fine: "09:48",
          materia: "SCIENZE MOTORIE",
          docenti: ["GIONTA S."],
          aula: "Palestra ITTS",
          is_lab: false
        },
        {
          ora: 3,
          inizio: "09:58",
          fine: "10:48",
          materia: "STORIA",
          docenti: ["GUIDANTONI S."],
          aula: "C 280",
          is_lab: false
        },
        {
          ora: 4,
          inizio: "10:52",
          fine: "11:42",
          materia: "MATEMATICA",
          docenti: ["NUCCI C."],
          aula: "C 180",
          is_lab: false
        }
      ]
    }
  ]
};

const normalized = normalizeTimetableMultiHourSlots(JSON.parse(JSON.stringify(timetableWithMultiHour)));

const mercoledi = normalized.giorni.find(g => g.giorno === 'Mercoledì');
assert.strictEqual(mercoledi.lezioni.length, 4, 'Mercoledì deve avere esattamente 4 lezioni (1, 2, 3, 4)');

const ora3 = mercoledi.lezioni.find(l => l.ora === 3);
const ora4 = mercoledi.lezioni.find(l => l.ora === 4);

assert(ora3, 'Ora 3 di Mercoledì deve esistere');
assert.strictEqual(ora3.materia, 'TPSIT LAB.', 'Ora 3 deve essere TPSIT LAB.');
assert.strictEqual(ora3.inizio, '09:58');
assert.strictEqual(ora3.fine, '10:48');
assert.strictEqual(ora3.aula, 'B 045 - P.T. EST');
assert.strictEqual(ora3.is_lab, true);

assert(ora4, 'Ora 4 di Mercoledì deve esistere');
assert.strictEqual(ora4.materia, 'TPSIT LAB.', 'Ora 4 deve essere TPSIT LAB.');
assert.strictEqual(ora4.inizio, '10:52');
assert.strictEqual(ora4.fine, '11:42');
assert.strictEqual(ora4.aula, 'B 045 - P.T. EST');
assert.strictEqual(ora4.is_lab, true);

// Test 2: Giovedì Scienze motorie ore 1 e 2
const giovedi = normalized.giorni.find(g => g.giorno === 'Giovedì');
assert.strictEqual(giovedi.lezioni.length, 4, 'Giovedì deve avere 4 lezioni (1, 2, 3, 4)');

const gOra1 = giovedi.lezioni.find(l => l.ora === 1);
const gOra2 = giovedi.lezioni.find(l => l.ora === 2);
assert.strictEqual(gOra1.materia, 'SCIENZE MOTORIE');
assert.strictEqual(gOra1.inizio, '08:00');
assert.strictEqual(gOra1.fine, '08:54');

assert.strictEqual(gOra2.materia, 'SCIENZE MOTORIE');
assert.strictEqual(gOra2.inizio, '08:58');
assert.strictEqual(gOra2.fine, '09:48');

// Test 3: Rimozione automatica delle caselle "ricreazione" e riallineamento ora pomeridiana
const timetableWithRecessSlots = {
  classe: "4 BINF",
  giorni: [
    {
      giorno: "Martedì",
      lezioni: [
        { ora: 1, inizio: "08:00", fine: "08:54", materia: "RELIGIONE" },
        { ora: 2, inizio: "08:58", fine: "09:48", materia: "INFORMATICA" },
        { ora: 3, inizio: "09:58", fine: "10:48", materia: "TPSIT LAB." },
        { ora: 4, inizio: "10:52", fine: "11:42", materia: "TPSIT LAB." },
        { ora: 5, inizio: "11:52", fine: "12:42", materia: "ITALIANO" },
        { ora: 6, inizio: "12:46", fine: "13:36", materia: "MATEMATICA" },
        { ora: 7, inizio: "13:36", fine: "13:48", materia: "Terza ricreazione" },
        { ora: 8, inizio: "13:48", fine: "14:00", materia: "Terza ricreazione" },
        { ora: 9, inizio: "14:00", fine: "14:50", materia: "TELECOMUNICAZIONI LAB." }
      ]
    }
  ]
};

const normalizedRecess = normalizeTimetableMultiHourSlots(JSON.parse(JSON.stringify(timetableWithRecessSlots)));
const marLessons = normalizedRecess.giorni[0].lezioni;
assert.strictEqual(marLessons.length, 7, 'Martedì deve avere 7 lezioni, le 2 ricreazioni devono essere rimosse');
assert(!marLessons.some(l => /ricreazione/i.test(l.materia)), 'Nessuna lezione deve essere una ricreazione');
const lastLesson = marLessons[6];
assert.strictEqual(lastLesson.ora, 7, 'Telecomunicazioni Lab deve diventare ora 7');
assert.strictEqual(lastLesson.materia, 'TELECOMUNICAZIONI LAB.');
assert.strictEqual(lastLesson.inizio, '14:00');
assert.strictEqual(lastLesson.fine, '14:50');

console.log('✓ Tutti i test di sdoppiamento ore doppie e rimozione ricreazioni sono passati con successo!');
