/**
 * subject_normalizer.js - Modulo centralizzato per la normalizzazione di materie e aule.
 * Condiviso tra il client PWA (public/js/widget_helper.js) e le Vercel Serverless Functions (api/widget.js).
 */

export const SUBJECT_MAPPING = {
  'INFORMATICA LAB': 'INF LAB',
  'INFORMATICA': 'INF',
  'INGLESE': 'ING',
  'ITALIANO': 'ITA',
  'LETTERE': 'ITA',
  'MATEMATICA': 'MATE',
  'RELIGIONE': 'RELIGIONE',
  'SCIENZE MOTORIE': 'MOTORIA',
  'ED FISICA': 'MOTORIA',
  'PALESTRA': 'MOTORIA',
  'SISTEMI E RETI LAB': 'SISTEMI LAB',
  'SISTEMI E RETI': 'SISTEMI',
  'SISTEMI LAB': 'SISTEMI LAB',
  'SISTEMI': 'SISTEMI',
  'TELECOMUNICAZIONI LAB': 'TELECOM LAB',
  'TELECOMUNICAZIONI': 'TELECOM',
  'TPSIT LAB': 'TPSIT LAB',
  'TPSIT': 'TPSIT',
  'DIRITTO ED ECONOMIA': 'DIRITTO',
  'DIRITTO': 'DIRITTO',
  'STORIA': 'STORIA',
  'TECNOLOGIE E PROGETTAZIONE': 'TPSIT',
  'CASA': 'Casa',
  'SCUOLA': 'Scuola',
  'PARTENZA': 'Partenza',
  'USCITA': 'Uscita',
  'RIENTRO': 'Rientro'
};

/**
 * Palette colori fedele all'orario ufficiale Spaggiari/EDT, ottimizzata per alto contrasto (WCAG AA/AAA).
 * Ogni materia ha una tonalità immediatamente riconoscibile a colpo d'occhio.
 */
export const SUBJECT_COLORS = {
  'ITALIANO': { bg: '#F87171', text: '#450A0A', name: 'Rosso Corallo' },
  'LETTERE': { bg: '#F87171', text: '#450A0A', name: 'Rosso Corallo' },
  'STORIA': { bg: '#FB923C', text: '#431407', name: 'Arancio Terracotta' },
  'MATEMATICA': { bg: '#6EE7B7', text: '#064E3B', name: 'Verde Menta' },
  'INGLESE': { bg: '#4ADE80', text: '#052E16', name: 'Verde Lime' },
  'INFORMATICA': { bg: '#818CF8', text: '#1E1B4B', name: 'Blu Indigo' },
  'INFORMATICA LAB': { bg: '#818CF8', text: '#1E1B4B', name: 'Blu Indigo' },
  'SISTEMI E RETI': { bg: '#60A5FA', text: '#172554', name: 'Blu Acciaio' },
  'SISTEMI E RETI LAB': { bg: '#60A5FA', text: '#172554', name: 'Blu Acciaio' },
  'SISTEMI': { bg: '#60A5FA', text: '#172554', name: 'Blu Acciaio' },
  'SISTEMI LAB': { bg: '#60A5FA', text: '#172554', name: 'Blu Acciaio' },
  'TELECOMUNICAZIONI': { bg: '#C084FC', text: '#3B0764', name: 'Viola Ametista' },
  'TELECOMUNICAZIONI LAB': { bg: '#C084FC', text: '#3B0764', name: 'Viola Ametista' },
  'TPSIT': { bg: '#22D3EE', text: '#083344', name: 'Turchese Ghiaccio' },
  'TPSIT LAB': { bg: '#22D3EE', text: '#083344', name: 'Turchese Ghiaccio' },
  'SCIENZE MOTORIE': { bg: '#F472B6', text: '#500724', name: 'Rosa Sport' },
  'ED. FISICA': { bg: '#F472B6', text: '#500724', name: 'Rosa Sport' },
  'PALESTRA': { bg: '#F472B6', text: '#500724', name: 'Rosa Sport' },
  'RELIGIONE': { bg: '#CBD5E1', text: '#0F172A', name: 'Grigio Perla' },
  'DIRITTO ED ECONOMIA': { bg: '#FBBF24', text: '#451A03', name: 'Ambra Dorata' },
  'DIRITTO': { bg: '#FBBF24', text: '#451A03', name: 'Ambra Dorata' },
  'SCIENZE': { bg: '#FB7185', text: '#4C0519', name: 'Cremisi' },
  'DEFAULT': { bg: '#94A3B8', text: '#0F172A', name: 'Grigio' }
};

export function getSubjectColor(name) {
  if (!name) return SUBJECT_COLORS.DEFAULT;
  const clean = name.trim().toUpperCase().replace(/\./g, '');
  if (SUBJECT_COLORS[clean]) return SUBJECT_COLORS[clean];
  if (clean.includes('INFORMATICA')) return SUBJECT_COLORS['INFORMATICA'];
  if (clean.includes('SISTEMI')) return SUBJECT_COLORS['SISTEMI E RETI'];
  if (clean.includes('TELECOM')) return SUBJECT_COLORS['TELECOMUNICAZIONI'];
  if (clean.includes('TPSIT')) return SUBJECT_COLORS['TPSIT'];
  if (clean.includes('MATEMATICA')) return SUBJECT_COLORS['MATEMATICA'];
  if (clean.includes('INGLESE')) return SUBJECT_COLORS['INGLESE'];
  if (clean.includes('STORIA')) return SUBJECT_COLORS['STORIA'];
  if (clean.includes('ITALIANO') || clean.includes('LETTERE')) return SUBJECT_COLORS['ITALIANO'];
  if (clean.includes('MOTORIA') || clean.includes('FISICA') || clean.includes('PALESTRA')) return SUBJECT_COLORS['SCIENZE MOTORIE'];
  if (clean.includes('RELIGIONE')) return SUBJECT_COLORS['RELIGIONE'];
  if (clean.includes('DIRITTO')) return SUBJECT_COLORS['DIRITTO'];
  if (clean.includes('SCIENZE') || clean.includes('CHIMICA')) return SUBJECT_COLORS['SCIENZE'];
  return SUBJECT_COLORS.DEFAULT;
}

/**
 * Abbrevia il nome della materia per display compatto (One UI / Flight Board KWGT).
 * @param {string} name - Nome completo della materia
 * @param {boolean} isLab - True se ora di laboratorio
 * @returns {string} - Nome abbreviato normalizzato
 */
export function shortenSubject(name, isLab = false) {
  if (!name) return '';
  const clean = name.trim().toUpperCase()
    .replace(/[.,;:]/g, '')
    .replace(/\s+/g, ' ');

  if (SUBJECT_MAPPING[clean]) {
    return SUBJECT_MAPPING[clean];
  }

  const hasLab = isLab || clean.includes('LAB');
  if (clean.includes('TELECOM')) return hasLab ? 'TELECOM LAB' : 'TELECOM';
  if (clean.includes('SISTEMI')) return hasLab ? 'SISTEMI LAB' : 'SISTEMI';
  if (clean.includes('INFORMATICA')) return hasLab ? 'INF LAB' : 'INF';
  if (clean.includes('TPSIT')) return hasLab ? 'TPSIT LAB' : 'TPSIT';
  if (clean.includes('MATEMATICA')) return 'MATE';
  if (clean.includes('INGLESE')) return 'ING';
  if (clean.includes('ITALIANO') || clean.includes('LETTERE')) return 'ITA';
  if (clean.includes('STORIA')) return 'STORIA';
  if (clean.includes('RELIGIONE')) return 'RELIGIONE';
  if (clean.includes('MOTORIA') || clean.includes('FISICA') || clean.includes('PALESTRA')) return 'MOTORIA';
  if (clean.includes('DIRITTO')) return 'DIRITTO';

  return name.trim();
}

/**
 * Normalizza il codice aula/laboratorio per il widget e la visualizzazione.
 * Rimuove indicazioni di piano (es. "1° P. OVEST", "P. T. EST"), note di laboratorio, ecc.
 * Preserva per la sede di Olmo la dicitura "Olmo" seguita dal numero dell'aula (es. "Olmo 303").
 * @param {string} room - Stringa dell'aula (es. "C 170 WIN - 1° P. OVEST", "OLMO 303", "B 010 - P. T. EST) Lab. Reti")
 * @returns {string} - Nome aula pulito e compatto (es. "C 170", "Olmo 303", "B 010", "Palestra")
 */
export function cleanRoom(room) {
  if (!room) return '';
  const cleaned = room.trim();

  // Parole riservate per stati speciali widget
  const special = ['casa', 'partenza', 'scuola', 'uscita', 'rientro', 'terminata'];
  for (const s of special) {
    if (cleaned.toLowerCase() === s) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
    }
  }

  // Palestra (es. "Palestra OLMO", "Palestra ITTS (P01)") -> "Palestra"
  if (cleaned.toLowerCase().includes('palestra')) {
    return 'Palestra';
  }

  // Sede di Olmo: es. "OLMO 303", "OLMO 103 (lab. informatica)" -> "Olmo 303"
  const olmoMatch = cleaned.match(/\bolmo\b\s*(\d+)/i);
  if (olmoMatch) {
    return `Olmo ${olmoMatch[1]}`;
  }

  // Aula standard Volta: lettera (A, B, C, L, ecc.) seguita da 2 o 3 cifre
  // Gestisce:
  // "B 010 - P. T. EST) Lab. Reti" -> "B 010"
  // "C 170 WIN - 1° P. OVEST" -> "C 170"
  // "B 055 (P. T. EST)" -> "B 055"
  // "(L030) Lab. el. Tele" -> "L 030"
  // "A025 Lab. Energia" -> "A 025"
  // "(B065) MAC (P.T. EST)" -> "B 065"
  const voltaMatch = cleaned.match(/([A-Za-z])\s*(\d{2,3})/);
  if (voltaMatch) {
    const letter = voltaMatch[1].toUpperCase();
    const number = voltaMatch[2];
    return `${letter} ${number}`;
  }

  // Fallback: rimuovi indicazioni di piano e lab
  return cleaned
    .replace(/\(?[0-9]°?\s*p\.?\s*(est|ovest)\)?/gi, '')
    .replace(/\(?p\.?\s*t\.?\s*(est|ovest)\)?/gi, '')
    .replace(/\blab\b\.?\s*[^,;)]*/gi, '')
    .replace(/[()\-*]/g, '')
    .trim() || cleaned;
}
