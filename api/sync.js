/**
 * api/sync.js - Vercel Serverless Function per /api/sync
 * Sincronizzazione in tempo reale con l'orario ufficiale Spaggiari EDT.
 * Scarica l'immagine live da Spaggiari, verifica l'hash MD5 e, se aggiornata o forzata,
 * esegue l'estrazione visiva con Gemini API restituendo l'orario aggiornato con classi pulite.
 */

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { cleanRoom } from '../public/js/subject_normalizer.js';

const CLASS_SPAGGIARI_MAP = {
  '4 BINF': 'https://cspace.spaggiari.eu/pub/PGIT0005/orario/classi/edc0000119p00001s3fffffffffffffff_4_binf_ac.png'
};

function hasLessons(timetable) {
  return Boolean(
    timetable &&
    Array.isArray(timetable.giorni) &&
    timetable.giorni.some(d => Array.isArray(d?.lezioni) && d.lezioni.length > 0)
  );
}

const DEFAULT_SCHOOL_HOURS = [
  { ora: 1, start: '08:00', end: '08:54', startMin: 480, endMin: 534 },
  { ora: 2, start: '08:58', end: '09:48', startMin: 538, endMin: 588 },
  { ora: 3, start: '09:58', end: '10:48', startMin: 598, endMin: 648 },
  { ora: 4, start: '10:52', end: '11:42', startMin: 652, endMin: 702 },
  { ora: 5, start: '11:52', end: '12:42', startMin: 712, endMin: 762 },
  { ora: 6, start: '12:46', end: '13:36', startMin: 766, endMin: 816 },
  { ora: 7, start: '14:00', end: '14:50', startMin: 840, endMin: 890 },
  { ora: 8, start: '14:50', end: '15:40', startMin: 890, endMin: 940 },
  { ora: 9, start: '15:40', end: '16:30', startMin: 940, endMin: 990 }
];

function timeToMinutes(tStr) {
  if (!tStr) return 0;
  const clean = tStr.replace('h', ':').trim();
  const [h, m] = clean.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function normalizeTimetableMultiHourSlots(timetable) {
  if (!timetable || !Array.isArray(timetable.giorni)) return timetable;

  const recessRegex = /ricreazion|intervallo|pausa\s*pranzo/i;
  timetable.giorni.forEach(day => {
    if (Array.isArray(day.lezioni)) {
      day.lezioni = day.lezioni.filter(l => !recessRegex.test(l.materia || ''));
      day.lezioni.sort((a, b) => (timeToMinutes(a.inizio) || 0) - (timeToMinutes(b.inizio) || 0));
      day.lezioni.forEach((l, idx) => {
        const sMin = timeToMinutes(l.inizio);
        const matchedStd = DEFAULT_SCHOOL_HOURS.find(std => Math.abs(std.startMin - sMin) <= 10);
        if (matchedStd) {
          l.ora = matchedStd.ora;
        } else if (!l.ora || l.ora > idx + 1) {
          l.ora = idx + 1;
        }
      });
    }
  });

  timetable.giorni.forEach(day => {
    (day.lezioni || []).forEach(l => {
      if (l.aula) l.aula = cleanRoom(l.aula);
    });
  });

  return timetable;
}

const TIMETABLE_SCHEMA = {
  type: "object",
  properties: {
    classe: { type: "string" },
    stato_orario: { type: "string" },
    data_decorrenza: { type: "string" },
    data_aggiornamento: { type: "string" },
    giorni: {
      type: "array",
      items: {
        type: "object",
        properties: {
          giorno: { type: "string" },
          lezioni: {
            type: "array",
            items: {
              type: "object",
              properties: {
                ora: { type: "integer" },
                inizio: { type: "string" },
                fine: { type: "string" },
                materia: { type: "string" },
                docenti: { type: "array", items: { type: "string" } },
                aula: { type: "string" },
                is_lab: { type: "boolean" },
                note: { type: "string", nullable: true }
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
Sei un assistente specializzato nell'estrazione precisa di tabelle orario scolastiche da immagini Spaggiari EDT.
Analizza attentamente l'immagine ed estrai la struttura oraria completa.

REGOLE CRUCIALI:
1. Rileva gli ORARI ESATTI di inizio e fine per ciascuna ora (08:00-08:54, 08:58-09:48, 09:58-10:48, 10:52-11:42, 11:52-12:42, 12:46-13:36, 14:00-14:50, 14:50-15:40).
2. Rileva tutti i giorni della settimana presenti (Lunedì, Martedì, Mercoledì, Giovedì, Venerdì).
3. CELLE UNITE VERTICALMENTE / ORE DOPPIE:
   Se una materia occupa due o più ore consecutive (es. laboratorio 09:58-11:42 o pomeridiano 14:00-15:40):
   DEVI GENERARE UNA VOCE SEPARATA PER CIASCUNA ORA DI LEZIONE con stessa materia, aula e docenti.
4. Per ogni ora di lezione estrai ora, inizio, fine, materia, docenti, aula (es. "B 010", "C 170", "Olmo 303", "Palestra").
5. NON estrarre caselle di ricreazione o intervallo come lezioni.
6. Rispondi RIGOROSAMENTE con il JSON conforme allo schema richiesto.
`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let parsedBody = {};
    if (req.body) {
      try {
        parsedBody = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || {};
      } catch (_) {
        parsedBody = {};
      }
    }

    const query = req.query || {};
    const className = String(
      parsedBody.class_name ||
      parsedBody.class ||
      query.class ||
      query.class_name ||
      '4 BINF'
    ).trim();
    const force = Boolean(
      parsedBody.force === true ||
      parsedBody.force === 'true' ||
      parsedBody.force === '1' ||
      query.force === 'true' ||
      query.force === '1'
    );

    const timetablePath = path.join(process.cwd(), 'public', 'data', 'timetable.json');
    let localTimetable = null;

    if (fs.existsSync(timetablePath)) {
      try {
        const raw = fs.readFileSync(timetablePath, 'utf-8');
        const parsedLocal = JSON.parse(raw);
        if (parsedLocal && Array.isArray(parsedLocal.giorni)) {
          parsedLocal.giorni.forEach(day => {
            (day.lezioni || []).forEach(l => {
              if (l.aula) l.aula = cleanRoom(l.aula);
            });
          });
        }
        const localClass = (parsedLocal?.classe || '').trim().toLowerCase();
        if (hasLessons(parsedLocal) && (!localClass || localClass === className.toLowerCase())) {
          localTimetable = parsedLocal;
        }
      } catch (_) {}
    }

    let spaggiariUrl = Object.entries(CLASS_SPAGGIARI_MAP).find(
      ([k]) => k.toLowerCase() === className.toLowerCase()
    )?.[1];
    if (!spaggiariUrl) {
      try {
        const voltaPath = path.join(process.cwd(), 'public', 'data', 'volta_classes.json');
        if (fs.existsSync(voltaPath)) {
          const vClasses = JSON.parse(fs.readFileSync(voltaPath, 'utf-8'));
          const found = vClasses.find(c => c.name.toLowerCase().trim() === className.toLowerCase());
          if (found && found.url) spaggiariUrl = found.url;
        }
      } catch (_) {}
    }

    if (!spaggiariUrl) {
      return res.status(400).json({
        status: 'error',
        updated: false,
        class_name: className,
        message: `Nessun URL Spaggiari trovato per la classe '${className}'.`,
        timetable: null
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // 1. Scarica l'immagine live da Spaggiari con cache-buster esplicito
    let buffer;
    try {
      const freshUrl = spaggiariUrl + (spaggiariUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();
      const imgRes = await fetch(freshUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(15000)
      });

      if (!imgRes.ok) {
        return res.status(502).json({
          status: 'error',
          updated: false,
          class_name: className,
          message: `Spaggiari ha restituito HTTP ${imgRes.status} durante il controllo live.`,
          timetable: null
        });
      }

      const arrayBuffer = await imgRes.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch (syncErr) {
      console.warn('[SYNC FETCH ERROR]', syncErr.message);
      return res.status(502).json({
        status: 'error',
        updated: false,
        class_name: className,
        message: `Impossibile raggiungere Spaggiari per il controllo live: ${syncErr.message}`,
        timetable: null
      });
    }

    const liveHash = crypto.createHash('md5').update(buffer).digest('hex');

    // Verifica se l'immagine è cambiata rispetto alla cache salvata (nel JSON della stessa classe o su file)
    let cachedHash = localTimetable?.verification?.hash || null;
    const hashFilePath = path.join(process.cwd(), 'scripts', '.cache', `hash_${className.replace(/\s+/g, '_')}.txt`);
    if (fs.existsSync(hashFilePath)) {
      try {
        cachedHash = fs.readFileSync(hashFilePath, 'utf-8').trim() || cachedHash;
      } catch (_) {}
    }

    const hasChanged = !cachedHash || liveHash !== cachedHash;

    if (!hasChanged && !force && localTimetable) {
      console.log(`[SYNC] Immagine Spaggiari immutata (${liveHash.slice(0, 8)}). Restituisco orario esistente.`);
      return res.status(200).json({
        status: 'success',
        updated: false,
        live_verified: true,
        live_hash: liveHash,
        class_name: className,
        message: 'Orario già aggiornato all\'ultima versione pubblicata da Spaggiari',
        timetable: localTimetable
      });
    }

    if (!apiKey) {
      return res.status(503).json({
        status: 'error',
        updated: false,
        live_hash: liveHash,
        class_name: className,
        message: 'Nuovo orario rilevato su Spaggiari (o aggiornamento richiesto), ma GEMINI_API_KEY non è configurata sul server.',
        timetable: null
      });
    }

    console.log(`[SYNC] Immagine aggiornata o sync forzato (Hash live: ${liveHash}, cache: ${cachedHash}). Chiamo Gemini Vision...`);

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: `${PROMPT_INSTRUCTIONS}\n\nCLASSE TARGET: "${className}".` },
            {
              inlineData: {
                mimeType: 'image/png',
                data: buffer.toString('base64')
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

    const modelsToTry = [
      process.env.GEMINI_MAIN_MODEL || 'gemini-3.5-flash-lite',
      process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.8-flash'
    ];

    let extractedData = null;
    let lastModelError = null;

    for (const model of modelsToTry) {
      // Fino a 2 tentativi per modello in caso di piccolo glitch di rete
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
          const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(35000)
          });

          if (geminiRes.ok) {
            const gJson = await geminiRes.json();
            const rawText = gJson?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) {
              let cleanText = rawText.trim();
              if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
              }
              const parsed = JSON.parse(cleanText);
              if (hasLessons(parsed)) {
                extractedData = parsed;
                console.log(`[SYNC] Successo con modello: ${model} (tentativo ${attempt})`);
                break;
              }
              lastModelError = `Modello ${model} ha restituito zero lezioni`;
            }
          } else {
            const errText = await geminiRes.text();
            lastModelError = `HTTP ${geminiRes.status}: ${errText.slice(0, 140)}`;
            console.warn(`[SYNC] Modello ${model} risposta non OK (tentativo ${attempt}): ${geminiRes.status}`);
          }
        } catch (e) {
          lastModelError = e.message;
          console.warn(`[SYNC] Modello ${model} fallito (tentativo ${attempt}):`, e.message);
        }
        if (extractedData) break;
      }
      if (extractedData) break;
    }

    if (hasLessons(extractedData)) {
      const cleanData = normalizeTimetableMultiHourSlots(extractedData);
      cleanData.classe = cleanData.classe || className;
      cleanData.verification = {
        verified: true,
        status: 'LIVE_SPAGGIARI_SYNC',
        hash: liveHash,
        verified_at: new Date().toISOString()
      };

      // Aggiorna file cache solo se scrivibile e coerente con la classe richiesta
      try {
        if (className.toLowerCase() === '4 binf' && fs.existsSync(timetablePath)) {
          fs.writeFileSync(timetablePath, JSON.stringify(cleanData, null, 2), 'utf-8');
        }
        fs.mkdirSync(path.dirname(hashFilePath), { recursive: true });
        fs.writeFileSync(hashFilePath, liveHash, 'utf-8');
      } catch (_) {}

      return res.status(200).json({
        status: 'success',
        updated: true,
        live_verified: true,
        live_hash: liveHash,
        class_name: className,
        message: 'Nuovo orario Spaggiari sincronizzato ed estratto con successo!',
        timetable: cleanData
      });
    }

    console.error('[SYNC ERROR] Immagine nuova rilevata ma estrazione fallita su tutti i modelli.');
    return res.status(503).json({
      status: 'error',
      updated: false,
      live_hash: liveHash,
      class_name: className,
      message: 'Nuovo orario rilevato su Spaggiari, ma l\'estrazione automatica con Gemini non è riuscita al momento.',
      error_detail: lastModelError,
      timetable: null
    });
  } catch (err) {
    console.error('[API SYNC ERROR]', err);
    return res.status(500).json({
      status: 'error',
      message: 'Errore durante la sincronizzazione: ' + err.message,
      timetable: null
    });
  }
}
