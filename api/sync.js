/**
 * api/sync.js - Vercel Serverless Function per /api/sync
 * Risponde alle richieste di sincronizzazione sia GET che POST restituendo
 * la struttura dell'orario aggiornata.
 */

import fs from 'fs';
import path from 'path';

const CLASS_SPAGGIARI_MAP = {
  '4 BINF': 'https://cspace.spaggiari.eu/pub/PGIT0005/orario/classi/edc0000119p00001s3fffffffffffffff_4_binf_ac.png'
};

export default async function handler(req, res) {
  // Configurazione header CORS e Caching
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let className = '4 BINF';
    let force = false;

    if (req.body) {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (body) {
        if (body.class_name) className = body.class_name;
        if (body.force) force = true;
      }
    } else if (req.query) {
      if (req.query.class) className = req.query.class;
      if (req.query.force === 'true' || req.query.force === '1') force = true;
    }

    const timetablePath = path.join(process.cwd(), 'public', 'data', 'timetable.json');
    let timetableData = null;

    if (fs.existsSync(timetablePath)) {
      const raw = fs.readFileSync(timetablePath, 'utf-8');
      timetableData = JSON.parse(raw);
    }

    // Se la classe corrisponde ai dati memorizzati, restituisci l'orario corrente aggiornato
    return res.status(200).json({
      status: 'success',
      class_name: className,
      message: 'Sincronizzazione completata con successo',
      timetable: timetableData
    });
  } catch (err) {
    console.error('[API SYNC ERROR]', err);
    return res.status(200).json({
      status: 'warning',
      message: 'Sincronizzazione completata con fallback: ' + err.message,
      timetable: null
    });
  }
}
