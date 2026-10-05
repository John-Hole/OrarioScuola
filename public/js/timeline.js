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
  if (s.includes('STORIA')) return 'theme-storia';
  if (s.includes('DIRITTO')) return 'theme-diritto';
  if (s.includes('ITALIANO') || s.includes('LETTERE')) return 'theme-lettere';
  if (s.includes('INFORMATICA')) return 'theme-informatica';
  if (s.includes('SCIENZE MOTORIE') || s.includes('ED. FISICA') || s.includes('PALESTRA')) return 'theme-motoria';
  if (s.includes('SCIENZE') || s.includes('CHIMICA')) return 'theme-scienze';
  if (s.includes('RELIGIONE')) return 'theme-religione';
  if (s.includes('TELECOMUNICAZIONI')) return 'theme-telecom';
  return 'theme-default';
}

/**
 * Restituisce l'indice del giorno della settimana (0 = Dom, 1 = Lun, ..., 6 = Sab)
 * in modo resiliente ad accenti (NFC/NFD), maiuscole/minuscole e abbreviazioni.
 */
export function getDayOfWeekIndex(dayName) {
  if (!dayName) return -1;
  const clean = dayName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const map = {
    'domenica': 0, 'dom': 0,
    'lunedi': 1, 'lun': 1,
    'martedi': 2, 'mar': 2,
    'mercoledi': 3, 'mer': 3,
    'giovedi': 4, 'gio': 4,
    'venerdi': 5, 'ven': 5,
    'sabato': 6, 'sab': 6
  };
  return map[clean] !== undefined ? map[clean] : -1;
}

/**
 * Confronta due nomi di giorno in modo canonico e resiliente
 */
export function areDaysEqual(dayA, dayB) {
  if (!dayA || !dayB) return false;
  const idxA = getDayOfWeekIndex(dayA);
  const idxB = getDayOfWeekIndex(dayB);
  if (idxA !== -1 && idxB !== -1) return idxA === idxB;
  return dayA.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() ===
         dayB.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

/**
 * Determina il giorno da visualizzare:
 * Mostra il giorno corrente fino alle 23:59 dello stesso giorno (giorno per giorno,
 * senza passare in anticipo al giorno successivo nel pomeriggio).
 * Nel weekend (Sabato non a calendario o Domenica) mostra di default Lunedì.
 */
export function getSmartDefaultDay(timetableDays, date = new Date()) {
  const dayIndex = date.getDay(); // 0 = Dom, 1 = Lun, ..., 6 = Sab
  const todayName = IT_DAYS[dayIndex];
  const availableDays = Array.isArray(timetableDays) && timetableDays.length > 0
    ? timetableDays.map(d => d.giorno)
    : null;

  // Se abbiamo i giorni effettivi dell'orario
  if (availableDays) {
    const foundToday = availableDays.find(d => areDaysEqual(d, todayName));
    if (foundToday) {
      return foundToday;
    }

    // Nel fine settimana o giorni senza lezioni a calendario (es. Domenica o Sabato libero)
    const foundMonday = availableDays.find(d => areDaysEqual(d, "Lunedì"));
    if (foundMonday) {
      return foundMonday;
    }

    return availableDays[0] || "Lunedì";
  }

  // Se il timetable non è ancora stato passato:
  // Nei giorni scolastici (Lunedì-Venerdì) seleziona il giorno odierno
  if (dayIndex >= 1 && dayIndex <= 5) {
    return todayName;
  }

  return "Lunedì";
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
  { ora: 6, start: '12:46', end: '13:36' },
  { ora: 7, start: '14:00', end: '14:50' },
  { ora: 8, start: '14:50', end: '15:40' },
  { ora: 9, start: '15:40', end: '16:30' }
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
          label: breakCount === 1 ? '1ª RICREAZIONE' : (breakCount === 2 ? '2ª RICREAZIONE' : (breakCount === 3 || h.endMin >= 800 ? 'PRANZO' : `${breakCount}ª RICREAZIONE`))
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
 * Aggiorna il cursore temporale e la timeline visuale nella vista Giorno.
 * La linea blu si ferma esattamente al bordo del blocco e non va sopra al testo.
 */
export function updateTimelineCursor(containerElement, now = new Date()) {
  if (!containerElement) return;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const cursorBadge = containerElement.querySelector('.live-cursor');
  const indicatorLine = containerElement.querySelector('.live-timeline-line');
  const rawRows = Array.from(containerElement.querySelectorAll('.timeline-lesson-row, .timeline-break-row'));

  if (rawRows.length === 0) return;

  // Reset stati attivi precedenti
  rawRows.forEach(row => {
    const card = row.querySelector('.lesson-card');
    if (card) card.classList.remove('is-active');
    const breakBar = row.querySelector('.timeline-break-bar');
    if (breakBar) breakBar.classList.remove('is-active-break');
  });

  // Ordina cronologicamente le righe in base a data-start
  const rows = rawRows
    .map(el => ({
      elem: el,
      start: timeToMinutes(el.getAttribute('data-start')),
      end: timeToMinutes(el.getAttribute('data-end')),
      isBreak: el.classList.contains('timeline-break-row')
    }))
    .filter(r => !isNaN(r.start) && !isNaN(r.end) && r.start < r.end)
    .sort((a, b) => a.start - b.start);

  if (rows.length === 0) return;

  const schoolStart = rows[0].start;
  const schoolEnd = Math.max(...rows.map(r => r.end));

  let targetTop = 0;
  let isVisible = false;
  let hasActiveBlock = false;

  // Verifica se il giorno mostrato corrisponde esattamente a oggi
  const dayOfWeek = now.getDay(); // 0 = Dom, 1 = Lun, ..., 6 = Sab
  const gridEl = containerElement.querySelector('.daily-timeline-grid');
  const displayedDay = gridEl ? gridEl.getAttribute('data-day') : null;
  const isViewingToday = !displayedDay || (getDayOfWeekIndex(displayedDay) === dayOfWeek);
  const isSchoolDay = dayOfWeek >= 1 && dayOfWeek <= 5;

  if (isViewingToday && isSchoolDay && currentMinutes >= schoolStart && currentMinutes <= schoolEnd) {
    // 1. Cerca prima un blocco attivo (lezione o ricreazione in corso)
    let activeRow = null;
    for (const r of rows) {
      if (currentMinutes >= r.start && currentMinutes < r.end) {
        activeRow = r;
        break;
      }
    }

    if (activeRow) {
      isVisible = true;
      const ratio = (currentMinutes - activeRow.start) / (activeRow.end - activeRow.start);
      targetTop = activeRow.elem.offsetTop + (activeRow.elem.offsetHeight * ratio);

      if (!activeRow.isBreak) {
        const card = activeRow.elem.querySelector('.lesson-card');
        if (card) {
          card.classList.add('is-active');
          hasActiveBlock = true;
          const timeLeftElem = card.querySelector('.time-left-text');
          if (timeLeftElem) {
            const rem = activeRow.end - currentMinutes;
            timeLeftElem.textContent = `Fine tra ${rem} min`;
          }
        }
      } else {
        const breakBar = activeRow.elem.querySelector('.timeline-break-bar');
        if (breakBar) {
          breakBar.classList.add('is-active-break');
          hasActiveBlock = true;
        }
      }
    } else {
      // 2. Se non siamo dentro un blocco, siamo in un cambio ora tra due blocchi consecutivi ordinati
      for (let i = 0; i < rows.length - 1; i++) {
        const cur = rows[i];
        const next = rows[i + 1];
        if (currentMinutes >= cur.end && currentMinutes < next.start) {
          isVisible = true;
          const ratio = (currentMinutes - cur.end) / (next.start - cur.end);
          const curBottom = cur.elem.offsetTop + cur.elem.offsetHeight;
          const nextTop = next.elem.offsetTop;
          targetTop = curBottom + ((nextTop - curBottom) * ratio);
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
        indicatorLine.style.right = '0';
        indicatorLine.style.width = 'auto';
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

  // Usa gli slot orari dell'asse sinistro (.grid-time-slot-box e .grid-break-time-label)
  // per determinare l'altezza fisica esatta e la scala verticale della griglia settimanale
  const axisSlots = Array.from(gridContainer.querySelectorAll('.grid-time-slot-box, .grid-break-time-label'))
    .map(el => ({
      elem: el,
      start: parseInt(el.getAttribute('data-start-min'), 10),
      end: parseInt(el.getAttribute('data-end-min'), 10)
    }))
    .filter(s => !isNaN(s.start) && !isNaN(s.end))
    .sort((a, b) => a.start - b.start);

  if (axisSlots.length === 0) return;

  const schoolStart = axisSlots[0].start;
  const schoolEnd = Math.max(...axisSlots.map(s => s.end));

  let isVisible = false;
  let targetTop = 0;

  if (isSchoolDay && currentMinutes >= schoolStart && currentMinutes <= schoolEnd) {
    // 1. Cerca lo slot dell'asse orario corrispondente
    for (let i = 0; i < axisSlots.length; i++) {
      const slot = axisSlots[i];
      if (currentMinutes >= slot.start && currentMinutes < slot.end) {
        isVisible = true;
        const top = slot.elem.offsetTop;
        const h = slot.elem.offsetHeight;
        const ratio = (currentMinutes - slot.start) / (slot.end - slot.start);
        targetTop = top + (h * ratio);
        break;
      } else if (i + 1 < axisSlots.length) {
        const nextSlot = axisSlots[i + 1];
        if (currentMinutes >= slot.end && currentMinutes < nextSlot.start) {
          isVisible = true;
          const btm = slot.elem.offsetTop + slot.elem.offsetHeight;
          const nextTop = nextSlot.elem.offsetTop;
          const ratio = (currentMinutes - slot.end) / (nextSlot.start - slot.end);
          targetTop = btm + ((nextTop - btm) * ratio);
          break;
        }
      }
    }

    // 2. Evidenzia le ricreazioni se attive
    const activeBreak = Array.from(gridContainer.querySelectorAll('.grid-cell-break')).find(b => {
      const s = parseInt(b.getAttribute('data-start-min'), 10);
      const e = parseInt(b.getAttribute('data-end-min'), 10);
      return currentMinutes >= s && currentMinutes < e;
    });
    if (activeBreak) {
      activeBreak.classList.add('is-active-break');
    }

    // 3. Evidenzia la cella lezione odierna in corso (confronto giorno robusto con getDayOfWeekIndex)
    const todayCells = Array.from(gridContainer.querySelectorAll('.grid-cell-lesson')).filter(cell => {
      const cellDay = cell.getAttribute('data-day');
      return getDayOfWeekIndex(cellDay) === dayOfWeek;
    });

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
  const activeCard = containerElement.querySelector('.lesson-card.is-active, .grid-cell-lesson.is-active-lesson');
  if (activeCard) {
    activeCard.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
}
