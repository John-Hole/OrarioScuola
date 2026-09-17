# Guida Widget Samsung Galaxy S24 (One UI) & Always On Display

Questa guida spiega come visualizzare l'orario scolastico intelligente in tempo reale direttamente sulla **Home Screen**, sulla **Schermata di Blocco** (Lock Screen) e sull'**Always On Display (AOD)** del tuo Samsung Galaxy S24.

---

## 1. Come Funziona l'Integrazione

L'applicazione genera e aggiorna continuamente un feed JSON ultra-leggero:
```
https://<tuo-dominio-o-ip>/data/widget_data.json
```

Questo endpoint risponde in tempo reale alla domanda: **"Dove devo andare adesso?"** fornendo:
- Durante l'ora di lezione: materia, aula, docenti, tempo alla fine.
- Durante l'intervallo / cambio d'ora: avviso cambio aula e materia successiva.
- Fuori dall'orario scolastico: avviso "Giornata terminata" e anteprima della prima ora del giorno successivo.
- Weekend: "Buon Fine Settimana" e riepilogo del Lunedì.

---

## 2. Metodo Consigliato: KWGT (Kustom Widget Maker)

KWGT è lo standard su Android per creare widget perfettamente integrati con il linguaggio grafico **One UI** di Samsung.

### Installazione
1. Scarica **KWGT Kustom Widget Maker** dal Google Play Store (e se desideri aggiornamenti in background rapidi, la chiave Pro).
2. Sulla schermata Home del Galaxy S24, tieni premuto su uno spazio vuoto, tocca **Widget** e aggiungi un riquadro **KWGT 4x2** (oppure **2x2**).

### Configurazione del Feed JSON
1. Tocca il widget vuoto per aprire l'editor KWGT.
2. Crea un **Testo** o usa un componente predefinito in stile One UI (sfondo scuro semitrasparente `#151C2C`, angoli arrotondati a 20dp).
3. Nelle proprietà del testo, usa le seguenti formule inserendo l'URL del tuo file `widget_data.json` al posto di `[URL_JSON]`:

| Informazione | Formula KWGT |
| :--- | :--- |
| **Materia in corso / Titolo** | `$wg("[URL_JSON]", json, .title)$` |
| **Aula o Laboratorio** | `$wg("[URL_JSON]", json, .room)$` |
| **Tempo rimanente (Countdown)** | `$wg("[URL_JSON]", json, .time_left)$` |
| **Sottotitolo / Prossima ora** | `$wg("[URL_JSON]", json, .subtitle)$` |
| **Badge di stato (IN CORSO, CAMBIO, FINITO)** | `$wg("[URL_JSON]", json, .badge)$` |
| **Ultimo orario di sync** | `$wg("[URL_JSON]", json, .updated_at)$` |

### Esempio Formula Composta per One UI:
```
$if(wg("[URL_JSON]", json, .status) = "IN_CLASS", 
    "🟢 " + wg("[URL_JSON]", json, .title) + " (" + wg("[URL_JSON]", json, .room) + ") - " + wg("[URL_JSON]", json, .time_left),
    "🔔 " + wg("[URL_JSON]", json, .title) + " - " + wg("[URL_JSON]", json, .subtitle)
)$
```

---

## ✈️ 3. Preset "Scalo Aereo / Volo" (Novità)

Questo preset trasforma il widget in una **carta d'imbarco / scalo aereo dinamico**:
`[MATERIA / AULA ATTUALE]  ─── ORARIO CAMBIO ✈ ───>  [PROSSIMA MATERIA / AULA]`

### ⏰ Comportamento Orario Intelligente (Trasparenza Automatica)
- **Prima delle 07:00 del mattino**: il widget è **100% trasparente / invisibile**.
- **Dalle 07:00 all'inizio della 1ª ora (es. 08:00)**:  
  `Casa [Partenza]  ── 08:00 ✈ ──>  1ª Materia [Aula]`
- **Durante le lezioni**:  
  `Materia Attuale [Aula]  ── Orario Cambio ✈ ──>  Prossima Materia [Aula]`
- **All'ultima ora di lezione (qualunque sia: 4ª ora alle 11:42, 6ª ora alle 13:36, 8ª ora alle 15:34)**:  
  `Ultima Materia [Aula]  ── Orario Uscita ✈ ──>  Casa [Uscita]`
- **Fino a 1 ora dopo l'uscita (es. fino alle 12:42)**:  
  `Scuola [Terminata]  ── Orario Uscita ✈ ──>  Casa [Rientro]`
- **Dopo 1 ora dall'uscita e nel weekend**:  
  Il widget si disattiva e torna automaticamente **trasparente / invisibile** fino alle 07:00 del giorno di scuola successivo!

---

### Opzione A: Formula Unica Compatta (Copia & Incolla su un Testo KWGT)

Crea un elemento **Testo** in KWGT e incolla:

```
$if(wg("[URL_JSON]", json, .flight_visible) = 1,
    wg("[URL_JSON]", json, .flight_multiline),
    ""
)$
```

Oppure in formato su **singola riga orizzontale**:
```
$if(wg("[URL_JSON]", json, .flight_visible) = 1,
    wg("[URL_JSON]", json, .flight_single_line),
    ""
)$
```

---

### Opzione B: Layout Grafico a 3 Colonne "Boarding Pass" (Raccomandato)

Per creare un widget spettacolare in KWGT diviso in 3 aree (Origine, Freccia centrale con orario sotto, Destinazione):

1. **Crea un Gruppo Sovrapposto (Overlap Group)** in KWGT.
2. Nella scheda **Livello** (Layer) &rarr; **Visibilità**, imposta la formula:
   ```
   $if(wg("[URL_JSON]", json, .flight_visible) = 1, ALWAYS, NEVER)$
   ```
   *(In questo modo, prima delle 07:00 o dopo 1 ora dall'uscita, l'intero widget sparisce automaticamente dallo schermo!)*
3. All'interno del gruppo, aggiungi un **Gruppo Lineare Orizzontale** con 3 blocchi:

| Colonna | Elemento | Formula KWGT |
| :--- | :--- | :--- |
| **1. Sinistra (Origine)** | **Materia/Titolo (sopra)** | `$wg("[URL_JSON]", json, .flight_origin_sub)$` |
| | **Aula/Classe (sotto)** | `$wg("[URL_JSON]", json, .flight_origin_room)$` |
| **2. Centro (Scalo)** | **Simbolo Volo (sopra)** | `────── ✈ ──────>` (oppure `✈ ➔`) |
| | **Orario Cambio (sotto)** | `$wg("[URL_JSON]", json, .flight_time)$` |
| **3. Destra (Arrivo)** | **Materia/Titolo (sopra)** | `$wg("[URL_JSON]", json, .flight_dest_sub)$` |
| | **Aula/Classe (sotto)** | `$wg("[URL_JSON]", json, .flight_dest_room)$` |

---

## 3. Widget su Schermata di Blocco & Always On Display (Galaxy S24 / One UI 6.1+)

> ⚠️ **Perché KWGT non appare direttamente nella schermata di blocco standard?**
> Su Samsung One UI 6.1 (Galaxy S24), l'area nativa "+ Widget" posta direttamente sotto l'orologio è limitata da Samsung **solo alle proprie app di sistema** (Meteo, Batteria, Calendario, Sveglia). Le app di terze parti come KWGT non compaiono in quella lista predefinita.

Per posizionare **KWGT** sulla Schermata di Blocco e sull'Always On Display del Galaxy S24 esistono due metodi:

### Metodo 1: Samsung Good Lock + LockStar (Consigliato, Ufficiale Samsung)
Samsung mette a disposizione sul **Galaxy Store** la suite ufficiale **Good Lock** che sblocca i widget di terze parti sulla schermata di blocco:
1. Apri il **Galaxy Store** sul tuo Galaxy S24 e cerca **Good Lock** (app gratuita ufficiale Samsung).
2. All'interno di Good Lock, trova e scarica il modulo **LockStar** (nella scheda *Make up*).
3. Apri **LockStar** e attiva l'interruttore in alto.
4. Tocca l'anteprima della **Schermata di Blocco** per entrare nell'editor.
5. Tocca un punto vuoto o l'icona **Aggiungi Widget**: qui comparirà l'elenco completo di tutte le app del telefono, incluso **KWGT**!
6. Scegli il widget KWGT (es. 2x1 o 4x1), posizionalo dove preferisci (sotto l'orologio o in basso) e tocca **Salva**.
7. Tocca il widget aggiunto sulla schermata di blocco per aprire KWGT e incollare la formula desiderata (es. Preset Volo).
8. *(Opzionale)* In LockStar puoi ripetere la stessa procedura anche per l'**Always On Display (AOD)**.

### Metodo 2: Widget Nativo Calendario Samsung (Senza Good Lock)
Se non vuoi installare Good Lock, puoi sfruttare il widget nativo di Samsung:
1. Nella web app OrarioScuola, esporta l'orario scolastico in formato **iCalendar (.ics)** o sincronizzalo con il tuo account Google/Samsung Calendar.
2. In **Impostazioni** &rarr; **Schermata di blocco** &rarr; **Modifica schermata di blocco** &rarr; tocca **+ Widget** sotto l'orologio.
3. Seleziona il widget nativo **Calendario (Prossimo evento)** di Samsung: mostrerà la materia, l'orario e l'aula direttamente sotto l'orologio.

---

## 4. Frequenza di Aggiornamento & Risparmio Batteria

1. In KWGT &rarr; Impostazioni &rarr; **Modalità di aggiornamento**:
   - Imposta su **"Intelligente"** o ogni 10-15 minuti durante la fascia oraria 07:45 - 14:00.
2. Il file JSON pesa meno di 1 KB: consuma zero traffico dati e non riscalda la batteria rispetto ad app pesanti o geolocalizzazioni continue.
