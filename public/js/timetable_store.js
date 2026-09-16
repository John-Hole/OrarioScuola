/**
 * timetable_store.js - Gestore centralizzato per Multi-Orario e Preferiti
 * Memorizza in localStorage gli orari caricati dall'utente (precaricati Volta, URL o File)
 * e tiene traccia dell'orario preferito (⭐) e di quello attualmente attivo.
 */

const STORAGE_KEY = 'smart_timetable_registry_v1';

export const VOLTA_PRESET_ID = 'volta_4_binf';

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
