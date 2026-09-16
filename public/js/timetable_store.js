/**
 * timetable_store.js - Gestore centralizzato per Multi-Orario e Preferiti
 * Memorizza in localStorage gli orari caricati dall'utente (precaricati Volta, URL o File)
 * e tiene traccia dell'orario preferito (⭐) e di quello attualmente attivo.
 */

import { timeToMinutes } from './timeline.js';

const STORAGE_KEY = 'smart_timetable_registry_v1';

export const VOLTA_PRESET_ID = 'volta_4_binf';

export const DEFAULT_SCHOOL_HOURS = [
  { ora: 1, start: '08:00', end: '08:54', startMin: 480, endMin: 534 },
  { ora: 2, start: '08:58', end: '09:48', startMin: 538, endMin: 588 },
  { ora: 3, start: '09:58', end: '10:48', startMin: 598, endMin: 648 },
  { ora: 4, start: '10:52', end: '11:42', startMin: 652, endMin: 702 },
  { ora: 5, start: '11:52', end: '12:42', startMin: 712, endMin: 762 },
  { ora: 6, start: '12:46', end: '13:36', startMin: 766, endMin: 816 }
];

/**
 * Rileva lezioni che coprono blocchi di più ore (es. 09:58 - 11:42)
 * e le sdoppia automaticamente in singole ore consecutive (es. ora 3 e ora 4)
 * con stessa materia, aula e docenti, abilitando la visualizzazione corretta del blocco continuo.
 */
export function normalizeTimetableMultiHourSlots(timetable) {
  if (!timetable || !Array.isArray(timetable.giorni)) {
    return timetable;
  }

  // 1. Raccoglie la griglia oraria dalle ore singole già presenti
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

  // Fallback su orari standard dell'istituto
  DEFAULT_SCHOOL_HOURS.forEach(std => {
    if (!knownHours.has(std.ora)) {
      knownHours.set(std.ora, { ...std });
    }
  });

  const sortedSlots = Array.from(knownHours.values()).sort((a, b) => a.ora - b.ora);

  // 2. Normalizza ciascun giorno
  timetable.giorni.forEach(day => {
    const originalLessons = day.lezioni || [];
    const newLessons = [];
    const occupiedHours = new Set();

    originalLessons.forEach(l => {
      const sMin = timeToMinutes(l.inizio);
      const eMin = timeToMinutes(l.fine);
      const dur = eMin - sMin;

      // Se dura più di 65 minuti (es. ora doppia da ~104 min come TPSIT 09:58-11:42)
      if (dur > 65) {
        const matched = [];
        sortedSlots.forEach(slot => {
          const overlapStart = Math.max(sMin, slot.startMin);
          const overlapEnd = Math.min(eMin, slot.endMin);
          const overlap = overlapEnd - overlapStart;
          if (overlap >= 25) {
            matched.push(slot);
          }
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

/**
 * Struttura di default per l'orario 4 BINF dell'Istituto Volta
 */
export const VOLTA_4_BINF_PRESET = {
  id: VOLTA_PRESET_ID,
  name: '4 BINF',
  school: 'Istituto Tecnico A. Volta',
  sublabel: 'Informatica e Telecomunicazioni',
  type: 'preset',
  isFavorite: true,
  dataUrl: 'data/timetable.json',
  lastUpdated: new Date().toLocaleDateString('it-IT'),
  data: null // Caricato su richiesta da data/timetable.json
};

/**
 * Carica l'intero registro degli orari salvati
 */
export function getTimetableRegistry() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items)) {
        parsed.items.forEach(item => {
          if (item && item.data) {
            item.data = normalizeTimetableMultiHourSlots(item.data);
          }
        });
        if (!parsed.activeId) {
          parsed.activeId = VOLTA_PRESET_ID;
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[STORE] Errore lettura registro orari:', e);
  }

  // Di base all'avvio 4 BINF è sempre attivo e presente
  return {
    activeId: VOLTA_PRESET_ID,
    items: [
      {
        ...VOLTA_4_BINF_PRESET
      }
    ]
  };
}

/**
 * Salva il registro su localStorage
 */
export function saveTimetableRegistry(registry) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
  } catch (e) {
    console.error('[STORE] Errore salvataggio registro orari:', e);
  }
}

/**
 * Restituisce l'ID dell'orario correntemente attivo
 */
export function getActiveTimetableId() {
  const registry = getTimetableRegistry();
  return registry.activeId;
}

/**
 * Imposta l'orario attivo
 */
export function setActiveTimetableId(id) {
  const registry = getTimetableRegistry();
  registry.activeId = id;
  saveTimetableRegistry(registry);
}

/**
 * Restituisce l'elenco di tutti gli orari registrati
 */
export function getAllSavedTimetables() {
  const registry = getTimetableRegistry();
  return registry.items || [];
}

/**
 * Cerca un orario per ID
 */
export function getTimetableById(id) {
  if (!id) return null;
  const registry = getTimetableRegistry();
  return (registry.items || []).find(item => item.id === id) || null;
}

/**
 * Trova l'orario preferito (contrassegnato con la stellina ⭐)
 */
export function getFavoriteTimetable() {
  const registry = getTimetableRegistry();
  return (registry.items || []).find(item => item.isFavorite) || null;
}

/**
 * Salva o aggiorna un orario nel registro
 */
export function saveOrUpdateTimetable(item, setAsActive = true) {
  if (item && item.data) {
    item.data = normalizeTimetableMultiHourSlots(item.data);
  }
  const registry = getTimetableRegistry();
  const existingIndex = registry.items.findIndex(i => i.id === item.id);

  if (existingIndex >= 0) {
    registry.items[existingIndex] = { ...registry.items[existingIndex], ...item };
  } else {
    registry.items.push(item);
  }

  if (setAsActive) {
    registry.activeId = item.id;
  }

  saveTimetableRegistry(registry);
  return item;
}

/**
 * Rimuove un orario salvato
 */
export function deleteTimetable(id) {
  const registry = getTimetableRegistry();
  registry.items = (registry.items || []).filter(item => item.id !== id);

  if (registry.activeId === id) {
    const fav = registry.items.find(i => i.isFavorite);
    registry.activeId = fav ? fav.id : (registry.items[0]?.id || null);
  }

  saveTimetableRegistry(registry);
}

/**
 * Imposta o rimuove la stellina dei preferiti ⭐
 */
export function toggleFavoriteTimetable(id) {
  const registry = getTimetableRegistry();
  let updatedItem = null;

  registry.items = (registry.items || []).map(item => {
    if (item.id === id) {
      const newFav = !item.isFavorite;
      updatedItem = { ...item, isFavorite: newFav };
      return updatedItem;
    } else {
      return item;
    }
  });

  saveTimetableRegistry(registry);
  return updatedItem;
}

/**
 * Inizializza l'orario predefinito 4 BINF se l'archivio della scuola Volta viene selezionato
 */
export async function loadPresetVolta4Binf() {
  try {
    const res = await fetch('data/timetable.json?t=' + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const presetItem = {
      ...VOLTA_4_BINF_PRESET,
      lastUpdated: data.data_aggiornamento || new Date().toLocaleDateString('it-IT'),
      data
    };

    saveOrUpdateTimetable(presetItem, true);
    return presetItem;
  } catch (err) {
    console.error('[STORE] Errore caricamento preset Volta 4 BINF:', err);
    throw err;
  }
}

/**
 * Carica l'elenco di tutte le 64 classi disponibili dell'Istituto Volta da data/volta_classes.json
 */
let _cachedVoltaClasses = null;
export async function fetchVoltaClassesList() {
  if (_cachedVoltaClasses && _cachedVoltaClasses.length > 0) {
    return _cachedVoltaClasses;
  }
  try {
    const res = await fetch('data/volta_classes.json?t=' + Date.now());
    if (res.ok) {
      _cachedVoltaClasses = await res.json();
      return _cachedVoltaClasses;
    }
  } catch (e) {
    console.warn('[STORE] Impossibile caricare data/volta_classes.json:', e);
  }
  return [];
}

/**
 * Carica o estrae l'orario di una qualsiasi classe del Volta
 */
export async function loadVoltaClassTimetable(classObj) {
  if (!classObj) return null;

  // Se è 4 BINF, carica il preset ufficiale pre-estratto
  if (classObj.name === '4 BINF') {
    return await loadPresetVolta4Binf();
  }

  const itemId = 'volta_' + (classObj.code || classObj.name.toLowerCase().replace(/\s+/g, '_'));
  const existing = getTimetableById(itemId);

  if (existing && existing.data && existing.data.giorni && existing.data.giorni.length > 0) {
    setActiveTimetableId(itemId);
    return existing;
  }

  // Altrimenti estraiamo l'orario dall'URL Spaggiari EDT con Gemini tramite /api/extract
  const extractUrl = '/api/extract';
  const res = await fetch(extractUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageUrl: classObj.url,
      targetClass: classObj.name
    })
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Estrazione orario non riuscita');
  }

  const extracted = json.timetable;
  const newItem = {
    id: itemId,
    name: classObj.name,
    school: 'Istituto Tecnico A. Volta',
    sublabel: `Classe ${classObj.name} (EDT Spaggiari)`,
    type: 'volta_class',
    code: classObj.code,
    imageUrl: classObj.url,
    isFavorite: false,
    lastUpdated: extracted.data_aggiornamento || new Date().toLocaleDateString('it-IT'),
    data: extracted
  };

  saveOrUpdateTimetable(newItem, true);
  return newItem;
}
