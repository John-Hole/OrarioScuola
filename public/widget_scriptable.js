// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: graduation-cap;

/**
 * OrarioScuola - Scriptable Widget per iPhone / iPad
 * Supporta widget Piccolo, Medio e Lock Screen (Schermata di blocco iOS 16+)
 */

// ⚙️ CONFIGURAZIONE: Inserisci l'URL del tuo sito (es. Vercel o locale)
const BASE_URL = "https://tuo-dominio.vercel.app"; 
const TIMETABLE_URL = `${BASE_URL}/data/timetable.json`;
const WIDGET_DATA_URL = `${BASE_URL}/data/widget_data.json`;

// Nome file cache locale
const CACHE_FILE = "timetable_cache.json";

// Giorni in italiano
const IT_DAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

function timeToMinutes(str) {
  if (!str) return 0;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

// Carica l'orario (con supporto cache offline in locale sull'iPhone)
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

  // Fallback su widget_data.json sintetico
  try {
    const req = new Request(WIDGET_DATA_URL);
    return await req.loadJSON();
  } catch (e) {
    return null;
  }
}

// Calcola lo stato esatto in tempo reale al minuto corrente
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

  // Weekend
  if (dayIdx === 0 || dayIdx === 6) {
    const monFirst = getFirstOf("Lunedì");
    return {
      badge: "WEEKEND",
      title: "Buon Fine Settimana!",
      subtitle: monFirst ? `Lunedì ore ${monFirst.inizio}: ${monFirst.materia} (${monFirst.aula})` : "Riposo",
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
  const tomorrowPreview = nextDayFirst ? `${nextDayIdx === 1 ? 'Lunedì' : 'Domani'} ${nextDayFirst.inizio}: ${nextDayFirst.materia} (${nextDayFirst.aula})` : "Fine lezioni";

  // Prima di scuola
  if (currentMinutes < firstStart) {
    const rem = firstStart - currentMinutes;
    return {
      badge: "PRIMA ORA",
      title: lessons[0].materia,
      subtitle: `Inizio ore ${lessons[0].inizio} (tra ${rem} min)`,
      room: lessons[0].aula,
      timeLeft: `tra ${rem}m`,
      accentColor: "#007AFF"
    };
  }

  // Fine giornata
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

  // Durante la mattinata scolastica
  for (let i = 0; i < lessons.length; i++) {
    const s = timeToMinutes(lessons[i].inizio);
    const e = timeToMinutes(lessons[i].fine);

    if (currentMinutes >= s && currentMinutes < e) {
      const left = e - currentMinutes;
      const nextL = lessons[i + 1];
      return {
        badge: "IN CORSO",
        title: lessons[i].materia,
        subtitle: nextL ? `Poi: ${nextL.materia} (${nextL.aula})` : "Ultima ora!",
        room: lessons[i].aula,
        timeLeft: `${left} min rimasti`,
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
          subtitle: `Prossima: ${lessons[i + 1].materia} in ${lessons[i + 1].aula}`,
          room: lessons[i + 1].aula,
          timeLeft: `tra ${toNext}m`,
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

// Costruzione del Widget iOS
async function createWidget() {
  const timetable = await loadTimetable();
  const state = computeState(timetable);

  const listWidget = new ListWidget();
  listWidget.url = BASE_URL; // Al tocco apre la PWA
  listWidget.setPadding(14, 14, 14, 14);

  // Sfondo scuro moderno in stile iOS Dark Mode
  const gradient = new LinearGradient();
  gradient.locations = [0, 1];
  gradient.colors = [new Color("#1C1C1E"), new Color("#121214")];
  listWidget.backgroundGradient = gradient;

  // Header con Badge e orario
  const headerStack = listWidget.addStack();
  headerStack.layoutHorizontally();
  headerStack.centerAlignContent();

  const badgeText = headerStack.addText(state.badge.toUpperCase());
  badgeText.font = Font.boldSystemFont(10);
  badgeText.textColor = new Color(state.accentColor);

  headerStack.addSpacer();

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const timeText = headerStack.addText(timeStr);
  timeText.font = Font.systemFont(11);
  timeText.textColor = new Color("#8E8E93");

  listWidget.addSpacer(8);

  // Titolo Materia
  const titleText = listWidget.addText(state.title);
  titleText.font = Font.boldSystemFont(16);
  titleText.textColor = Color.white();
  titleText.lineLimit = 1;

  listWidget.addSpacer(4);

  // Aula e Tempo Rimanente (se presenti)
  if (state.room || state.timeLeft) {
    const infoStack = listWidget.addStack();
    infoStack.layoutHorizontally();
    infoStack.centerAlignContent();

    if (state.room) {
      const roomText = infoStack.addText(`📍 ${state.room}`);
      roomText.font = Font.semiboldSystemFont(13);
      roomText.textColor = new Color("#64D2FF");
    }

    if (state.room && state.timeLeft) {
      infoStack.addSpacer(8);
    }

    if (state.timeLeft) {
      const leftText = infoStack.addText(`⏱️ ${state.timeLeft}`);
      leftText.font = Font.systemFont(13);
      leftText.textColor = new Color("#FFD60A");
    }
  }

  listWidget.addSpacer(6);

  // Sottotitolo / Prossima ora
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
  // Test interattivo nell'app Scriptable
  await widget.presentMedium();
}
Scriptable.complete();
