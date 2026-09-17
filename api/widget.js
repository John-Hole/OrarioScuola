/**
 * api/widget.js - Vercel Serverless Function per il feed dinamico in tempo reale di KWGT / Lock Screen.
 * Calcola lo stato del widget al minuto esatto (fuso orario Europe/Rome).
 */

import fs from 'fs';
import path from 'path';

function timeToMinutes(str) {
  if (!str) return 0;
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function shortenSubject(name) {
  if (!name) return '';
  const mapping = {
    'TELECOMUNICAZIONI': 'TELECOM.',
    'SCIENZE MOTORIE': 'SC. MOTORIE',
    'SISTEMI E RETI LAB': 'SISTEMI LAB',
    'SISTEMI E RETI': 'SISTEMI',
    'INFORMATICA LAB': 'INFORMATICA',
    'TPSIT LAB': 'TPSIT',
    'DIRITTO ED ECONOMIA': 'DIRITTO',
    'TECNOLOGIE E PROGETTAZIONE': 'TPSIT'
  };
  const clean = name.trim().toUpperCase();
  return mapping[clean] || name.trim();
}

function cleanRoom(room) {
  if (!room) return '';
  return room.replace(/\blab\b\.?\s*/gi, '').trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30, stale-while-revalidate=60');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const timetablePath = path.join(process.cwd(), 'public', 'data', 'timetable.json');
    let timetable = null;

    if (fs.existsSync(timetablePath)) {
      timetable = JSON.parse(fs.readFileSync(timetablePath, 'utf-8'));
    }

    const now = new Date();
    const romeTimeStr = now.toLocaleString('en-US', { timeZone: 'Europe/Rome' });
    const romeDate = new Date(romeTimeStr);

    const itDays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const dayIdx = romeDate.getDay();
    const currentMinutes = romeDate.getHours() * 60 + romeDate.getMinutes();
    const timeStr = ${String(romeDate.getHours()).padStart(2, '0')}:;

    const emptyFlight = {
      flight_visible: 0,
      flight_origin_sub: '',
      flight_origin_room: '',
      flight_arrow: '───>',
      flight_time: '',
      flight_dest_sub: '',
      flight_dest_room: '',
      flight_single_line: '',
      flight_multiline: '',
      flight_board: '',
      flight_compact: '',
      flight_bbcode: '',
      flight_clean: '',
      flight_clean_plain: '',
      flight_left_col: '',
      flight_center_col: '',
      flight_right_col: ''
    };

    if (!timetable || dayIdx === 0 || dayIdx === 6) {
      return res.status(200).json({
        ...emptyFlight,
        status: 'WEEKEND',
        badge: 'WEEKEND',
        title: 'Buon Fine Settimana',
        subtitle: 'Riposo',
        room: '',
        time_left: '',
        updated_at: timeStr,
        class_name: timetable?.classe || '4 BINF'
      });
    }

    const currentDayName = itDays[dayIdx];
    const dayData = (timetable.giorni || []).find(d => d.giorno === currentDayName);

    if (!dayData || !dayData.lezioni || dayData.lezioni.length === 0) {
      return res.status(200).json({
        ...emptyFlight,
        status: 'NO_LESSONS',
        badge: 'LIBERO',
        title: 'Nessuna lezione oggi',
        subtitle: 'Nessun impegno a calendario',
        room: '',
        time_left: '',
        updated_at: timeStr,
        class_name: timetable.classe || '4 BINF'
      });
    }

    const lessons = dayData.lezioni;
    const firstStart = timeToMinutes(lessons[0].inizio);
    const lastEnd = timeToMinutes(lessons[lessons.length - 1].fine);

    const isVisible = (currentMinutes >= 420 && currentMinutes < lastEnd + 60) ? 1 : 0;

    let originSub = '';
    let originRoom = '';
    let flightTime = '';
    let destSub = '';
    let destRoom = '';

    if (currentMinutes < firstStart) {
      originSub = 'Casa';
      originRoom = 'Partenza';
      flightTime = lessons[0].inizio;
      destSub = lessons[0].materia;
      destRoom = lessons[0].aula;
    } else if (currentMinutes >= lastEnd) {
      originSub = 'Scuola';
      originRoom = lessons[lessons.length - 1].aula || 'Terminata';
      flightTime = lessons[lessons.length - 1].fine;
      destSub = 'Casa';
      destRoom = 'Rientro';
    } else {
      let found = false;
      for (let i = 0; i < lessons.length; i++) {
        const s = timeToMinutes(lessons[i].inizio);
        const e = timeToMinutes(lessons[i].fine);

        if (currentMinutes >= s && currentMinutes < e) {
          originSub = lessons[i].materia;
          originRoom = lessons[i].aula;
          if (i === lessons.length - 1) {
            flightTime = lessons[i].fine;
            destSub = 'Casa';
            destRoom = 'Uscita';
          } else {
            flightTime = lessons[i].fine;
            destSub = lessons[i + 1].materia;
            destRoom = lessons[i + 1].aula;
          }
          found = true;
          break;
        }

        if (i + 1 < lessons.length) {
          const nextS = timeToMinutes(lessons[i + 1].inizio);
          if (currentMinutes >= e && currentMinutes < nextS) {
            originSub = lessons[i].materia;
            originRoom = lessons[i].aula;
            flightTime = lessons[i + 1].inizio;
            destSub = lessons[i + 1].materia;
            destRoom = lessons[i + 1].aula;
            found = true;
            break;
          }
        }
      }

      if (!found) {
        originSub = lessons[0].materia;
        originRoom = lessons[0].aula;
        flightTime = lessons[0].inizio;
        destSub = 'Casa';
        destRoom = 'Uscita';
      }
    }

    const s1 = shortenSubject(originSub);
    const s2 = shortenSubject(destSub);
    const r1 = cleanRoom(originRoom);
    const r2 = cleanRoom(destRoom);

    const singleLine = ${s1} []  ──  ✈ ──>   [];
    const board = ${s1}       ───>       \n🚩           🚩 ;
    const flightCompact = [b][/b]       [c=#38bdf8]───>[/c]       [b][/b]\n[c=#38bdf8]🚩 [/c]     [b][c=#f59e0b][/c][/b]     [c=#4ade80]🚩 [/c];

    return res.status(200).json({
      flight_visible: isVisible,
      flight_origin_sub: s1,
      flight_origin_room: r1,
      flight_arrow: '───>',
      flight_time: flightTime,
      flight_dest_sub: s2,
      flight_dest_room: r2,
      flight_single_line: singleLine,
      flight_multiline: board,
      flight_board: board,
      flight_compact: flightCompact,
      flight_bbcode: flightCompact,
      flight_clean: flightCompact,
      flight_clean_plain: board,
      flight_left_col: ${s1}\n,
      flight_center_col: ───>\n,
      flight_right_col: ${s2}\n,
      status: currentMinutes < firstStart ? 'BEFORE_SCHOOL' : (currentMinutes >= lastEnd ? 'FINISHED' : 'IN_CLASS'),
      updated_at: timeStr,
      class_name: timetable?.classe || '4 BINF'
    });
  } catch (err) {
    console.error('[API WIDGET ERROR]', err);
    return res.status(500).json({ error: err.message });
  }
}
