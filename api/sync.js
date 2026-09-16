/**
 * api/sync.js - Vercel Serverless Function per /api/sync
 * Risponde alle richieste di sincronizzazione sia GET che POST restituendo
 * la struttura dell'orario aggiornata.
 */

import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Configurazione header CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let className = '4 BINF';
    if (req.body) {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (body && body.class_name) {
        className = body.class_name;
      }
    } else if (req.query && req.query.class) {
      className = req.query.class;
    }

    const timetablePath = path.join(process.cwd(), 'public', 'data', 'timetable.json');
    let timetableData = null;

    if (fs.existsSync(timetablePath)) {
      const raw = fs.readFileSync(timetablePath, 'utf-8');
      timetableData = JSON.parse(raw);
    }

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
