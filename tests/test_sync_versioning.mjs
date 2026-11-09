import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  isServerTimetableNewer,
  parseTimetableDecorrenzaTime,
  parseVerifiedTimestamp,
  computeTimetableContentSignature
} from '../public/js/timetable_store.js';
import { getRomeClock } from '../api/widget.js';
import syncHandler from '../api/sync.js';

console.log('--- Test Versioning, Timezone Europe/Rome & API Sync ---');

const baseSample = {
  classe: '4 BINF',
  stato_orario: 'Orario provvisorio',
  data_decorrenza: 'dal 12 ottobre 2026',
  giorni: [
    {
      giorno: 'Lunedì',
      lezioni: [
        { ora: 1, inizio: '08:00', fine: '08:54', materia: 'SISTEMI E RETI LAB.', docenti: ['MANCINO'], aula: 'B 010' },
        { ora: 6, inizio: '12:46', fine: '13:36', materia: 'INGLESE', docenti: ['GUERCINI'], aula: 'B 030' }
      ]
    }
  ],
  verification: {
    verified: true,
    status: 'SINGLE_PASS',
    hash: 'hash_old_oct',
    verified_at: '2026-10-10 13:20:33'
  }
};

const newerSample = {
  ...baseSample,
  data_decorrenza: 'dal 9 novembre 2026',
  giorni: [
    {
      giorno: 'Lunedì',
      lezioni: [
        { ora: 1, inizio: '08:00', fine: '08:54', materia: 'SISTEMI E RETI LAB.', docenti: ['MANCINO'], aula: 'B 010' },
        { ora: 6, inizio: '12:46', fine: '13:36', materia: 'INGLESE', docenti: ['GUERCINI', 'LONZINI'], aula: 'B 105' }
      ]
    }
  ],
  verification: {
    verified: true,
    status: 'VERIFIED_LIVE_SPAGGIARI',
    hash: 'hash_new_nov',
    verified_at: '2026-11-09T15:30:00+01:00'
  }
};

// 1. Decorrenza e anti-regressione
assert.ok(parseTimetableDecorrenzaTime(newerSample) > parseTimetableDecorrenzaTime(baseSample), '9 novembre deve superare 12 ottobre');
assert.strictEqual(isServerTimetableNewer(newerSample, baseSample), true, 'Nuova decorrenza deve aggiornare il locale');
assert.strictEqual(isServerTimetableNewer(baseSample, newerSample), false, 'Anti-regressione: decorrenza più vecchia non deve sovrascrivere');
assert.strictEqual(isServerTimetableNewer(newerSample, structuredClone(newerSample)), false, 'Identico orario non deve risultare più nuovo');

// 2. Stessa decorrenza ma immagine/contenuto cambiati
const editedSameDate = structuredClone(newerSample);
editedSameDate.giorni[0].lezioni[1].aula = 'C 195';
editedSameDate.verification.hash = 'hash_new_nov_v2';
editedSameDate.verification.verified_at = '2026-11-10T08:00:00+01:00';
assert.strictEqual(isServerTimetableNewer(editedSameDate, newerSample), true, 'Modifica aula/hash a pari data deve aggiornare');
assert.strictEqual(isServerTimetableNewer(newerSample, editedSameDate), false, 'Hash più vecchio non deve regredire');

// 3. Parse ISO vs naive YYYY-MM-DD HH:MM:SS + protezione da mock
assert.ok(parseVerifiedTimestamp(baseSample) > 0, 'Deve fare il parse del formato YYYY-MM-DD HH:MM:SS');
assert.ok(parseVerifiedTimestamp(newerSample) > parseVerifiedTimestamp(baseSample));
assert.notStrictEqual(computeTimetableContentSignature(baseSample), computeTimetableContentSignature(newerSample));

const mockSample = {
  ...newerSample,
  data_decorrenza: 'In vigore dal 14 Settembre 2026',
  verification: { verified: true, status: 'MOCK_VERIFIED' }
};
assert.strictEqual(isServerTimetableNewer(mockSample, baseSample), false, 'I dati mock non devono mai sostituire un orario reale');
assert.strictEqual(isServerTimetableNewer(baseSample, mockSample), true, 'Un orario reale deve sostituire dati mock');

console.log('✓ Logica versioning e anti-regressione verificata');

// 4. Orologio server Europe/Rome (CET + DST + cambio giorno)
const winterClock = getRomeClock(new Date('2026-11-09T12:27:00Z'));
assert.strictEqual(winterClock.dayIdx, 1);
assert.strictEqual(winterClock.timeStr, '13:27');

const summerClock = getRomeClock(new Date('2026-07-06T06:05:00Z'));
assert.strictEqual(summerClock.dayIdx, 1);
assert.strictEqual(summerClock.timeStr, '08:05');

const midnightRollover = getRomeClock(new Date('2026-11-08T23:30:00Z'));
assert.strictEqual(midnightRollover.dayIdx, 1, 'Domenica 23:30 UTC in inverno è Lunedì 00:30 CET a Roma');
assert.strictEqual(midnightRollover.timeStr, '00:30');

console.log('✓ Calcolo fuso Europe/Rome verificato');

// 5. Test handler /api/sync in workspace temporaneo isolato con fetch mockato
function createMockRes() {
  const headers = {};
  let statusCode = 200;
  let body = null;
  let ended = false;
  const res = {
    setHeader(k, v) { headers[k.toLowerCase()] = v; },
    status(code) { statusCode = code; return res; },
    json(payload) { body = payload; return res; },
    end() { ended = true; return res; },
    getStatus: () => statusCode,
    getBody: () => body,
    isEnded: () => ended
  };
  return res;
}

const origCwd = process.cwd();
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orarioscuola-sync-test-'));
const origFetch = globalThis.fetch;
const origGeminiKey = process.env.GEMINI_API_KEY;

try {
  fs.mkdirSync(path.join(tmpDir, 'public', 'data'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'scripts', '.cache'), { recursive: true });
  const seededPng = Buffer.from('fake-png-4binf-live');
  const seededHash = crypto.createHash('md5').update(seededPng).digest('hex');

  const seededTimetable = {
    ...newerSample,
    verification: {
      verified: true,
      status: 'VERIFIED_LIVE_SPAGGIARI',
      hash: seededHash,
      verified_at: '2026-11-09T16:00:00+01:00'
    }
  };
  fs.writeFileSync(path.join(tmpDir, 'public', 'data', 'timetable.json'), JSON.stringify(seededTimetable, null, 2));
  fs.writeFileSync(
    path.join(tmpDir, 'public', 'data', 'volta_classes.json'),
    JSON.stringify([
      { name: '4 BINF', code: 'c0000119', year: 4, url: 'https://cspace.spaggiari.eu/pub/PGIT0005/orario/classi/4_binf.png' },
      { name: '4 AINF', code: 'c0000026', year: 4, url: 'https://cspace.spaggiari.eu/pub/PGIT0005/orario/classi/4_ainf.png' }
    ])
  );

  process.chdir(tmpDir);

  // 5a. GET /api/sync con immagine immutata (hash hit) -> 200 live_verified senza chiamare Gemini
  delete process.env.GEMINI_API_KEY;
  let geminiCalled = false;
  globalThis.fetch = async (url) => {
    if (String(url).includes('generativelanguage.googleapis.com')) {
      geminiCalled = true;
      throw new Error('Gemini non dovrebbe essere chiamato quando hash coincide');
    }
    return new Response(seededPng, { status: 200 });
  };

  {
    const req = { method: 'GET', body: {}, query: { class: '4 BINF' } };
    const res = createMockRes();
    await syncHandler(req, res);
    assert.strictEqual(res.getStatus(), 200);
    assert.strictEqual(res.getBody().status, 'success');
    assert.strictEqual(res.getBody().updated, false);
    assert.strictEqual(res.getBody().live_verified, true);
    assert.strictEqual(res.getBody().live_hash, seededHash);
    assert.strictEqual(geminiCalled, false);
  }

  // 5b. Isolamento cross-classe: richiesta '4 AINF' senza GEMINI_API_KEY -> NON deve restituire '4 BINF', ma 503
  {
    const ainfPng = Buffer.from('fake-png-4ainf-live');
    globalThis.fetch = async () => new Response(ainfPng, { status: 200 });
    const req = { method: 'POST', body: { class_name: '4 AINF', force: false }, query: {} };
    const res = createMockRes();
    await syncHandler(req, res);
    assert.strictEqual(res.getStatus(), 503);
    assert.strictEqual(res.getBody().status, 'error');
    assert.strictEqual(res.getBody().timetable, null);
  }

  // 5c. Errore Spaggiari -> 502 onesto (mai finto 200 success)
  {
    globalThis.fetch = async () => new Response('Bad Gateway', { status: 500 });
    const req = { method: 'POST', body: { class_name: '4 BINF', force: false }, query: {} };
    const res = createMockRes();
    await syncHandler(req, res);
    assert.strictEqual(res.getStatus(), 502);
    assert.strictEqual(res.getBody().status, 'error');
  }

  // 5d. Immagine cambiata + GEMINI_API_KEY presente -> chiamata Gemini con header x-goog-api-key (no ?key= in URL)
  {
    process.env.GEMINI_API_KEY = 'dummy-test-token';
    const updatedPng = Buffer.from('fake-png-updated-nov-16');
    const updatedHash = crypto.createHash('md5').update(updatedPng).digest('hex');
    let seenHeaderKey = null;
    let seenUrlQueryKey = false;

    globalThis.fetch = async (url, init = {}) => {
      const sUrl = String(url);
      if (sUrl.includes('generativelanguage.googleapis.com')) {
        if (sUrl.includes('key=')) seenUrlQueryKey = true;
        seenHeaderKey = init?.headers?.['x-goog-api-key'] || init?.headers?.['X-Goog-Api-Key'] || null;
        return new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  classe: '4 BINF',
                  stato_orario: 'Orario provvisorio',
                  data_decorrenza: 'dal 16 novembre 2026',
                  giorni: [{
                    giorno: 'Lunedì',
                    lezioni: [{ ora: 1, inizio: '08:00', fine: '08:54', materia: 'ITALIANO', docenti: ['TOMASSONI'], aula: 'B055 - P.T. EST', is_lab: false }]
                  }]
                })
              }]
            }
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(updatedPng, { status: 200 });
    };

    const req = { method: 'POST', body: { class_name: '4 BINF', force: false }, query: {} };
    const res = createMockRes();
    await syncHandler(req, res);
    assert.strictEqual(res.getStatus(), 200);
    assert.strictEqual(res.getBody().status, 'success');
    assert.strictEqual(res.getBody().updated, true);
    assert.strictEqual(res.getBody().live_hash, updatedHash);
    assert.strictEqual(res.getBody().timetable.data_decorrenza, 'dal 16 novembre 2026');
    assert.strictEqual(res.getBody().timetable.giorni[0].lezioni[0].aula, 'B 055');
    assert.strictEqual(seenUrlQueryKey, false, 'La API key Gemini non deve mai essere passata via query string ?key=');
    assert.strictEqual(seenHeaderKey, 'dummy-test-token', 'La API key Gemini deve essere inviata tramite header x-goog-api-key');
  }

  console.log('✓ Handler /api/sync verificato (hash hit, cross-classe, errori 502/503, estrazione Gemini con x-goog-api-key)');
} finally {
  process.chdir(origCwd);
  globalThis.fetch = origFetch;
  if (origGeminiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = origGeminiKey;
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log('Tutti i test di versioning, timezone e API sync sono passati con successo!');
