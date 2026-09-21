/**
 * timeline.js - Motore per la Timeline Verticale Dinamica e Cursore Live
 * Supporta vista Giornaliera e vista Settimanale in tempo reale senza sovrapposizioni.
 */

const IT_DAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

export const IT_MONTHS = [
  'GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO',
  'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'
];

/**
 * Calcola l'etichetta data dinamica per un giorno della settimana (Lunedì-Venerdì)
 * rispetto alla data di riferimento corrente (o simulata).
 * Es. per Lunedì 21 Settembre restituisce "LUNEDÌ 21 SETTEMBRE".
 */
export function getFormattedDateForDay(selectedDay, baseDate = new Date()) {
  const currentDayOfWeek = baseDate.getDay(); // 0 = Dom, 1 = Lun, ..., 6 = Sab

  // Determina il lunedì della settimana di riferimento:
  // Se è Domenica (0) punta al lunedì successivo (+1), se è Sabato (6) a +2 giorni
  const monday = new Date(baseDate);
  if (currentDayOfWeek === 0) {
    monday.setDate(baseDate.getDate() + 1);
  } else if (currentDayOfWeek === 6) {
    monday.setDate(baseDate.getDate() + 2);
  } else {
    monday.setDate(baseDate.getDate() - (currentDayOfWeek - 1));
  }

  const dayOrder = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const dayIndex = dayOrder.indexOf(selectedDay);
  const offset = dayIndex !== -1 ? dayIndex : 0;

  const targetDate = new Date(monday);
  targetDate.setDate(monday.getDate() + offset);

  const dayNum = targetDate.getDate();
  const monthName = IT_MONTHS[targetDate.getMonth()];
  const dayName = selectedDay ? selectedDay.toUpperCase() : '';

  return `${dayName} ${dayNum} ${monthName}`;
}

export function timeToMinutes(tStr) {
  if (!tStr) return 0;
  const clean = tStr.replace('h', ':').trim();
  const [h, m] = clean.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Mappa i nomi delle materie scolastiche alla classe CSS del tema pastello
 */
export function getSubjectThemeClass(subjectName) {
  if (!subjectName) return 'theme-default';
  const s = subjectName.toUpperCase();
  if (s.includes('SISTEMI')) return 'theme-sistemi';
  if (s.includes('TPSIT')) return 'theme-tpsit';
  if (s.includes('MATEMATICA')) return 'theme-matematica';
  if (s.includes('INGLESE')) return 'theme-inglese';
  if (s.includes('ITALIANO') || s.includes('STORIA') || s.includes('DIRITTO')) return 'theme-lettere';
  if (s.includes('INFORMATICA')) return 'theme-informatica';
  if (s.includes('SCIENZE MOTORIE') || s.includes('ED. FISICA') || s.includes('PALESTRA')) return 'theme-motoria';
  if (s.includes('SCIENZE') || s.includes('CHIMICA')) return 'theme-scienze';
  if (s.includes('RELIGIONE')) return 'theme-religione';
  if (s.includes('TELECOMUNICAZIONI')) return 'theme-telecom';
  return 'theme-default';
}

/**
 * Determina il giorno da visualizzare:
 * Mostra il giorno corrente fino alle 23:59 dello stesso giorno (giorno per giorno,
 * senza passare in anticipo al giorno successivo nel pomeriggio).
 * Nel weekend (Sabato non a calendario o Domenica) mostra di default Lunedì.
 */
export function getSmartDefaultDay(timetableDays, date = new Date()) {
  const dayIndex = date.getDay(); // 0 = Dom, 1 = Lun, ..., 6 = Sab
  const availableDayNames = (timetableDays || []).map(d => d.giorno);
  const todayName = IT_DAYS[dayIndex];

  // Se il giorno corrente è presente a orario (Lunedì-Venerdì o Sabato se attivo),
  // visualizza sempre il giorno odierno fino alle 23:59
  if (availableDayNames.includes(todayName)) {
    return todayName;
  }

  // Nel fine settimana o giorni senza lezioni a calendario (es. Domenica o Sabato libero)
  if (availableDayNames.includes("Lunedì")) {
    return "Lunedì";
  }

  return availableDayNames[0] || "Lunedì";
}

/**
 * Calcola lo stato della lezione corrente per un elenco di lezioni
 */
export function evaluateCurrentStatus(lessons, currentMinutes) {
  if (!lessons || lessons.length === 0) {
    return { type: "NO_LESSONS" };
  }

  const firstStart = timeToMinutes(lessons[0].inizio);
  const lastEnd = timeToMinutes(lessons[lessons.length - 1].fine);

  if (currentMinutes < firstStart) {
    return {
      type: "BEFORE_SCHOOL",
      minutesUntilStart: firstStart - currentMinutes,
      firstLesson: lessons[0]
    };
  }

  if (currentMinutes >= lastEnd) {
    return {
      type: "FINISHED",
      minutesSinceEnd: currentMinutes - lastEnd
    };
  }

  for (let i = 0; i < lessons.length; i++) {
    const start = timeToMinutes(lessons[i].inizio);
    const end = timeToMinutes(lessons[i].fine);

    if (currentMinutes >= start && currentMinutes < end) {
      return {
        type: "IN_LESSON",
        index: i,
        lesson: lessons[i],
        nextLesson: lessons[i + 1] || null,
        minutesRemaining: end - currentMinutes,
        progressPercent: Math.round(((currentMinutes - start) / (end - start)) * 100)
      };
    }

    if (i + 1 < lessons.length) {
      const nextStart = timeToMinutes(lessons[i + 1].inizio);
      if (currentMinutes >= end && currentMinutes < nextStart) {
        return {
          type: "BREAK",
          index: i,
          justFinished: lessons[i],
          nextLesson: lessons[i + 1],
          minutesUntilNext: nextStart - currentMinutes
        };
      }
    }
  }

  return { type: "UNKNOWN" };
}

/**
 * Orari standard delle 6 ore e doppie ricreazioni dell'istituto scolastico
 */
export const STANDARD_SCHOOL_HOURS = [
  { ora: 1, start: '08:00', end: '08:54' },
  { ora: 2, start: '08:58', end: '09:48' },
  { ora: 3, start: '09:58', end: '10:48' },
  { ora: 4, start: '10:52', end: '11:42' },
  { ora: 5, start: '11:52', end: '12:42' },
  { ora: 6, start: '12:46', end: '13:36' }
];

/**
 * Estrae la sequenza cronologica globale degli slot orari e delle ricreazioni (1 o 2 ricreazioni).
 * Garantisce sempre una griglia completa a 6 ore (minHours = 6) lasciando vuoti gli slot non assegnati.
 */
export function extractTimetableStructure(timetable, minHours = null) {
  const hourMap = new Map(); // ora -> { ora, start, end, startMin, endMin }

  // 1. Raccogli tutti gli orari effettivi per ciascuna ora presenti nell'orario
  if (timetable && timetable.giorni) {
    timetable.giorni.forEach(day => {
      (day.lezioni || []).forEach(lesson => {
        const ora = lesson.ora;
        if (!ora) return;
        if (!hourMap.has(ora)) {
          hourMap.set(ora, {
            ora,
            start: lesson.inizio,
            end: lesson.fine,
            startMin: timeToMinutes(lesson.inizio),
            endMin: timeToMinutes(lesson.fine)
          });
        }
      });
    });
  }

  // 2. Determina il massimo numero di ore effettivo (es. 5, 6, 7 o 8)
  const maxExisting = hourMap.size > 0 ? Math.max(...hourMap.keys()) : 0;
  const targetMax = minHours !== null ? Math.max(minHours, maxExisting) : (maxExisting > 0 ? maxExisting : 6);

  for (let h = 1; h <= targetMax; h++) {
    if (!hourMap.has(h)) {
      const prev = hourMap.get(h - 1);
      let calculatedStart = '00:00';
      let calculatedEnd = '00:00';

      if (prev) {
        // Se abbiamo l'ora precedente, deduciamo lo stacco orario tipico (circa 50-60 min)
        const dur = prev.endMin - prev.startMin || 55;
        const newStartMin = prev.endMin + 5;
        const newEndMin = newStartMin + dur;
        calculatedStart = minutesToTime(newStartMin);
        calculatedEnd = minutesToTime(newEndMin);
      } else {
        const std = STANDARD_SCHOOL_HOURS.find(x => x.ora === h);
        if (std) {
          calculatedStart = std.start;
          calculatedEnd = std.end;
        }
      }

      hourMap.set(h, {
        ora: h,
        start: calculatedStart,
        end: calculatedEnd,
        startMin: timeToMinutes(calculatedStart),
        endMin: timeToMinutes(calculatedEnd)
      });
    }
  }

  const sortedHours = Array.from(hourMap.values()).sort((a, b) => a.ora - b.ora);
  const structure = [];
  let breakCount = 0;

  for (let i = 0; i < sortedHours.length; i++) {
    const h = sortedHours[i];
    structure.push({
      type: 'lesson',
      ora: h.ora,
      start: h.start,
      end: h.end,
      startMin: h.startMin,
      endMin: h.endMin
    });

    if (i + 1 < sortedHours.length) {
      const nextH = sortedHours[i + 1];
      const gap = nextH.startMin - h.endMin;
      // Una ricreazione scolastica ha durata tipica >= 8 minuti (es. 10 o 15 min)
      if (gap >= 8) {
        breakCount++;
        structure.push({
          type: 'break',
          breakIndex: breakCount,
          start: h.end,
          end: nextH.start,
          startMin: h.endMin,
          endMin: nextH.startMin,
          duration: gap,
          label: breakCount === 1 ? '1ª RICREAZIONE' : (breakCount === 2 ? '2ª RICREAZIONE' : `${breakCount}ª RICREAZIONE`)
        });
      }
    }
  }

  // Calcola le coordinate di riga CSS (partendo da riga 2, poiché riga 1 è l'header)
  let currentGridRow = 2;
  structure.forEach(item => {
    item.gridRow = currentGridRow;
    currentGridRow++;
  });

  return structure;
}

/**
 * Aggiorna il cursore temporale e la timeline visuale nella vista Giorno
 * La linea blu si ferma ESATTAMENTE al bordo sinistro del blocco e NON ci va sopra!
 */
export function updateTimelineCursor(containerElement, now = new Date()) {
  if (!containerElement) return;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const cursorBadge = containerElement.querySelector('.live-cursor');
  const indicatorLine = containerElement.querySelector('.live-timeline-line');
  const rows = containerElement.querySelectorAll('.timeline-lesson-row, .timeline-break-row');

  if (rows.length === 0) return;

  // Calcolo dinamico di inizio e fine giornata scolastica
  let schoolStart = Infinity;
  let schoolEnd = -Infinity;
  rows.forEach(r => {
    const s = timeToMinutes(r.getAttribute('data-start'));
    const e = timeToMinutes(r.getAttribute('data-end'));
    if (!isNaN(s) && s < schoolStart) schoolStart = s;
    if (!isNaN(e) && e > schoolEnd) schoolEnd = e;
  });

  if (schoolStart === Infinity) schoolStart = 480;
  if (schoolEnd === -Infinity) schoolEnd = 702;

  let targetTop = 0;
  let isVisible = false;
  let hasActiveBlock = false;

  // Reset stati attivi precedenti
  rows.forEach(row => {
    const card = row.querySelector('.lesson-card');
    if (card) card.classList.remove('is-active');
    const breakBar = row.querySelector('.timeline-break-bar');
    if (breakBar) breakBar.classList.remove('is-active-break');
  });

  if (currentMinutes >= schoolStart && currentMinutes <= schoolEnd) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const start = timeToMinutes(row.getAttribute('data-start'));
      const end = timeToMinutes(row.getAttribute('data-end'));

      if (currentMinutes >= start && currentMinutes < end) {
        isVisible = true;
        const ratio = (currentMinutes - start) / (end - start);
        targetTop = row.offsetTop + (row.offsetHeight * ratio);

        const card = row.querySelector('.lesson-card');
        if (card) {
          card.classList.add('is-active');
          hasActiveBlock = true;
          const timeLeftElem = card.querySelector('.time-left-text');
          if (timeLeftElem) {
            const rem = end - currentMinutes;
            timeLeftElem.textContent = `Fine tra ${rem} min`;
          }
        }

        const breakBar = row.querySelector('.timeline-break-bar');
        if (breakBar) {
          breakBar.classList.add('is-active-break');
          hasActiveBlock = true;
        }
        break;
      } else if (i + 1 < rows.length) {
        const nextRow = rows[i + 1];
        const nextStart = timeToMinutes(nextRow.getAttribute('data-start'));
        if (currentMinutes >= end && currentMinutes < nextStart) {
          isVisible = true;
          const ratio = (currentMinutes - end) / (nextStart - end);
          const currentBottom = row.offsetTop + row.offsetHeight;
          targetTop = currentBottom + ((nextRow.offsetTop - currentBottom) * ratio);
          break;
        }
      }
    }
  }

  if (cursorBadge) {
    if (isVisible && targetTop > 0) {
      cursorBadge.style.display = 'flex';
      cursorBadge.style.top = `${targetTop}px`;

      if (indicatorLine) {
        indicatorLine.style.display = 'block';
        indicatorLine.style.top = `${targetTop}px`;
        if (hasActiveBlock) {
          indicatorLine.style.right = 'auto';
          indicatorLine.style.width = '32px';
        } else {
          indicatorLine.style.right = '0';
          indicatorLine.style.width = 'auto';
        }
      }

      const badgeTimeText = cursorBadge.querySelector('.cursor-time');
      if (badgeTimeText) {
        badgeTimeText.textContent = timeStr;
      }
    } else {
      cursorBadge.style.display = 'none';
      if (indicatorLine) indicatorLine.style.display = 'none';
    }
  }
}

/**
 * Aggiorna il cursore temporale e la lezione in corso nella vista Settimana
 */
export function updateWeeklyLiveCursor(gridContainer, now = new Date()) {
  if (!gridContainer) return;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const liveLine = gridContainer.querySelector('.weekly-live-line');
  const liveCursor = gridContainer.querySelector('.weekly-live-cursor');
  const cursorTime = gridContainer.querySelector('#weekly-cursor-time');

  const dayOfWeek = now.getDay(); // 1 = Lun, 2 = Mar, ..., 5 = Ven
  const isSchoolDay = dayOfWeek >= 1 && dayOfWeek <= 5;

  // Reset stati attivi precedenti
  gridContainer.querySelectorAll('.is-active-lesson').forEach(el => {
    el.classList.remove('is-active-lesson');
    const b = el.querySelector('.grid-active-badge');
    if (b) b.remove();
  });
  gridContainer.querySelectorAll('.grid-cell-break').forEach(el => {
    el.classList.remove('is-active-break');
  });

  // Estrai dinamicamente tutti gli slot presenti nella griglia (lezioni e ricreazioni)
  const slotElements = gridContainer.querySelectorAll('[data-start-min][data-end-min]');
  const uniqueSlots = [];
  const seenRanges = new Set();

  slotElements.forEach(el => {
    const s = parseInt(el.getAttribute('data-start-min'), 10);
    const e = parseInt(el.getAttribute('data-end-min'), 10);
    const key = `${s}-${e}`;
    if (!seenRanges.has(key)) {
      seenRanges.add(key);
      uniqueSlots.push({ start: s, end: e, elem: el });
    }
  });

  uniqueSlots.sort((a, b) => a.start - b.start);

  if (uniqueSlots.length === 0) return;

  const schoolStart = uniqueSlots[0].start;
  const schoolEnd = uniqueSlots[uniqueSlots.length - 1].end;

  let isVisible = false;
  let targetTop = 0;

  if (isSchoolDay && currentMinutes >= schoolStart && currentMinutes <= schoolEnd) {
    isVisible = true;

    for (let i = 0; i < uniqueSlots.length; i++) {
      const slot = uniqueSlots[i];
      if (!slot.elem) continue;

      if (currentMinutes >= slot.start && currentMinutes < slot.end) {
        const top = slot.elem.offsetTop;
        const h = slot.elem.offsetHeight;
        const ratio = (currentMinutes - slot.start) / (slot.end - slot.start);
        targetTop = top + (h * ratio);
        break;
      } else if (i + 1 < uniqueSlots.length) {
        const nextSlot = uniqueSlots[i + 1];
        if (nextSlot.elem && currentMinutes >= slot.end && currentMinutes < nextSlot.start) {
          const btm = slot.elem.offsetTop + slot.elem.offsetHeight;
          const nextTop = nextSlot.elem.offsetTop;
          const ratio = (currentMinutes - slot.end) / (nextSlot.start - slot.end);
          targetTop = btm + ((nextTop - btm) * ratio);
          break;
        }
      }
    }

    const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const todayName = dayNames[dayOfWeek];

    // Evidenzia le ricreazioni se attive
    const activeBreak = Array.from(gridContainer.querySelectorAll('.grid-cell-break')).find(b => {
      const s = parseInt(b.getAttribute('data-start-min'), 10);
      const e = parseInt(b.getAttribute('data-end-min'), 10);
      return currentMinutes >= s && currentMinutes < e;
    });
    if (activeBreak) {
      activeBreak.classList.add('is-active-break');
    }

    // Evidenzia la cella lezione odierna in corso
    const todayCells = gridContainer.querySelectorAll(`.grid-cell-lesson[data-day="${todayName}"]`);
    todayCells.forEach(cell => {
      const s = parseInt(cell.getAttribute('data-start-min'), 10);
      const e = parseInt(cell.getAttribute('data-end-min'), 10);
      if (currentMinutes >= s && currentMinutes < e) {
        cell.classList.add('is-active-lesson');
        if (!cell.querySelector('.grid-active-badge')) {
          const badge = document.createElement('span');
          badge.className = 'grid-active-badge';
          badge.textContent = 'IN CORSO';
          cell.appendChild(badge);
        }
      }
    });
  }

  if (liveCursor) {
    if (isVisible && targetTop > 0) {
      liveCursor.style.display = 'flex';
      liveCursor.style.top = `${targetTop}px`;
      if (cursorTime) cursorTime.textContent = timeStr;
    } else {
      liveCursor.style.display = 'none';
    }
  }

  if (liveLine) {
    if (isVisible && targetTop > 0) {
      liveLine.style.display = 'block';
      liveLine.style.top = `${targetTop}px`;
    } else {
      liveLine.style.display = 'none';
    }
  }
}

/**
 * Esegue lo smooth auto-scroll per centrare la lezione in corso
 */
export function autoScrollToActiveLesson(containerElement) {
  if (!containerElement) return;
  const activeCard = containerElement.querySelector('.lesson-card.is-active');
  if (activeCard) {
    activeCard.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
}
