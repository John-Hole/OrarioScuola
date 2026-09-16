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

## 3. Widget su Schermata di Blocco & Always On Display (Galaxy S24 / One UI 6.1+)

Il Galaxy S24 supporta i **Lock Screen Widgets**:
1. Vai in **Impostazioni** sul Galaxy S24 &rarr; **Schermata di blocco e AOD**.
2. Tocca **Modifica schermata di blocco**.
3. Sotto l'orologio, tocca l'area **+ Aggiungi Widget**.
4. Seleziona **KWGT** e scegli il preset compatto (1x1 o 2x1) contenente la sola aula e materia corrente (es. `Sistemi - Lab B010`).
5. Abilita la visualizzazione dei widget anche su **Always On Display** nelle impostazioni AOD.

---

## 4. Frequenza di Aggiornamento & Risparmio Batteria

1. In KWGT &rarr; Impostazioni &rarr; **Modalità di aggiornamento**:
   - Imposta su **"Intelligente"** o ogni 10-15 minuti durante la fascia oraria 07:45 - 14:00.
2. Il file JSON pesa meno di 1 KB: consuma zero traffico dati e non riscalda la batteria rispetto ad app pesanti o geolocalizzazioni continue.
