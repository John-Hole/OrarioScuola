/**
 * api/extract.js - Vercel Serverless Function per Estrazione Orario con Gemini API
 * Riceve un'immagine/PDF (in Base64 o tramite URL) ed estrae la struttura oraria completa
 * con ore e minuti esatti di inizio/fine specifici dell'istituto scolastico.
 */

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

const TIMETABLE_SCHEMA = {
  type: "object",
  properties: {
    classe: { type: "string", description: "Classe scolastica rilevata (es. 4 BINF, 3 ALS, ecc.)" },
    istituto: { type: "string", description: "Nome dell'istituto o scuola se presente nel foglio" },
    stato_orario: { type: "string", description: "Stato (es. 'Orario Provvisorio' o 'Orario Definitivo')" },
    data_decorrenza: { type: "string", description: "Data da cui ha validità l'orario se presente" },
    data_aggiornamento: { type: "string", description: "Data o ora di aggiornamento/stampa dell'orario" },
    giorni: {
      type: "array",
      description: "Giorni della settimana presenti (Lunedì, Martedì, Mercoledì, Giovedì, Venerdì, Sabato)",
      items: {
        type: "object",
        properties: {
          giorno: { type: "string" },
          lezioni: {
            type: "array",
            items: {
              type: "object",
              properties: {
                ora: { type: "integer", description: "Numero ordinale dell'ora di lezione (1, 2, 3, ...)" },
                inizio: { type: "string", description: "Orario inizio in formato HH:MM (es. 08:00 o 08:15)" },
                fine: { type: "string", description: "Orario fine in formato HH:MM (es. 08:55 o 09:10)" },
                materia: { type: "string", description: "Nome della materia scolastica" },
                docenti: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "Cognome dei docenti" 
                },
                aula: { type: "string", description: "Codice aula o laboratorio" },
                is_lab: { type: "boolean", description: "True se è laboratorio o compresenza con due docenti" },
                note: { type: "string", description: "Eventuali note" }
              },
              required: ["ora", "inizio", "fine", "materia"]
            }
          }
        },
        required: ["giorno", "lezioni"]
      }
    }
  },
  required: ["classe", "giorni"]
};

const DEFAULT_SCHOOL_HOURS = [
  { ora: 1, start: '08:00', end: '08:54', startMin: 480, endMin: 534 },
  { ora: 2, start: '08:58', end: '09:48', startMin: 538, endMin: 588 },
  { ora: 3, start: '09:58', end: '10:48', startMin: 598, endMin: 648 },
  { ora: 4, start: '10:52', end: '11:42', startMin: 652, endMin: 702 },
  { ora: 5, start: '11:52', end: '12:42', startMin: 712, endMin: 762 },
  { ora: 6, start: '12:46', end: '13:36', startMin: 766, endMin: 816 }
];

function timeToMinutes(tStr) {
  if (!tStr) return 0;
  const clean = tStr.replace('h', ':').trim();
  const [h, m] = clean.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function normalizeTimetableMultiHourSlots(timetable) {
  if (!timetable || !Array.isArray(timetable.giorni)) return timetable;

  const knownHours = new Map();
  timetable.giorni.forEach(day => {
    (day.lezioni || []).forEach(l => {
      const ora = l.ora;
      const start = l.inizio;
      const end = l.fine;
      if (ora && start && end) {
        const sMin = timeToMinutes(start);
        const eMin = timeToMinutes(end);
        const dur = eMin - sMin;
        if (dur >= 30 && dur <= 65 && !knownHours.has(ora)) {
          knownHours.set(ora, { ora, start, end, startMin: sMin, endMin: eMin });
        }
      }
    });
  });

  DEFAULT_SCHOOL_HOURS.forEach(std => {
    if (!knownHours.has(std.ora)) knownHours.set(std.ora, { ...std });
  });

  const sortedSlots = Array.from(knownHours.values()).sort((a, b) => a.ora - b.ora);

  timetable.giorni.forEach(day => {
    const originalLessons = day.lezioni || [];
    const newLessons = [];
    const occupiedHours = new Set();

    originalLessons.forEach(l => {
      const sMin = timeToMinutes(l.inizio);
      const eMin = timeToMinutes(l.fine);
      const dur = eMin - sMin;

      if (dur > 65) {
        const matched = [];
        sortedSlots.forEach(slot => {
          const overlapStart = Math.max(sMin, slot.startMin);
          const overlapEnd = Math.min(eMin, slot.endMin);
          const overlap = overlapEnd - overlapStart;
          if (overlap >= 25) matched.push(slot);
        });

        if (matched.length > 1) {
          matched.forEach(slot => {
            if (!occupiedHours.has(slot.ora)) {
              newLessons.push({
                ...l,
                ora: slot.ora,
                inizio: slot.start,
                fine: slot.end
              });
              occupiedHours.add(slot.ora);
            }
          });
          return;
        }
      }

      if (l.ora && !occupiedHours.has(l.ora)) {
        newLessons.push({ ...l });
        occupiedHours.add(l.ora);
      } else if (!l.ora) {
        newLessons.push({ ...l });
      }
    });

    newLessons.sort((a, b) => (a.ora || 0) - (b.ora || 0));
    day.lezioni = newLessons;
  });

  return timetable;
}

const PROMPT_INSTRUCTIONS = `
Sei un assistente specializzato nell'estrazione precisa di tabelle orario scolastiche da immagini e documenti PDF (es. Spaggiari, EDT, Argo, circolari scolastiche).
Analizza attentamente il documento fornito ed estrai la struttura oraria completa.

REGOLE CRUCIALI:
1. Rileva gli ORARI ESATTI di inizio e fine per ciascuna ora (1ª, 2ª, 3ª...) esattamente come scritti nell'intestazione o a lato della tabella (es. 08:00-08:54, 08:58-09:48, 09:58-10:48, 10:52-11:42, ecc.). NON inventare gli orari, leggi quelli reali!
2. Rileva tutti i giorni della settimana presenti (Lunedì, Martedì, Mercoledì, Giovedì, Venerdì, Sabato).
3. CELLE UNITE VERTICALMENTE / ORE DOPPIE (CRUCIALE):
   Se una materia occupa un riquadro verticale unico che copre DUE O PIÙ ORE CONSECUTIVE (es. laboratorio o palestra, come 09:58-11:42 che attraversa la 3ª e la 4ª ora, o 08:00-09:48 che copre la 1ª e la 2ª ora):
   DEVI GENERARE UNA VOCE SEPARATA PER CIASCUNA ORA DI LEZIONE (con stessa materia, aula e docenti).
   Esempio per blocco 09:58 - 11:42:
   - una lezione per la 3ª ora ("ora": 3, "inizio": "09:58", "fine": "10:48")
   - una lezione per la 4ª ora ("ora": 4, "inizio": "10:52", "fine": "11:42")
   NON saltare mai ore e non unire più ore in un solo slot. Ogni giorno deve avere tutte le ore in sequenza (1, 2, 3, 4...).
4. Per ogni ora di lezione:
   - "ora": numero intero 1, 2, 3, 4, 5, 6, 7...
   - "inizio": HH:MM
   - "fine": HH:MM
   - "materia": nome chiaro della materia (es. INFORMATICA, MATEMATICA, SISTEMI E RETI). Se la cella è vuota o ora libera, ometti la lezione o imposta materia a "LIBERO".
   - "docenti": lista con i cognomi dei docenti indicati nella cella. Se in laboratorio / compresenza, includi tutti i docenti presenti.
   - "aula": codice aula/laboratorio se presente (es. "B 010", "B 045 - P.T. EST", "C 170").
   - "is_lab": true se ci sono due docenti in compresenza o la dicitura LAB.
5. Se ci sono più classi nel documento e l'utente ha specificato una classe target, estrai quella. Altrimenti estrai la classe principale visibile.
6. Rispondi RIGOROSAMENTE con il JSON conforme allo schema richiesto.
`;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito. Utilizzare POST.' });
  }

  try {
    const { imageBase64, mimeType, imageUrl, targetClass, apiKey: clientApiKey } = req.body || {};

    const apiKey = clientApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ 
        error: 'Chiave GEMINI_API_KEY non configurata sul server né fornita dal client.' 
      });
    }

    let inlineData = null;

    if (imageBase64) {
      inlineData = {
        mimeType: mimeType || 'image/png',
        data: imageBase64.replace(/^data:[^;]+;base64,/, '')
      };
    } else if (imageUrl) {
      const response = await fetch(imageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (!response.ok) {
        throw new Error(`Impossibile scaricare il file dall'URL specificato (HTTP ${response.status})`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fetchedMime = response.headers.get('content-type') || 'image/png';

      inlineData = {
        mimeType: fetchedMime.includes('pdf') ? 'application/pdf' : 'image/png',
        data: buffer.toString('base64')
      };
    } else {
      return res.status(400).json({ error: 'Fornire imageBase64 oppure imageUrl.' });
    }

    let promptText = PROMPT_INSTRUCTIONS;
    if (targetClass) {
      promptText += `\nClasse specifica da estrarre con priorità: "${targetClass}".`;
    }

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: inlineData.mimeType,
                data: inlineData.data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: TIMETABLE_SCHEMA
      }
    };

    const mainModel = process.env.GEMINI_MAIN_MODEL || 'gemini-3.8-flash';
    const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite';
    const modelsToTry = [mainModel, fallbackModel, 'gemini-3.6-flash', 'gemini-2.5-flash'];

    let candidateText = null;
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          candidateText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            break;
          }
        } else {
          const errBody = await geminiRes.text();
          lastError = `${geminiRes.status}: ${errBody}`;
          console.warn(`[GEMINI WARN] Model ${model} failed:`, lastError);
        }
      } catch (e) {
        lastError = e.message;
        console.warn(`[GEMINI WARN] Model ${model} exception:`, e.message);
      }
    }

    if (!candidateText) {
      return res.status(500).json({
        error: 'Errore durante la chiamata ai modelli Gemini',
        details: lastError
      });
    }

    const parsedTimetable = JSON.parse(candidateText);

    // Inserisci data estrazione
    parsedTimetable.data_aggiornamento = parsedTimetable.data_aggiornamento || new Date().toLocaleDateString('it-IT');
    const normalizedTimetable = normalizeTimetableMultiHourSlots(parsedTimetable);

    return res.status(200).json({
      success: true,
      timetable: normalizedTimetable
    });

  } catch (error) {
    console.error('[API EXTRACT ERROR]', error);
    return res.status(500).json({
      error: error.message || 'Errore durante l\'elaborazione dell\'orario'
    });
  }
}
