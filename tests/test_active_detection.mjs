import fs from 'fs';
import { extractTimetableStructure, timeToMinutes } from '../public/js/timeline.js';

const timetable = JSON.parse(fs.readFileSync('./public/data/timetable.json', 'utf-8'));

function runSimulation(dayName, testTimes) {
  console.log(`\n========================================`);
  console.log(`TESTING DAY: ${dayName}`);
  console.log(`========================================`);

  const dayData = timetable.giorni.find(d => d.giorno === dayName);
  const dayLessons = dayData.lezioni;
  const maxDayHour = Math.max(6, ...dayLessons.map(l => l.ora || 0));

  const structure = extractTimetableStructure(timetable, 6);
  const dayStructure = structure.filter(item => {
    if (item.type === 'lesson') return item.ora <= maxDayHour;
    if (item.type === 'break') return dayLessons.some(l => timeToMinutes(l.inizio) >= item.endMin);
    return true;
  });

  const appendedElements = [];

  // Break rows appended first (exactly as app.js currently does)
  for (let sIdx = 0; sIdx < dayStructure.length; sIdx++) {
    const item = dayStructure[sIdx];
    if (item.type === 'break') {
      appendedElements.push({
        type: 'break',
        className: 'timeline-break-row',
        start: item.start,
        end: item.end,
        startMin: item.startMin,
        endMin: item.endMin,
        label: item.label
      });
    }
  }

  // Lesson rows appended second
  const lessonSlots = dayStructure.filter(s => s.type === 'lesson');
  const handledHours = new Set();
  for (let i = 0; i < lessonSlots.length; i++) {
    const slotA = lessonSlots[i];
    const hA = slotA.ora;
    if (handledHours.has(hA)) continue;

    const slotB = lessonSlots[i + 1];
    const hB = slotB ? slotB.ora : null;
    const lA = dayLessons.find(l => l.ora === hA);
    const lB = hB ? dayLessons.find(l => l.ora === hB) : null;

    const hasBreakBetween = dayStructure.some(s => s.type === 'break' && s.startMin >= slotA.endMin && s.endMin <= (slotB ? slotB.startMin : 0));
    const isSameSubject = lA && lB && (lA.materia || '').trim().toLowerCase() === (lB.materia || '').trim().toLowerCase();
    const isSameRoom = !lA?.aula || !lB?.aula || (lA.aula || '').trim().toLowerCase() === (lB.aula || '').trim().toLowerCase();
    const isConsecutive = hB === hA + 1;

    if (slotB && !hasBreakBetween && isSameSubject && isSameRoom && isConsecutive) {
      appendedElements.push({
        type: 'lesson',
        className: 'timeline-lesson-row lesson-slot-double',
        start: lA.inizio,
        end: lB.fine,
        startMin: timeToMinutes(lA.inizio),
        endMin: timeToMinutes(lB.fine),
        materia: lA.materia,
        isDouble: true
      });
      handledHours.add(hA);
      handledHours.add(hB);
    } else {
      if (lA) {
        appendedElements.push({
          type: 'lesson',
          className: 'timeline-lesson-row lesson-slot-single',
          start: lA.inizio,
          end: lA.fine,
          startMin: timeToMinutes(lA.inizio),
          endMin: timeToMinutes(lA.fine),
          materia: lA.materia,
          isDouble: false
        });
      }
      handledHours.add(hA);
    }
  }

  // SIMULATING THE NEW SORTED & SPLIT LOGIC
  const rawRows = appendedElements;
  const rows = rawRows
    .map(el => ({
      elem: el,
      start: el.startMin,
      end: el.endMin,
      isBreak: el.className.includes('timeline-break-row'),
      label: el.label,
      materia: el.materia
    }))
    .filter(r => !isNaN(r.start) && !isNaN(r.end) && r.start < r.end)
    .sort((a, b) => a.start - b.start);

  console.log(`Sorted rows (${rows.length}):`);
  rows.forEach((r, idx) => {
    console.log(`  [${idx}] ${r.isBreak ? 'BREAK' : 'LESSON'}: ${r.elem.start} - ${r.elem.end} -> ${r.materia || r.label}`);
  });

  const schoolStart = rows[0].start;
  const schoolEnd = Math.max(...rows.map(r => r.end));

  for (const timeStr of testTimes) {
    const currentMinutes = timeToMinutes(timeStr);
    let activeRow = null;
    let gapFound = null;

    if (currentMinutes >= schoolStart && currentMinutes <= schoolEnd) {
      for (const r of rows) {
        if (currentMinutes >= r.start && currentMinutes < r.end) {
          activeRow = r;
          break;
        }
      }

      if (!activeRow) {
        for (let i = 0; i < rows.length - 1; i++) {
          const cur = rows[i];
          const next = rows[i + 1];
          if (currentMinutes >= cur.end && currentMinutes < next.start) {
            gapFound = { prev: cur, next };
            break;
          }
        }
      }
    }

    if (activeRow) {
      console.log(`✓ ${timeStr}: ACTIVE -> [${activeRow.elem.start}-${activeRow.elem.end}] ${activeRow.materia || activeRow.label}`);
    } else if (gapFound) {
      console.log(`• ${timeStr}: GAP/TRANSITION between [${gapFound.prev.elem.start}-${gapFound.prev.elem.end}] and [${gapFound.next.elem.start}-${gapFound.next.elem.end}]`);
    } else {
      console.log(`✗ ${timeStr}: OUTSIDE SCHOOL HOURS (${schoolStart}-${schoolEnd})`);
    }
  }
}

runSimulation('Giovedì', [
  '07:50', // Prima di scuola
  '08:00', // Inizio Ora 1
  '08:30', // Durante Ora 1 (Informatica Lab)
  '08:54', // Cambio ora 1 -> 2
  '09:15', // Durante Ora 2 (Informatica Lab)
  '09:48', // Inizio Ricreazione 1
  '09:55', // Durante Ricreazione 1
  '09:58', // Inizio Ora 3 (Storia)
  '10:15', // Durante Ora 3 (Storia)
  '10:48', // Cambio ora 3 -> 4
  '10:52', // Inizio Ora 4 (Matematica)
  '11:00', // Durante Ora 4 (Matematica)
  '11:42', // Inizio Ricreazione 2
  '11:45', // Durante Ricreazione 2
  '11:52', // Inizio Ora 5 (Inglese)
  '12:20', // Durante Ora 5 (Inglese)
  '12:42', // Cambio ora 5 -> 6
  '12:46', // Inizio Ora 6 (Sistemi)
  '13:10', // Durante Ora 6 (Sistemi)
  '13:36', // Termine lezioni
  '14:00'  // Dopo scuola
]);

runSimulation('Martedì', [
  '08:30', // Ora 1 (Religione)
  '09:15', // Ora 2 (Informatica)
  '09:50', // Ricreazione 1
  '10:15', // Ora 3 (TPSIT Lab - Double)
  '11:00', // Ora 4 (TPSIT Lab - Double)
  '11:45', // Ricreazione 2
  '12:20', // Ora 5 (Italiano)
  '13:00', // Ora 6 (Matematica)
  '13:45', // Pranzo
  '14:20', // Ora 7 (Telecomunicazioni Lab - Double)
  '15:10', // Ora 8 (Telecomunicazioni Lab - Double)
  '15:40', // Termine
  '16:00'  // Fuori orario
]);
