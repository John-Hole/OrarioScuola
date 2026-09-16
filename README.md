# Smart School Timetable (Galaxy S24 + PWA + Gemini API)

Applicazione PWA moderna per l'orario scolastico con **Live Timeline** (stile Google Tasks/Calendar), estrazione automatica da immagini Spaggiari EDT con **Gemini Vision API** e feed dati in tempo reale per widget **Samsung Galaxy S24** (One UI / AOD).

---

## 🚀 Caratteristiche Principali

1. **PWA Mobile-First Ultra-Veloce:**
   - Funzionamento 100% offline grazie al Service Worker.
   - Installabile come app nativa standalone su Galaxy S24 e Android.
2. **Live Timeline & Cursore Dinamico:**
   - Asse temporale verticale con indicatore scorrevole che segue i minuti in tempo reale.
   - Smart Auto-Scroll: all'apertura dell'app tra le 08:00 e l'uscita da scuola, la lezione corrente viene posizionata automaticamente al centro dello schermo.
   - Smart Day Switcher: visualizzazione giorno per giorno, mantiene il giorno corrente visibile fino alle 23:59 dello stesso giorno (nel weekend visualizza di default lunedì).
3. **Pannello Laterale (Drawer):**
   - Selezione rapida della classe (predefinita: **4 BINF**).
   - Stato orario rilevato (es. *Orario provvisorio* o *Orario definitivo*).
   - Pulsante manuale *"Sincronizza / Forza Refresh"* per ricaricare le modifiche in qualsiasi momento con richiesta diretta a Gemini.
   - Sezione informativa Widget One UI e simulatore orario per collaudo rapido.
4. **Motore di Estrazione Multi-Modello (Gemini 3.8 Flash + Fallback):**
   - **Modello Principale:** `Gemini 3.8 Flash` per massima accuratezza visiva e comprensione tabelle complesse.
   - **Modello di Fallback:** `Gemini 3.5 Flash Lite` (con fallback secondario `Gemini 2.5 Flash`) in caso di picchi di carico (503/429).
   - **Doppia Scansione Mattutina ("Quando lo fa lui"):** 2 estrazioni indipendenti con controllo incrociato e algoritmo di riconciliazione automatica.
   - **Singola Scansione Manuale ("Quando lo faccio io"):** estrazione rapida e reattiva al tocco del pulsante nella PWA.
   - Caching intelligente (MD5 / Last-Modified / ETag) per evitare chiamate ridondanti.
   - Output strutturato JSON conforme a schema Pydantic.
5. **Widget per Samsung Galaxy S24:**
   - Endpoint `data/widget_data.json` per KWGT e One UI Lock Screen / Always On Display.
   - Risponde istantaneamente a: *"Dove devo andare adesso?"* (materia, aula, tempo residuo, cambio ora).
6. **Sincronizzazione Automatica Pianificata:**
   - GitHub Action con cron ogni lunedì alle 06:30 attivo fino al 31 Gennaio con **doppia scansione di verifica**.
   - Modalità manuale `workflow_dispatch` con opzione di scansione singola o doppia.

---

## 📁 Struttura del Progetto

```
OrarioScuola/
├── .github/
│   └── workflows/
│       └── scheduled_sync.yml     # Cron job lunedì mattina fino a fine gennaio
├── docs/
│   └── WIDGET_S24_SETUP.md        # Guida configurazione KWGT e One UI per Galaxy S24
├── public/
│   ├── css/
│   │   └── style.css              # Stili responsive mobile-first One UI style
│   ├── data/
│   │   ├── timetable.json         # Orario completo settimanale
│   │   └── widget_data.json       # Feed sintetico per widget S24
│   ├── icons/
│   │   └── icon.svg               # Icona PWA
│   ├── js/
│   │   ├── app.js                 # Controller principale PWA
│   │   ├── timeline.js            # Motore temporale e cursore dinamico
│   │   └── widget_helper.js       # Calcolo payload widget e formule KWGT
│   ├── index.html                 # Interfaccia PWA
│   ├── manifest.json              # Web App Manifest
│   └── sw.js                      # Service Worker offline
├── scripts/
│   ├── requirements.txt           # Dipendenze Python
│   └── sync_timetable.py          # Script Gemini Vision & generazione feed
└── README.md
```

---

## 🛠️ Come Eseguire in Locale

### 1. Avvio Server Locale & Sincronizzazione Live PWA
Avvia il server Python locale che supporta l'endpoint `/api/sync`:
```bash
python scripts/server.py
```
Oppure specificando una porta personalizzata:
```bash
set PORT=8080 && python scripts/server.py
```
Apri il browser su: `http://localhost:8080`.
Premendo il pulsante **"Sincronizza orario"** dal drawer laterale della PWA, verrà inviata automaticamente una richiesta al server locale per avviare la scansione Gemini e aggiornare l'interfaccia in tempo reale.

### 2. Esecuzione da Riga di Comando (CLI)
Installa i requisiti:
```bash
pip install -r scripts/requirements.txt
```

La chiave API e i modelli possono essere configurati direttamente nel file `.env`:
```env
GEMINI_API_KEY=la_tua_chiave_gemini
GEMINI_MAIN_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODEL=gemini-3.5-flash-lite
TIMETABLE_URL=https://scuola.../orario_4_BINF.png
```

- **Singola Scansione Manuale:**
```bash
python scripts/sync_timetable.py --scan-mode single --class-name "4 BINF"
```

- **Doppia Scansione con Controllo Incrociato (Automatica):**
```bash
python scripts/sync_timetable.py --scan-mode double --class-name "4 BINF"
```

- **Test Offline Immediato (dati mock, 0 chiamate API):**
```bash
python scripts/sync_timetable.py --mock
```

---

## 📱 Configurazione Widget su Galaxy S24
Consulta la guida completa in:
👉 **[docs/WIDGET_S24_SETUP.md](docs/WIDGET_S24_SETUP.md)**
