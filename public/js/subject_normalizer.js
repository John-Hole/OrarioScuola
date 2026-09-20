/**
 * subject_normalizer.js - Modulo centralizzato per la normalizzazione di materie e aule.
 * Condiviso tra il client PWA (public/js/widget_helper.js) e le Vercel Serverless Functions (api/widget.js).
 */

export const SUBJECT_MAPPING = {
  'INFORMATICA LAB': 'INF L.',
  'INFORMATICA': 'INF',
  'INGLESE': 'ING',
  'ITALIANO': 'ITA',
  'MATEMATICA': 'MATE',
  'RELIGIONE': 'REL',
  'SCIENZE MOTORIE': 'MOTORIA',
  'ED. FISICA': 'MOTORIA',
  'PALESTRA': 'MOTORIA',
  'SISTEMI E RETI LAB': 'SISTEMI L.',
  'SISTEMI E RETI': 'SISTEMI',
  'SISTEMI LAB': 'SISTEMI L.',
  'SISTEMI': 'SISTEMI',
  'TELECOMUNICAZIONI LAB': 'TELECOM L.',
  'TELECOMUNICAZIONI': 'TELECOM',
  'TPSIT LAB': 'TPSIT L.',
  'TPSIT': 'TPSIT',
  'DIRITTO ED ECONOMIA': 'DIRITTO',
  'DIRITTO': 'DIRITTO',
  'STORIA': 'STORIA',
  'TECNOLOGIE E PROGETTAZIONE': 'TPSIT'
};

/**
 * Abbrevia il nome della materia per display compatto (One UI / Flight Board KWGT).
 * @param {string} name - Nome completo della materia
 * @param {boolean} isLab - True se ora di laboratorio
 * @returns {string} - Nome abbreviato normalizzato
 */
export function shortenSubject(name, isLab = false) {
  if (!name) return '';
  const clean = name.trim().toUpperCase();
  if (isLab && !clean.includes('LAB')) {
    if (clean === 'INFORMATICA') return 'INF L.';
    if (clean === 'SISTEMI' || clean === 'SISTEMI E RETI') return 'SISTEMI L.';
    if (clean === 'TELECOMUNICAZIONI') return 'TELECOM L.';
    if (clean === 'TPSIT') return 'TPSIT L.';
  }
  return SUBJECT_MAPPING[clean] || name.trim();
}

/**
 * Normalizza il codice aula/laboratorio per il widget e la visualizzazione.
 * @param {string} room - Stringa dell'aula (es. "B 010 LAB RETI")
 * @returns {string} - Nome aula pulito
 */
export function cleanRoom(room) {
  if (!room) return '';
  const cleaned = room.trim();
  if (cleaned.toLowerCase().includes('palestra')) {
    return 'Palestra';
  }
  return cleaned.replace(/\blab\b\.?\s*/gi, '').trim();
}
