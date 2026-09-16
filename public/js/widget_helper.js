/**
 * widget_helper.js - Utilità di supporto e integrazione per Samsung Galaxy S24
 * Calcola i payload per KWGT / Lock screen e offre formule pronte per One UI.
 */

import { timeToMinutes } from './timeline.js';

export function generateKWGTCodeSnippet(jsonUrl) {
  return {
    materia_e_aula: `$wg("${jsonUrl}", json, .title)$ - $wg("${jsonUrl}", json, .room)$`,
    tempo_rimasto: `$wg("${jsonUrl}", json, .time_left)$`,
    prossima_materia: `$wg("${jsonUrl}", json, .next_title)$`,
    prossima_aula: `$wg("${jsonUrl}", json, .next_room)$`,
    stato_generale: `$wg("${jsonUrl}", json, .badge)$`
  };
}

export function computeClientWidgetState(timetable, simulatedDate = new Date()) {
  const itDays = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
  const dayIdx = simulatedDate.getDay();
  const currentMinutes = simulatedDate.getHours() * 60 + simulatedDate.getMinutes();
  const timeStr = `${String(simulatedDate.getHours()).padStart(2, '0')}:${String(simulatedDate.getMinutes()).padStart(2, '0')}`;

  const currentDayName = itDays[dayIdx];
  const dayData = (timetable.giorni || []).find(d => d.giorno === currentDayName);

  function getFirstOf(dayName) {
    const d = (timetable.giorni || []).find(x => x.giorno === dayName);
    return d && d.lezioni && d.lezioni.length > 0 ? d.lezioni[0] : null;
  }

  // Weekend
  if (dayIdx === 0 || dayIdx === 6) {
    const monFirst = getFirstOf("Lunedì");
    return {
      status: "WEEKEND",
      badge: "WEEKEND",
      title: "Buon Fine Settimana",
      subtitle: monFirst ? `Lunedì ore ${monFirst.inizio}: ${monFirst.materia} (${monFirst.aula})` : "Riposo",
      room: "",
      time_left: "",
      next_title: monFirst ? monFirst.materia : "",
      next_room: monFirst ? monFirst.aula : "",
      next_time: monFirst ? monFirst.inizio : "",
      updated_at: timeStr,
      class_name: timetable.classe || "4 BINF"
    };
  }

  if (!dayData || !dayData.lezioni || dayData.lezioni.length === 0) {
    return {
      status: "NO_LESSONS",
      badge: "LIBERO",
      title: "Nessuna lezione oggi",
      subtitle: "Nessun impegno a calendario",
      room: "",
      time_left: "",
      next_title: "",
      next_room: "",
      next_time: "",
      updated_at: timeStr,
      class_name: timetable.classe || "4 BINF"
    };
  }

  const lessons = dayData.lezioni;
  const firstStart = timeToMinutes(lessons[0].inizio);
  const lastEnd = timeToMinutes(lessons[lessons.length - 1].fine);

  const nextDayIdx = (dayIdx + 1) % 7;
  const nextDayName = itDays[nextDayIdx < 6 && nextDayIdx > 0 ? nextDayIdx : 1];
  const nextDayFirst = getFirstOf(nextDayName);
  const tomorrowPreview = nextDayFirst ? `${nextDayIdx === 1 ? 'Lunedì' : 'Domani'} ore ${nextDayFirst.inizio}: ${nextDayFirst.materia} (${nextDayFirst.aula})` : "Fine lezioni";

  if (currentMinutes < firstStart) {
    const rem = firstStart - currentMinutes;
    return {
      status: "BEFORE_SCHOOL",
      badge: "PRIMA ORA",
      title: lessons[0].materia,
      subtitle: `Inizio ore ${lessons[0].inizio} (tra ${rem} min)`,
      room: lessons[0].aula,
      time_left: `${rem}m all'inizio`,
      next_title: lessons[0].materia,
      next_room: lessons[0].aula,
      next_time: lessons[0].inizio,
      updated_at: timeStr,
      class_name: timetable.classe || "4 BINF"
    };
  }

  if (currentMinutes >= lastEnd) {
    return {
      status: "FINISHED",
      badge: "FINITO",
      title: "Giornata terminata!",
      subtitle: tomorrowPreview,
      room: "",
      time_left: "",
      next_title: nextDayFirst ? nextDayFirst.materia : "",
      next_room: nextDayFirst ? nextDayFirst.aula : "",
      next_time: nextDayFirst ? nextDayFirst.inizio : "",
      updated_at: timeStr,
      class_name: timetable.classe || "4 BINF"
    };
  }

  for (let i = 0; i < lessons.length; i++) {
    const s = timeToMinutes(lessons[i].inizio);
    const e = timeToMinutes(lessons[i].fine);

    if (currentMinutes >= s && currentMinutes < e) {
      const left = e - currentMinutes;
      const nextL = lessons[i + 1];
      return {
        status: "IN_CLASS",
        badge: "IN CORSO",
        title: lessons[i].materia,
        subtitle: nextL ? `Poi: ${nextL.materia} (${nextL.aula})` : "Ultima ora!",
        room: lessons[i].aula,
        time_left: `Fine tra ${left} min`,
        next_title: nextL ? nextL.materia : "Uscita",
        next_room: nextL ? nextL.aula : "",
        next_time: nextL ? nextL.inizio : lessons[i].fine,
        updated_at: timeStr,
        class_name: timetable.classe || "4 BINF"
      };
    }

    if (i + 1 < lessons.length) {
      const nextS = timeToMinutes(lessons[i + 1].inizio);
      if (currentMinutes >= e && currentMinutes < nextS) {
        const toNext = nextS - currentMinutes;
        const gap = nextS - e;
        const isRecess = gap >= 8;
        return {
          status: "BREAK",
          badge: isRecess ? "RICREAZIONE" : "CAMBIO ORA",
          title: isRecess ? "Ricreazione in corso" : `Prossima: ${lessons[i + 1].materia}`,
          subtitle: isRecess
            ? `Prossima: ${lessons[i + 1].materia} in ${lessons[i + 1].aula} (${toNext} min)`
            : `Inizio ore ${lessons[i + 1].inizio} (tra ${toNext} min)`,
          room: `Spostati in: ${lessons[i + 1].aula}`,
          time_left: `${toNext}m al suono`,
          next_title: lessons[i + 1].materia,
          next_room: lessons[i + 1].aula,
          next_time: lessons[i + 1].inizio,
          updated_at: timeStr,
          class_name: timetable.classe || "4 BINF"
        };
      }
    }
  }

  return {
    status: "UNKNOWN",
    badge: "SCUOLA",
    title: "Orario scolastico",
    subtitle: "",
    room: "",
    time_left: "",
    next_title: "",
    next_room: "",
    next_time: "",
    updated_at: timeStr,
    class_name: timetable.classe || "4 BINF"
  };
}
