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

const PROMPT_INSTRUCTIONS = `
Sei un assistente specializzato nell'estrazione precisa di tabelle orario scolastiche da immagini e documenti PDF (es. Spaggiari, EDT, Argo, circolari scolastiche).
Analizza attentamente il documento fornito ed estrai la struttura oraria completa.

REGOLE CRUCIALI:
1. Rileva gli ORARI ESATTI di inizio e fine per ciascuna ora (1ª, 2ª, 3ª...) esattamente come scritti nell'intestazione o a lato della tabella (es. 08:00-08:55, 08:15-09:10, ecc.). NON inventare gli orari, leggi quelli reali!
2. Rileva tutti i giorni della settimana presenti (Lunedì, Martedì, Mercoledì, Giovedì, Venerdì, Sabato).
3. Per ogni ora di lezione:
   - "ora": numero intero 1, 2, 3, 4, 5, 6, 7...
   - "inizio": HH:MM
   - "fine": HH:MM
   - "materia": nome chiaro della materia (es. INFORMATICA, MATEMATICA, SISTEMI E RETI). Se la cella è vuota o ora libera, ometti la lezione o imposta materia a "LIBERO".
   - "docenti": lista con i cognomi dei docenti indicati nella cella.
   - "aula": codice aula/laboratorio se presente (es. "B 010", "LAB INF", "AULA 12").
   - "is_lab": true se ci sono due docenti in compresenza o la dicitura LAB.
4. Se ci sono più classi nel documento e l'utente ha specificato una classe target, estrai quella. Altrimenti estrai la classe principale visibile.
5. Rispondi RIGOROSAMENTE con il JSON conforme allo schema richiesto.
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

    return res.status(200).json({
      success: true,
      timetable: parsedTimetable
    });

  } catch (error) {
    console.error('[API EXTRACT ERROR]', error);
    return res.status(500).json({
      error: error.message || 'Errore durante l\'elaborazione dell\'orario'
    });
  }
}
