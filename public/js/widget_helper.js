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

/**
 * Genera il codice JavaScript pronto all'uso per l'app iOS Scriptable,
 * con l'URL base configurato dinamicamente.
 */
export function generateScriptableCode(baseUrl) {
  const cleanBaseUrl = (baseUrl || window.location.origin).replace(/\/$/, '');
  return `// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: graduation-cap;

/**
 * OrarioScuola - Scriptable Widget per iPhone / iPad
 * Supporta widget Piccolo, Medio e Lock Screen (Schermata di blocco iOS 16+)
 */

const BASE_URL = "${cleanBaseUrl}"; 
const TIMETABLE_URL = \`\${BASE_URL}/data/timetable.json\`;
const WIDGET_DATA_URL = \`\${BASE_URL}/data/widget_data.json\`;

const CACHE_FILE = "timetable_cache.json";
const IT_DAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

function timeToMinutes(str) {
  if (!str) return 0;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

async function loadTimetable() {
  const fm = FileManager.local();
  const cachePath = fm.joinPath(fm.documentsDirectory(), CACHE_FILE);

  try {
    const req = new Request(TIMETABLE_URL);
    req.timeoutInterval = 5;
    const data = await req.loadJSON();
    fm.writeString(cachePath, JSON.stringify(data));
    return data;
  } catch (err) {
    if (fm.fileExists(cachePath)) {
      return JSON.parse(fm.readString(cachePath));
    }
  }

  try {
    const req = new Request(WIDGET_DATA_URL);
    return await req.loadJSON();
  } catch (e) {
    return null;
  }
}

function computeState(timetable, date = new Date()) {
  if (!timetable || !timetable.giorni) {
    return {
      badge: "OFFLINE",
      title: "Orario non disponibile",
      subtitle: "Apri l'app per aggiornare",
      room: "",
      timeLeft: "",
      accentColor: "#8E8E93"
    };
  }

  const dayIdx = date.getDay();
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const currentDayName = IT_DAYS[dayIdx];
  const dayData = timetable.giorni.find(d => d.giorno === currentDayName);

  function getFirstOf(dayName) {
    const d = timetable.giorni.find(x => x.giorno === dayName);
    return d && d.lezioni && d.lezioni.length > 0 ? d.lezioni[0] : null;
  }

  if (dayIdx === 0 || dayIdx === 6) {
    const monFirst = getFirstOf("Lunedì");
    return {
      badge: "WEEKEND",
      title: "Buon Fine Settimana!",
      subtitle: monFirst ? \`Lunedì ore \${monFirst.inizio}: \${monFirst.materia} (\${monFirst.aula})\` : "Riposo",
      room: "",
      timeLeft: "",
      accentColor: "#5856D6"
    };
  }

  if (!dayData || !dayData.lezioni || dayData.lezioni.length === 0) {
    return {
      badge: "LIBERO",
      title: "Nessuna lezione oggi",
      subtitle: "Giornata libera da calendario",
      room: "",
      timeLeft: "",
      accentColor: "#34C759"
    };
  }

  const lessons = dayData.lezioni;
  const firstStart = timeToMinutes(lessons[0].inizio);
  const lastEnd = timeToMinutes(lessons[lessons.length - 1].fine);

  const nextDayIdx = (dayIdx + 1) % 7;
  const nextDayName = IT_DAYS[nextDayIdx < 6 && nextDayIdx > 0 ? nextDayIdx : 1];
  const nextDayFirst = getFirstOf(nextDayName);
  const tomorrowPreview = nextDayFirst ? \`\${nextDayIdx === 1 ? 'Lunedì' : 'Domani'} \${nextDayFirst.inizio}: \${nextDayFirst.materia} (\${nextDayFirst.aula})\` : "Fine lezioni";

  if (currentMinutes < firstStart) {
    const rem = firstStart - currentMinutes;
    return {
      badge: "PRIMA ORA",
      title: lessons[0].materia,
      subtitle: \`Inizio ore \${lessons[0].inizio} (tra \${rem} min)\`,
      room: lessons[0].aula,
      timeLeft: \`tra \${rem}m\`,
      accentColor: "#007AFF"
    };
  }

  if (currentMinutes >= lastEnd) {
    return {
      badge: "FINITO",
      title: "Giornata terminata!",
      subtitle: tomorrowPreview,
      room: "",
      timeLeft: "A casa",
      accentColor: "#FF9500"
    };
  }

  for (let i = 0; i < lessons.length; i++) {
    const s = timeToMinutes(lessons[i].inizio);
    const e = timeToMinutes(lessons[i].fine);

    if (currentMinutes >= s && currentMinutes < e) {
      const left = e - currentMinutes;
      const nextL = lessons[i + 1];
      return {
        badge: "IN CORSO",
        title: lessons[i].materia,
        subtitle: nextL ? \`Poi: \${nextL.materia} (\${nextL.aula})\` : "Ultima ora!",
        room: lessons[i].aula,
        timeLeft: \`\${left} min rimasti\`,
        accentColor: "#30D158"
      };
    }

    if (i + 1 < lessons.length) {
      const nextS = timeToMinutes(lessons[i + 1].inizio);
      if (currentMinutes >= e && currentMinutes < nextS) {
        const toNext = nextS - currentMinutes;
        const isRecess = (nextS - e) >= 8;
        return {
          badge: isRecess ? "RICREAZIONE" : "CAMBIO ORA",
          title: isRecess ? "Ricreazione" : lessons[i + 1].materia,
          subtitle: \`Prossima: \${lessons[i + 1].materia} in \${lessons[i + 1].aula}\`,
          room: lessons[i + 1].aula,
          timeLeft: \`tra \${toNext}m\`,
          accentColor: "#FF9F0A"
        };
      }
    }
  }

  return {
    badge: "SCUOLA",
    title: "Orario scolastico",
    subtitle: "",
    room: "",
    timeLeft: "",
    accentColor: "#0A84FF"
  };
}

async function createWidget() {
  const timetable = await loadTimetable();
  const state = computeState(timetable);

  const listWidget = new ListWidget();
  listWidget.url = BASE_URL;
  listWidget.setPadding(14, 14, 14, 14);

  const gradient = new LinearGradient();
  gradient.locations = [0, 1];
  gradient.colors = [new Color("#1C1C1E"), new Color("#121214")];
  listWidget.backgroundGradient = gradient;

  const headerStack = listWidget.addStack();
  headerStack.layoutHorizontally();
  headerStack.centerAlignContent();

  const badgeText = headerStack.addText(state.badge.toUpperCase());
  badgeText.font = Font.boldSystemFont(10);
  badgeText.textColor = new Color(state.accentColor);

  headerStack.addSpacer();

  const now = new Date();
  const timeStr = \`\${String(now.getHours()).padStart(2, '0')}:\${String(now.getMinutes()).padStart(2, '0')}\`;
  const timeText = headerStack.addText(timeStr);
  timeText.font = Font.systemFont(11);
  timeText.textColor = new Color("#8E8E93");

  listWidget.addSpacer(8);

  const titleText = listWidget.addText(state.title);
  titleText.font = Font.boldSystemFont(16);
  titleText.textColor = Color.white();
  titleText.lineLimit = 1;

  listWidget.addSpacer(4);

  if (state.room || state.timeLeft) {
    const infoStack = listWidget.addStack();
    infoStack.layoutHorizontally();
    infoStack.centerAlignContent();

    if (state.room) {
      const roomText = infoStack.addText(\`📍 \${state.room}\`);
      roomText.font = Font.semiboldSystemFont(13);
      roomText.textColor = new Color("#64D2FF");
    }

    if (state.room && state.timeLeft) {
      infoStack.addSpacer(8);
    }

    if (state.timeLeft) {
      const leftText = infoStack.addText(\`⏱️ \${state.timeLeft}\`);
      leftText.font = Font.systemFont(13);
      leftText.textColor = new Color("#FFD60A");
    }
  }

  listWidget.addSpacer(6);

  if (state.subtitle) {
    const subText = listWidget.addText(state.subtitle);
    subText.font = Font.systemFont(12);
    subText.textColor = new Color("#EBEBF5", 0.7);
    subText.lineLimit = 1;
  }

  return listWidget;
}

const widget = await createWidget();

if (config.runsInWidget) {
  Scriptable.setWidget(widget);
} else {
  await widget.presentMedium();
}
Scriptable.complete();
`;
}

