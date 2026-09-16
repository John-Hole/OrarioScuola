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

console.log('✓ Tutti i test di sdoppiamento ore doppie sono passati con successo!');
