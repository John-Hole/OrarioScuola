# Guida Widget per iPhone (iOS 16+) & Schermata di Blocco

Questa guida spiega come visualizzare l'orario scolastico intelligente in tempo reale sulla **Schermata Home** e sulla **Schermata di Blocco** (Lock Screen / Always On Display) del tuo **iPhone** o iPad.

Mentre su Android (Galaxy S24) si usa KWGT, su iOS sono disponibili due soluzioni eccellenti per connettersi al nostro feed JSON:

1. **Metodo 1 (Consigliatissimo & 100% Gratuito): Scriptable**  
   Permette di creare widget nativi eleganti con codice JavaScript. Ha un enorme vantaggio: memorizza l'orario in locale e **continua a calcolare l'ora, l'aula e il countdown anche se a scuola non c'è campo o connessione cellulare**.
2. **Metodo 2: Widgy Widgets**  
   È l'equivalente diretto di KWGT per iOS: interfaccia grafica visuale drag-and-drop che legge direttamente i campi di `widget_data.json`.
3. **Metodo 3: Icona App PWA (Safari)**  
   Per avere l'app a schermo intero senza barre del browser.

---

## 📱 Metodo 1: Scriptable (Consigliato)

### 1. Scarica Scriptable
Scarica gratuitamente **Scriptable** dall'App Store:  
👉 [Scriptable sull'App Store](https://apps.apple.com/app/scriptable/id1405459188) (nessun abbonamento richiesto).

---

### 2. Crea lo Script nell'App Scriptable
1. Apri l'app **Scriptable** sul tuo iPhone.
2. Tocca il tasto **`+`** in alto a destra per creare un nuovo script.
3. Rinomina lo script in alto (es. `OrarioScuola`).
4. Sostituisci tutto il codice presente incollando lo script seguente.
5. Modifica solo la riga `BASE_URL` inserendo l'indirizzo del tuo sito Vercel (es. `https://tuo-orario.vercel.app`):

```javascript
// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: graduation-cap;

/**
 * OrarioScuola - Scriptable Widget per iPhone
 * Supporta: Widget Piccolo, Widget Medio e Lock Screen (Schermata di blocco)
 */

// ⚙️ CONFIGURAZIONE: Inserisci l'URL del tuo sito (es. Vercel)
const BASE_URL = "https://tuo-dominio.vercel.app"; 
const TIMETABLE_URL = `${BASE_URL}/data/timetable.json`;
const WIDGET_DATA_URL = `${BASE_URL}/data/widget_data.json`;

// Nome file per la cache offline
const CACHE_FILE = "timetable_cache.json";

// Giorni in italiano
const IT_DAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

function timeToMinutes(str) {
  if (!str) return 0;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

// Carica l'orario (con supporto cache offline)
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

// Calcola lo stato esatto in tempo reale
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

// Costruzione visuale del Widget iOS
async function createWidget() {
  const timetable = await loadTimetable();
  const state = computeState(timetable);

  const listWidget = new ListWidget();
  listWidget.url = BASE_URL; // Al tocco apre la PWA
  listWidget.setPadding(14, 14, 14, 14);

  // Sfondo scuro elegante in stile iOS Dark Mode
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
  // Test interattivo nell'app
  await widget.presentMedium();
}
Scriptable.complete();
```

---

### 3. Aggiungi il Widget alla Schermata Home
1. Sulla Schermata Home del tuo iPhone, tieni premuto su uno spazio vuoto finché le icone non iniziano a ballare (modalità jiggle).
2. Tocca il tasto **`+`** in alto a sinistra.
3. Cerca **Scriptable** e selezionalo.
4. Scegli la dimensione:
   - **Medio (2x2 orizzontale)**: raccomandato, mostra materia, aula, tempo rimasto e prossima ora.
   - **Piccolo (1x1 quadrato)**: compatto per la sola materia e aula.
5. Tocca **Aggiungi widget**.
6. Tocca il widget appena aggiunto per aprirne le impostazioni:
   - Su **Script**, seleziona `OrarioScuola`.
   - Su **When Interacting**, seleziona `Open URL` (aprirà direttamente l'app dell'orario).

---

### 4. Widget su Schermata di Blocco (iOS 16+ / Always On Display)
1. Nella Schermata di Blocco dell'iPhone, tieni premuto e tocca **Personalizza**.
2. Tocca **Schermata di blocco**.
3. Sotto l'orologio, tocca **+ Aggiungi widget** e scegli **Scriptable**.
4. Seleziona il formato **Rettangolare**.
5. Toccalo e seleziona lo script `OrarioScuola`.

---

## 🎨 Metodo 2: Widgy Widgets (Editor Visuale stile KWGT)

Se preferisci un'interfaccia visiva simile a quella di KWGT su Samsung:

1. Scarica **Widgy Widgets** dall'App Store:  
   👉 [Widgy sull'App Store](https://apps.apple.com/app/widgy-widgets/id1524540481)
2. Apri Widgy e tocca **Create &rarr; Create New Widget** (scegli dimensione Media o Piccola).
3. Aggiungi un elemento di tipo **Text (Testo)**.
4. Nella scheda **Data**, scorri fino a **JSON Endpoint**:
   - Inserisci l'URL: `https://tuo-dominio.vercel.app/data/widget_data.json`
   - Nel selettore dei campi, scegli:
     - Per il titolo: `title`
     - Per l'aula: `room`
     - Per il tempo residuo: `time_left`
     - Per la prossima ora: `subtitle`
5. Assegna il widget a uno slot vuoto e aggiungilo alla Schermata Home dal menu `+`.

---

## 🌐 Metodo 3: Aggiungi come App PWA su Schermata Home

Oltre al widget, per aprire rapidamente l'orario completo:
1. Apri **Safari** sul tuo iPhone e vai al link del tuo sito (es. `https://tuo-sito.vercel.app`).
2. Tocca il pulsante **Condividi** (il quadrato con la freccia rivolta verso l'alto al centro in basso).
3. Scorri verso il basso e seleziona **Aggiungi alla schermata Home**.
4. Tocca **Aggiungi** in alto a destra.

L'applicazione funzionerà come un'app iOS nativa a tutto schermo, con notifiche e cache offline completa.
