/**
 * app.js - Controller Principale dell'Applicazione PWA OrarioScuola
 * Interfaccia dark AMOLED fedele al mockup: tutti gli orari visibili, linee guida sottili,
 * cursore live su Giorno e Settimana, card pulite solo Materia e Aula.
 */

import {
  timeToMinutes,
  minutesToTime,
  getSubjectThemeClass,
  getSmartDefaultDay,
  extractTimetableStructure,
  updateTimelineCursor,
  updateWeeklyLiveCursor,
  autoScrollToActiveLesson
} from './timeline.js';

import {
  computeClientWidgetState
} from './widget_helper.js';

import {
  getActiveTimetableId,
  setActiveTimetableId,
  getAllSavedTimetables,
  getTimetableById,
  saveOrUpdateTimetable,
  deleteTimetable,
  loadPresetVolta4Binf,
  getFavoriteTimetable,
  fetchVoltaClassesList,
  loadVoltaClassTimetable,
  normalizeTimetableMultiHourSlots,
  VOLTA_PRESET_ID
} from './timetable_store.js';

// Stato globale dell'applicazione
const state = {
  timetable: null,
  currentClass: localStorage.getItem('school_class') || '4 BINF',
  currentView: 'daily', // 'daily' | 'weekly'
  selectedDay: 'Lunedì',
  lastCalendarDay: null,
  simulatedTime: null, // null = ora reale, altrimenti Date
  hasAutoScrolled: false,
  voltaClasses: [],
  voltaSearchQuery: '',
  voltaFilterYear: 'all'
};

const DAY_ORDER = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'];

// Elementi DOM
const elements = {
  btnOpenDrawer: document.getElementById('btn-open-drawer'),
  btnViewDaily: document.getElementById('btn-view-daily'),
  btnViewWeekly: document.getElementById('btn-view-weekly'),
  viewDaily: document.getElementById('view-daily'),
  viewWeekly: document.getElementById('view-weekly'),

  // Header Cambio Classe
  btnHeaderChangeClass: document.getElementById('btn-header-change-class'),
  headerClassName: document.getElementById('header-class-name'),

  // Vista Giorno
  dailyDateTitle: document.getElementById('daily-date-title'),
  btnPrevDay: document.getElementById('btn-prev-day'),
  btnNextDay: document.getElementById('btn-next-day'),
  daysNav: document.querySelector('.days-nav'),
  timelineViewport: document.getElementById('timeline-viewport'),
  timelineContainer: document.getElementById('timeline-container'),
  timelineTimeColumn: document.getElementById('timeline-time-column'),
  lessonsList: document.getElementById('lessons-list'),

  // Vista Settimana
  weeklyScrollWrapper: document.getElementById('weekly-scroll-wrapper'),
  weeklyGridContainer: document.getElementById('weekly-grid-container'),

  // Drawer
  sidebarDrawer: document.getElementById('sidebar-drawer'),
  drawerOverlay: document.getElementById('drawer-overlay'),
  btnCloseDrawer: document.getElementById('btn-close-drawer'),
  drawerClassName: document.getElementById('drawer-class-name'),
  classSelect: document.getElementById('class-select'),
  btnToggleClassMenu: document.getElementById('btn-toggle-class-menu'),
  navItemSchedule: document.getElementById('nav-item-schedule'),
  navItemChangeClass: document.getElementById('nav-item-change-class'),
  navItemOriginalSchedule: document.getElementById('nav-item-original-schedule'),
  navItemSync: document.getElementById('nav-item-sync'),
  navItemWidget: document.getElementById('nav-item-widget'),
  navItemNotifications: document.getElementById('nav-item-notifications'),
  navItemSettings: document.getElementById('nav-item-settings'),
  drawerStatusText: document.getElementById('drawer-status-text'),
  drawerStatusDate: document.getElementById('drawer-status-date'),
  btnSyncNow: document.getElementById('btn-sync-now'),
  syncIcon: document.getElementById('sync-icon'),
  syncBtnLabel: document.getElementById('sync-btn-label'),

  // Banner Notifica Sincronizzazione
  syncBanner: document.getElementById('sync-banner'),
  syncBannerIconBox: document.getElementById('sync-banner-icon-box'),
  syncBannerSpinner: document.getElementById('sync-banner-spinner'),
  syncBannerCheck: document.getElementById('sync-banner-check'),
  syncBannerError: document.getElementById('sync-banner-error'),
  syncBannerTitle: document.getElementById('sync-banner-title'),
  syncBannerSubtitle: document.getElementById('sync-banner-subtitle'),

  // Modali
  modalWidget: document.getElementById('modal-widget'),
  btnCloseModalWidget: document.getElementById('btn-close-modal-widget'),
  widgetUrlDisplay: document.getElementById('widget-url-display'),
  btnCopyWidgetUrl: document.getElementById('btn-copy-widget-url'),

  // Elementi del Tutorial Widget
  tutorialStepper: document.getElementById('tutorial-stepper'),
  stepIndicators: document.querySelectorAll('.step-indicator'),
  tutorialSteps: document.querySelectorAll('.tutorial-step'),
  tutorialDots: document.querySelectorAll('#tutorial-dots .dot'),
  btnTutorialPrev: document.getElementById('btn-tutorial-prev'),
  btnTutorialNext: document.getElementById('btn-tutorial-next'),
  widgetFormulaFull: document.getElementById('widget-formula-full'),
  btnCopyFormulaFull: document.getElementById('btn-copy-formula-full'),
  mfCodeSub: document.getElementById('mf-code-sub'),
  mfCodeTime: document.getElementById('mf-code-time'),
  mfCodeNext: document.getElementById('mf-code-next'),
  btnMiniCopies: document.querySelectorAll('.btn-mini-copy'),

  modalSettings: document.getElementById('modal-settings'),
  btnCloseModalSettings: document.getElementById('btn-close-modal-settings'),
  simButtons: document.querySelectorAll('.sim-btn'),

  // Pagina Dedicata Cambia Orario (4 Modalità)
  appHeader: document.querySelector('.app-header'),
  viewChangeSchedule: document.getElementById('view-change-schedule'),
  btnBackToSchedule: document.getElementById('btn-back-to-schedule'),

  // Pagina Dedicata Orario Originale Scuola (EDT)
  viewOriginalSchedule: document.getElementById('view-original-schedule'),
  btnBackFromOriginal: document.getElementById('btn-back-from-original'),
  iframeOriginalSchedule: document.getElementById('iframe-original-schedule'),
  btnReloadOriginalIframe: document.getElementById('btn-reload-original-iframe'),
  btnExternalSchoolLink: document.getElementById('btn-external-school-link'),

  changeModePills: document.querySelectorAll('.change-mode-pill'),
  modalManageTimetables: document.getElementById('modal-manage-timetables'),
  btnCloseModalTimetable: document.getElementById('btn-close-modal-timetable'),
  btnOpenAddTimetable: document.getElementById('btn-open-add-timetable'),
  savedTimetablesList: document.getElementById('saved-timetables-list'),
  ttTabButtons: document.querySelectorAll('.tt-tab-btn'),
  ttTabContents: document.querySelectorAll('.tt-tab-content'),

  // Tab 1: Volta & Salvati
  inputSearchVoltaClasses: document.getElementById('input-search-volta-classes'),
  btnClearVoltaSearch: document.getElementById('btn-clear-volta-search'),
  catalogYearFilters: document.querySelectorAll('.year-filter-btn'),
  voltaAllClassesGrid: document.getElementById('volta-all-classes-grid'),
  voltaClassesCount: document.getElementById('volta-classes-count'),
  modalSavedTimetablesList: document.getElementById('modal-saved-timetables-list'),

  // Tab 2: PDF
  pdfDropzone: document.getElementById('pdf-dropzone'),
  inputTimetablePdf: document.getElementById('input-timetable-pdf'),
  pdfDropzoneText: document.getElementById('pdf-dropzone-text'),
  btnScanPdfClasses: document.getElementById('btn-scan-pdf-classes'),
  pdfClassesDiscoveryContainer: document.getElementById('pdf-classes-discovery-container'),
  pdfClassesCount: document.getElementById('pdf-classes-count'),
  btnSelectAllPdfClasses: document.getElementById('btn-select-all-pdf-classes'),
  btnDeselectAllPdfClasses: document.getElementById('btn-deselect-all-pdf-classes'),
  inputFilterPdfClasses: document.getElementById('input-filter-pdf-classes'),
  pdfClassesGrid: document.getElementById('pdf-classes-grid'),
  pdfBatchProgressBox: document.getElementById('pdf-batch-progress-box'),
  pdfBatchProgressText: document.getElementById('pdf-batch-progress-text'),
  pdfBatchProgressBar: document.getElementById('pdf-batch-progress-bar'),
  btnExtractSelectedPdfClasses: document.getElementById('btn-extract-selected-pdf-classes'),

  // Tab 3: Immagine
  imageDropzone: document.getElementById('image-dropzone'),
  inputTimetableImage: document.getElementById('input-timetable-image'),
  imageDropzoneText: document.getElementById('image-dropzone-text'),
  inputImageClassname: document.getElementById('input-image-classname'),
  btnExtractFromImage: document.getElementById('btn-extract-from-image'),

  // Tab 4: URL
  inputTimetableUrl: document.getElementById('input-timetable-url'),
  inputUrlClassname: document.getElementById('input-url-classname'),
  btnExtractFromUrl: document.getElementById('btn-extract-from-url'),

  // Feedback Estrazione
  extractionLoading: document.getElementById('extraction-loading'),
  extractionError: document.getElementById('extraction-error'),
  extractionErrorMsg: document.getElementById('extraction-error-msg')
};

let currentTutorialStep = 0;
const TOTAL_TUTORIAL_STEPS = 4;

/**
 * Gestione dello stato del tutorial guidato Widget
 */
function setTutorialStep(stepIndex) {
  if (stepIndex < 0 || stepIndex >= TOTAL_TUTORIAL_STEPS) return;
  currentTutorialStep = stepIndex;

  // Mostra lo step corretto
  elements.tutorialSteps.forEach((step, idx) => {
    step.classList.toggle('active', idx === currentTutorialStep);
  });

  // Aggiorna stepper tabs
  elements.stepIndicators.forEach((ind, idx) => {
    ind.classList.toggle('active', idx === currentTutorialStep);
  });

  // Aggiorna dots
  elements.tutorialDots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === currentTutorialStep);
  });

  // Aggiorna bottoni nav
  if (elements.btnTutorialPrev) {
    elements.btnTutorialPrev.disabled = currentTutorialStep === 0;
  }
  if (elements.btnTutorialNext) {
    if (currentTutorialStep === TOTAL_TUTORIAL_STEPS - 1) {
      elements.btnTutorialNext.textContent = 'Fatto ✓';
    } else {
      elements.btnTutorialNext.textContent = 'Avanti ›';
    }
  }
}

/**
 * Ottiene la data corrente o simulata
 */
function getCurrentDate() {
  return state.simulatedTime ? new Date(state.simulatedTime) : new Date();
}

/**
 * Inizializzazione PWA
 */
async function init() {
  registerServiceWorker();
  setupEventListeners();

  const currentOrigin = window.location.origin + window.location.pathname.replace('index.html', '');
  const widgetFullPath = `${currentOrigin}data/widget_data.json`;
  if (elements.widgetUrlDisplay) {
    elements.widgetUrlDisplay.textContent = widgetFullPath;
  }
  if (elements.widgetFormulaFull) {
    elements.widgetFormulaFull.textContent = `$if(wg("${widgetFullPath}", json, .status) = "IN_CLASS", "🟢 " + wg("${widgetFullPath}", json, .title) + " (" + wg("${widgetFullPath}", json, .room) + ") - " + wg("${widgetFullPath}", json, .time_left), "🔔 " + wg("${widgetFullPath}", json, .title) + " - " + wg("${widgetFullPath}", json, .subtitle))$`;
  }
  if (elements.mfCodeSub) {
    elements.mfCodeSub.textContent = `$wg("${widgetFullPath}", json, .title)$ ($wg("${widgetFullPath}", json, .room)$)`;
  }
  if (elements.mfCodeTime) {
    elements.mfCodeTime.textContent = `$wg("${widgetFullPath}", json, .time_left)$`;
  }
  if (elements.mfCodeNext) {
    elements.mfCodeNext.textContent = `$wg("${widgetFullPath}", json, .next_title)$ ($wg("${widgetFullPath}", json, .next_room)$)`;
  }

  renderSavedTimetablesList();
  initVoltaClassesCatalog().catch(e => console.warn('[INIT CATALOG WARN]', e));

  try {
    const activeId = getActiveTimetableId() || VOLTA_PRESET_ID;
    await loadTimetableById(activeId);
  } catch (err) {
    console.error('[INIT LOAD TIMETABLE ERROR]', err);
    try {
      const preset = await loadPresetVolta4Binf();
      await loadTimetableById(preset.id);
    } catch (e2) {
      console.error('[CRITICAL FALLBACK ERROR]', e2);
      try {
        const resp = await fetch('data/timetable.json?t=' + Date.now());
        if (resp.ok) {
          state.timetable = await resp.json();
          state.currentClass = state.timetable.classe || '4 BINF';
          if (elements.headerClassName) elements.headerClassName.textContent = state.currentClass;
          const now = getCurrentDate();
          state.lastCalendarDay = now.toDateString();
          state.selectedDay = getSmartDefaultDay(state.timetable.giorni, now);
          render();
          updateDrawerSyncStatus();
        }
      } catch (e3) {
        console.error('[FATAL FALLBACK]', e3);
      }
    }
  }

  // Tick real-time ogni 5 secondi
  setInterval(tick, 5000);
}

/**
 * Registrazione Service Worker per funzionamento offline
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => console.log('[PWA] Service Worker attivo:', reg.scope))
      .catch((err) => console.warn('[PWA] Errore Service Worker:', err));
  }
}

/**
 * Caricamento orario attivo per ID (preset Volta o orario custom)
 */
async function loadTimetableById(id) {
  if (!id) return;

  let item = getTimetableById(id);
  if (!item && id === VOLTA_PRESET_ID) {
    try {
      item = await loadPresetVolta4Binf();
    } catch (e) {
      console.warn('[DATI] Errore caricamento preset:', e);
    }
  }

  if (item && item.type === 'preset') {
    try {
      const response = await fetch('data/timetable.json?t=' + Date.now());
      if (response.ok) {
        state.timetable = await response.json();
        item.data = state.timetable;
        saveOrUpdateTimetable(item, false);
      } else if (item.data) {
        state.timetable = item.data;
      }
    } catch (e) {
      if (item.data) state.timetable = item.data;
    }
  } else if (item && item.data) {
    state.timetable = item.data;
  }

  if (!state.timetable) {
    try {
      const resp = await fetch('data/timetable.json?t=' + Date.now());
      if (resp.ok) {
        state.timetable = await resp.json();
        setActiveTimetableId(VOLTA_PRESET_ID);
      }
    } catch (fallbackErr) {
      console.warn('[DATI] Errore fetch fallback data/timetable.json:', fallbackErr);
    }
  }

  if (!state.timetable) {
    console.warn('[DATI] Nessun dato orario per ID:', id);
    openTimetableModal('preset');
    return;
  }

  state.timetable = normalizeTimetableMultiHourSlots(state.timetable);

  setActiveTimetableId(id || VOLTA_PRESET_ID);
  state.currentClass = (item && item.name) || state.timetable.classe || '4 BINF';
  if (elements.drawerClassName) {
    elements.drawerClassName.textContent = state.currentClass;
  }

  if (state.timetable) {
    updateDrawerSyncStatus();
  }

  // Giorno di partenza (giorno corrente fino alle 23:59 dello stesso giorno)
  const now = getCurrentDate();
  state.lastCalendarDay = now.toDateString();
  state.selectedDay = getSmartDefaultDay(state.timetable.giorni, now);

  renderSavedTimetablesList();
  updateClassSelectOptions();
  renderVoltaClassesGrid();

  if (state.currentView === 'change-schedule') {
    returnToScheduleView();
  } else {
    render();
  }

  setTimeout(() => {
    autoScrollToActiveLesson(elements.timelineContainer);
    state.hasAutoScrolled = true;
  }, 350);
}

/**
 * Inizializza il catalogo completo delle 64 classi dell'Istituto A. Volta
 */
async function initVoltaClassesCatalog() {
  try {
    state.voltaClasses = await fetchVoltaClassesList();
    renderVoltaClassesGrid();
  } catch (err) {
    console.warn('[VOLTA CATALOG] Errore caricamento catalogo classi:', err);
  }
}

/**
 * Renderizza la griglia filtrabile delle 64 classi del Volta
 */
function renderVoltaClassesGrid() {
  if (!elements.voltaAllClassesGrid) return;
  elements.voltaAllClassesGrid.innerHTML = '';

  const query = (state.voltaSearchQuery || '').toLowerCase().trim();
  const yearFilter = state.voltaFilterYear || 'all';

  const filtered = (state.voltaClasses || []).filter(cls => {
    // Filtro per anno
    if (yearFilter !== 'all' && cls.year !== parseInt(yearFilter, 10)) {
      return false;
    }
    // Filtro per ricerca testuale
    if (query) {
      const matchName = cls.name.toLowerCase().includes(query);
      const matchCode = cls.code.toLowerCase().includes(query);
      return matchName || matchCode;
    }
    return true;
  });

  if (elements.voltaClassesCount) {
    elements.voltaClassesCount.textContent = `${filtered.length} classi`;
  }

  if (filtered.length === 0) {
    const emptyEl = document.createElement('div');
    emptyEl.style.gridColumn = '1 / -1';
    emptyEl.style.padding = '20px 10px';
    emptyEl.style.textAlign = 'center';
    emptyEl.style.color = 'var(--text-dim)';
    emptyEl.style.fontSize = '0.78rem';
    emptyEl.textContent = 'Nessuna classe trovata per questo filtro.';
    elements.voltaAllClassesGrid.appendChild(emptyEl);
    return;
  }

  filtered.forEach(cls => {
    const card = document.createElement('div');
    const isActive = cls.name.trim().toUpperCase() === (state.currentClass || '').trim().toUpperCase();
    card.className = `volta-class-card ${isActive ? 'is-active' : ''}`;
    card.setAttribute('data-class', cls.name);

    const nameEl = document.createElement('span');
    nameEl.className = 'volta-class-name';
    nameEl.textContent = cls.name;

    const subEl = document.createElement('span');
    subEl.className = 'volta-class-sub';
    subEl.textContent = cls.year ? `${cls.year}° Anno` : 'Volta';

    card.appendChild(nameEl);
    card.appendChild(subEl);

    card.addEventListener('click', async () => {
      try {
        if (elements.extractionLoading) {
          elements.extractionLoading.classList.remove('hidden');
        }
        closeTimetableModal();
        const item = await loadVoltaClassTimetable(cls);
        if (item) {
          await loadTimetableById(item.id);
        }
      } catch (err) {
        console.error('[LOAD VOLTA CLASS ERROR]', err);
        alert(`Impossibile caricare l'orario della classe ${cls.name}: ${err.message}`);
      } finally {
        if (elements.extractionLoading) {
          elements.extractionLoading.classList.add('hidden');
        }
      }
    });

    elements.voltaAllClassesGrid.appendChild(card);
  });
}

/**
 * Caricamento dati da timetable.json (mantenuto per compatibilità sincronizzazione)
 */
async function loadTimetableData() {
  const activeId = getActiveTimetableId();
  if (activeId) {
    await loadTimetableById(activeId);
  } else {
    const fav = getFavoriteTimetable();
    if (fav) {
      await loadTimetableById(fav.id);
    } else {
      openTimetableModal('preset');
    }
  }
}

/**
 * Popola il selettore a capsula (elenco orari salvati) nel drawer in alto sotto MENU
 */
function updateClassSelectOptions() {
  if (!elements.classSelect) return;
  elements.classSelect.innerHTML = '';

  const list = getAllSavedTimetables();
  const activeId = getActiveTimetableId();

  // Gruppo Orari Salvati
  const group = document.createElement('optgroup');
  group.label = '— ORARI SALVATI —';

  list.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    const isAct = item.id === activeId;
    opt.textContent = `${isAct ? '✓ ' : ''}${item.name} (${item.school || 'Orario'})`;
    if (isAct) {
      opt.selected = true;
    }
    group.appendChild(opt);
  });
  elements.classSelect.appendChild(group);

  // Azione per caricare un altro orario
  const actionGroup = document.createElement('optgroup');
  actionGroup.label = '— AZIONI —';
  const newOpt = document.createElement('option');
  newOpt.value = '__new__';
  newOpt.textContent = '➕ Carica un altro orario...';
  actionGroup.appendChild(newOpt);
  elements.classSelect.appendChild(actionGroup);

  // Aggiorna etichetta sul selettore pill a capsula
  const activeItem = getTimetableById(activeId);
  if (elements.drawerClassName) {
    elements.drawerClassName.textContent = (activeItem && activeItem.name) || state.currentClass || '4 BINF';
  }
}

/**
 * Renderizza l'elenco degli orari salvati e aggiorna il selettore
 */
function renderSavedTimetablesList() {
  const list = getAllSavedTimetables();
  const activeId = getActiveTimetableId();

  // Aggiorna il selettore a capsula in cima sotto MENU
  updateClassSelectOptions();

  // Popolamento Lista nella Pagina Dedicata "Cambia Orario" (In alto: Orari già caricati)
  if (elements.modalSavedTimetablesList) {
    elements.modalSavedTimetablesList.innerHTML = '';

    list.forEach((item) => {
      const card = createTimetableCardElement(item, activeId, () => {
        closeTimetableModal();
        loadTimetableById(item.id);
      });
      elements.modalSavedTimetablesList.appendChild(card);
    });
  }
}

/**
 * Crea un elemento DOM per una card di orario salvato (design essenziale, senza stelline)
 */
function createTimetableCardElement(item, activeId, onSelect) {
  const card = document.createElement('div');
  const isActive = item.id === activeId;
  card.className = `saved-tt-item ${isActive ? 'is-active' : ''}`;

  // Icona basata sulla provenienza dell'orario
  let typeIcon = '🏛️';
  let defaultSchool = 'Istituto Tecnico A. Volta';
  if (item.type === 'custom_image') {
    typeIcon = '📷';
    defaultSchool = 'Orario da Immagine';
  } else if (item.type === 'custom_pdf') {
    typeIcon = '📄';
    defaultSchool = 'Orario da PDF';
  } else if (item.type === 'custom_url') {
    typeIcon = '🔗';
    defaultSchool = 'Orario da URL';
  } else if (item.type === 'volta_class') {
    typeIcon = '🏫';
    defaultSchool = 'Istituto Tecnico A. Volta';
  } else if (item.id === VOLTA_PRESET_ID) {
    typeIcon = '🏛️';
    defaultSchool = 'Istituto Volta • Predefinito';
  }

  const leftDiv = document.createElement('div');
  leftDiv.className = 'saved-tt-left';

  const iconBox = document.createElement('div');
  iconBox.className = 'saved-tt-icon-box';
  iconBox.textContent = typeIcon;

  const infoDiv = document.createElement('div');
  infoDiv.className = 'saved-tt-info';

  const nameSpan = document.createElement('div');
  nameSpan.className = 'saved-tt-name';
  nameSpan.innerHTML = `<span>${escapeHtml(item.name)}</span> ${isActive ? '<span class="active-tag"><span class="active-dot-live"></span>ATTIVO</span>' : ''}`;

  const schoolSpan = document.createElement('div');
  schoolSpan.className = 'saved-tt-school';
  schoolSpan.textContent = item.school || defaultSchool;

  infoDiv.appendChild(nameSpan);
  infoDiv.appendChild(schoolSpan);

  leftDiv.appendChild(iconBox);
  leftDiv.appendChild(infoDiv);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'saved-tt-actions';

  // Bottone Elimina solo icona (disponibile per tutti tranne il preset principale 4 BINF)
  if (item.id !== VOLTA_PRESET_ID) {
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-tt-delete-icon';
    delBtn.title = 'Elimina questo orario';
    delBtn.setAttribute('aria-label', 'Elimina orario');
    delBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    `;
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Vuoi rimuovere l'orario "${item.name}"?`)) {
        deleteTimetable(item.id);
        renderSavedTimetablesList();
        const newActive = getActiveTimetableId();
        if (newActive) {
          loadTimetableById(newActive);
        } else {
          loadPresetVolta4Binf().then(preset => loadTimetableById(preset.id));
        }
      }
    });
    actionsDiv.appendChild(delBtn);
  } else {
    const presetBadge = document.createElement('span');
    presetBadge.className = 'preset-tag-pill';
    presetBadge.textContent = 'Predefinito';
    actionsDiv.appendChild(presetBadge);
  }

  card.appendChild(leftDiv);
  card.appendChild(actionsDiv);

  // Click per selezionare e attivare l'orario
  card.addEventListener('click', () => {
    if (onSelect) onSelect();
  });

  return card;
}

/**
 * Gestione Pagina Dedicata Cambia Orario (Schermata Intera)
 */
function openChangeScheduleView(tab = 'image') {
  state.currentView = 'change-schedule';
  if (elements.viewDaily) {
    elements.viewDaily.classList.add('hidden-view');
    elements.viewDaily.classList.remove('active-view');
  }
  if (elements.viewWeekly) {
    elements.viewWeekly.classList.add('hidden-view');
    elements.viewWeekly.classList.remove('active-view');
  }
  if (elements.viewOriginalSchedule) {
    elements.viewOriginalSchedule.classList.add('hidden-view');
    elements.viewOriginalSchedule.classList.remove('active-view');
  }
  if (elements.viewChangeSchedule) {
    elements.viewChangeSchedule.classList.remove('hidden-view');
    elements.viewChangeSchedule.classList.add('active-view');
  }
  if (elements.appHeader) {
    elements.appHeader.style.display = 'none';
  }
  setChangeScheduleTab(tab);
  if (elements.extractionLoading) elements.extractionLoading.classList.add('hidden');
  if (elements.extractionError) elements.extractionError.classList.add('hidden');
}

/**
 * Gestione Pagina Dedicata Orario Originale Scuola (Portale EDT)
 */
function openOriginalScheduleView() {
  state.currentView = 'original-schedule';
  if (elements.viewDaily) {
    elements.viewDaily.classList.add('hidden-view');
    elements.viewDaily.classList.remove('active-view');
  }
  if (elements.viewWeekly) {
    elements.viewWeekly.classList.add('hidden-view');
    elements.viewWeekly.classList.remove('active-view');
  }
  if (elements.viewChangeSchedule) {
    elements.viewChangeSchedule.classList.add('hidden-view');
    elements.viewChangeSchedule.classList.remove('active-view');
  }
  if (elements.viewOriginalSchedule) {
    elements.viewOriginalSchedule.classList.remove('hidden-view');
    elements.viewOriginalSchedule.classList.add('active-view');
  }
  if (elements.appHeader) {
    elements.appHeader.style.display = 'none';
  }

  if (elements.iframeOriginalSchedule) {
    const targetUrl = 'orario-originale/index.html?classe=4%20BINF';
    if (!elements.iframeOriginalSchedule.src || elements.iframeOriginalSchedule.src === 'about:blank' || !elements.iframeOriginalSchedule.src.includes('orario-originale')) {
      elements.iframeOriginalSchedule.src = targetUrl;
    }
  }
}

function returnToScheduleView() {
  state.currentView = 'daily';
  if (elements.viewOriginalSchedule) {
    elements.viewOriginalSchedule.classList.add('hidden-view');
    elements.viewOriginalSchedule.classList.remove('active-view');
  }
  if (elements.viewChangeSchedule) {
    elements.viewChangeSchedule.classList.add('hidden-view');
    elements.viewChangeSchedule.classList.remove('active-view');
  }
  if (elements.viewWeekly) {
    elements.viewWeekly.classList.add('hidden-view');
    elements.viewWeekly.classList.remove('active-view');
  }
  if (elements.viewDaily) {
    elements.viewDaily.classList.remove('hidden-view');
    elements.viewDaily.classList.add('active-view');
  }
  if (elements.btnViewDaily) elements.btnViewDaily.classList.add('active');
  if (elements.btnViewWeekly) elements.btnViewWeekly.classList.remove('active');
  if (elements.appHeader) {
    elements.appHeader.style.display = '';
  }
  render();
}

function setChangeScheduleTab(tabName) {
  if (elements.changeModePills) {
    elements.changeModePills.forEach(btn => {
      const isSel = btn.getAttribute('data-tab') === tabName;
      btn.classList.toggle('active', isSel);
      btn.setAttribute('aria-selected', isSel ? 'true' : 'false');
    });
  }
  if (elements.ttTabContents) {
    elements.ttTabContents.forEach(content => {
      content.classList.toggle('active', content.id === `tab-content-${tabName}`);
    });
  }
}

// Retrocompatibilità per chiamate legacy
function openTimetableModal(initialTab = 'preset') {
  openChangeScheduleView(initialTab);
}

function closeTimetableModal() {
  returnToScheduleView();
}

function setTimetableModalTab(tabName) {
  setChangeScheduleTab(tabName);
}


/**
 * Raggruppa ore consecutive della stessa materia e aula in blocchi unici per qualsiasi numero di ore (es. 4, 5, 6 ore)
 * Se materia e aula sono uguali e non c'è ricreazione in mezzo -> blocco unico continuo
 * Riconosce dinamicamente tutte le ricreazioni (gap >= 8 min)
 */
function groupConsecutiveLessons(lessons) {
  if (!lessons || lessons.length === 0) return [];

  const groups = [];
  let i = 0;

  while (i < lessons.length) {
    const curr = lessons[i];
    const next = lessons[i + 1];

    let hasBreakAfter = false;
    let breakStart = '';
    let breakEnd = '';
    let breakDuration = 0;

    if (next) {
      const gap = timeToMinutes(next.inizio) - timeToMinutes(curr.fine);
      if (gap >= 8) {
        hasBreakAfter = true;
        breakStart = curr.fine;
        breakEnd = next.inizio;
        breakDuration = gap;
      }
    }

    if (next && curr.materia === next.materia && curr.aula === next.aula && !hasBreakAfter) {
      const afterDouble = lessons[i + 2];
      let breakAfterDouble = false;
      let dBreakStart = '';
      let dBreakEnd = '';
      let dBreakDuration = 0;
      if (afterDouble) {
        const gap2 = timeToMinutes(afterDouble.inizio) - timeToMinutes(next.fine);
        if (gap2 >= 8) {
          breakAfterDouble = true;
          dBreakStart = next.fine;
          dBreakEnd = afterDouble.inizio;
          dBreakDuration = gap2;
        }
      }

      groups.push({
        inizio: curr.inizio,
        fine: next.fine,
        materia: curr.materia,
        aula: curr.aula,
        is_double: true,
        has_break_after: breakAfterDouble
      });

      if (breakAfterDouble) {
        groups.push({
          is_break: true,
          inizio: dBreakStart,
          fine: dBreakEnd,
          duration: dBreakDuration
        });
      }

      i += 2;
    } else {
      groups.push({
        inizio: curr.inizio,
        fine: curr.fine,
        materia: curr.materia,
        aula: curr.aula,
        is_double: false,
        has_gap_after: !hasBreakAfter && next !== undefined,
        has_break_after: hasBreakAfter
      });

      if (hasBreakAfter) {
        groups.push({
          is_break: true,
          inizio: breakStart,
          fine: breakEnd,
          duration: breakDuration
        });
      }

      i += 1;
    }
  }

  return groups;
}

/**
 * Render dell'intera interfaccia
 */
function render() {
  if (!state.timetable) return;

  renderDailyHeader();
  renderDaysNav();

  if (state.currentView === 'daily') {
    renderDailyTimeline();
  } else {
    renderWeeklyView();
  }
}

/**
 * Render dell'intestazione data nel formato es. "LUNEDÌ 14 SETTEMBRE"
 */
function renderDailyHeader() {
  const dateMap = {
    'Lunedì': 'LUNEDÌ 14 SETTEMBRE',
    'Martedì': 'MARTEDÌ 15 SETTEMBRE',
    'Mercoledì': 'MERCOLEDÌ 16 SETTEMBRE',
    'Giovedì': 'GIOVEDÌ 17 SETTEMBRE',
    'Venerdì': 'VENERDÌ 18 SETTEMBRE'
  };

  const title = dateMap[state.selectedDay] || state.selectedDay.toUpperCase();
  if (elements.dailyDateTitle) {
    elements.dailyDateTitle.textContent = title;
  }
}

/**
 * Render chip compatti giorni (LUN, MAR, MER, GIO, VEN)
 */
function renderDaysNav() {
  if (!elements.daysNav) return;
  const chips = elements.daysNav.querySelectorAll('.day-chip');
  chips.forEach((chip) => {
    const day = chip.getAttribute('data-day');
    if (day === state.selectedDay) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
}

/**
 * Crea uno slot lezione (singolo o unito) nella timeline giornaliera
 */
function createDailyLessonSlot(lesson, start, end, slotClass) {
  const slot = document.createElement('div');
  slot.className = `timeline-lesson-row ${slotClass}`;
  slot.setAttribute('data-start', start);
  slot.setAttribute('data-end', end);

  const themeClass = getSubjectThemeClass(lesson.materia);

  slot.innerHTML = `
    <article class="lesson-card ${themeClass}" data-start="${start}" data-end="${end}">
      <div class="lesson-card-header">
        <h2 class="subject-title">${escapeHtml(lesson.materia)}</h2>
        <div class="room-title">${escapeHtml(lesson.aula)}</div>
      </div>
      <div class="card-active-footer">
        <span class="badge-in-corso">IN CORSO</span>
        <span class="time-left-text">Calcolo...</span>
      </div>
    </article>
  `;
  return slot;
}

/**
 * Crea la linea di base con cambio ora (08:54 / 08:58 o 10:48 / 10:52 o 12:42 / 12:46)
 * La linea orizzontale raggiunge la colonna oraria a sinistra
 * e passa sotto i blocchi uniti di 2 ore senza tagliarli.
 */
function createDailyDivider(startChange, endChange, dividerClass = '') {
  const div = document.createElement('div');
  div.className = `timeline-divider ${dividerClass}`;
  div.innerHTML = `
    <div class="divider-time-col">
      <span class="time-above">${startChange}</span>
      <span class="divider-notch-line"></span>
      <span class="time-below">${endChange}</span>
    </div>
    <div class="divider-line-col">
      <div class="divider-line"></div>
    </div>
  `;
  return div;
}

/**
 * Crea la linea estrema superiore (es. 08:00) o inferiore (es. 11:42 o 13:36)
 */
function createDailyEdge(timeStr, isBottom = false) {
  const edge = document.createElement('div');
  edge.className = `timeline-edge-row ${isBottom ? 'edge-bottom' : 'edge-top'}`;
  if (!isBottom) {
    edge.innerHTML = `
      <div class="edge-time-col">
        <span class="time-above">${timeStr}</span>
        <div class="edge-notch-line"></div>
      </div>
      <div class="edge-line-col">
        <div class="edge-line"></div>
      </div>
    `;
  } else {
    edge.innerHTML = `
      <div class="edge-time-col">
        <div class="edge-notch-line"></div>
        <span class="time-below">${timeStr}</span>
      </div>
      <div class="edge-line-col">
        <div class="edge-line"></div>
      </div>
    `;
  }
  return edge;
}

/**
 * Crea la riga della Ricreazione (supporta 1ª ricreazione 09:48-09:58 e 2ª ricreazione 11:42-11:52 o personalizzate)
 */
function createDailyBreakRow(start = '09:48', end = '09:58', label = '🔔 RICREAZIONE (10 MIN)') {
  const row = document.createElement('div');
  row.className = 'timeline-break-row';
  row.setAttribute('data-start', start);
  row.setAttribute('data-end', end);
  row.innerHTML = `
    <div class="break-time-col">
      <span class="time-above">${start}</span>
      <span class="time-below">${end}</span>
    </div>
    <div class="timeline-break-bar">
      <span>${escapeHtml(label)}</span>
    </div>
  `;
  return row;
}

/**
 * Render Timeline Giornaliera Continua Dinamica:
 * - Si adatta automaticamente a 4, 5 o 6 ore e a 1 o 2 ricreazioni
 * - Griglia continua a 2 colonne (Asse orari 52px + Area Card 1fr)
 * - Nei blocchi uniti (2 ore consecutive della stessa materia): blocco unico continuo SENZA linea interna
 * - Nella base: le linee divisorie passano sotto al blocco e raggiungono l'orario a sinistra
 * - Tra ore separate: la linea di base fa da separatore visivo con giunzione a filo e zero gap
 */
function renderDailyTimeline() {
  elements.viewDaily.classList.remove('hidden-view');
  elements.viewWeekly.classList.add('hidden-view');

  const dayData = (state.timetable.giorni || []).find(d => d.giorno === state.selectedDay);
  elements.lessonsList.innerHTML = '';
  if (elements.timelineTimeColumn) {
    elements.timelineTimeColumn.innerHTML = '';
  }

  if (!dayData || !dayData.lezioni || dayData.lezioni.length === 0) {
    elements.lessonsList.innerHTML = `
      <div style="padding: 50px 20px; text-align: center; color: var(--text-muted);">
        <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 6px;">Nessuna lezione in programma</p>
        <p style="font-size: 0.85rem;">Nessun orario previsto per ${state.selectedDay}</p>
      </div>
    `;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'daily-timeline-grid';

  // 1. Estrai la struttura completa a 6 ore (o superiore se presente nell'orario)
  const structure = extractTimetableStructure(state.timetable, 6);
  if (structure.length === 0) return;

  const templateRows = ['0px']; // Row 1: Edge Top
  const hourRowMap = new Map();  // ora -> gridRow
  let currentRow = 2;
  let dividerCount = 0;

  // Costruisci le righe della griglia CSS, divisori e ricreazioni
  for (let sIdx = 0; sIdx < structure.length; sIdx++) {
    const item = structure[sIdx];

    if (item.type === 'lesson') {
      hourRowMap.set(item.ora, currentRow);
      templateRows.push('var(--timeline-slot-height)');
      currentRow++;

      // Se il prossimo elemento è anch'esso una lezione, aggiungiamo il cambio ora ordinario (0px)
      const nextItem = structure[sIdx + 1];
      if (nextItem && nextItem.type === 'lesson') {
        dividerCount++;
        const div = createDailyDivider(item.end, nextItem.start, `divider-${dividerCount}`);
        div.style.gridRow = String(currentRow);
        grid.appendChild(div);

        templateRows.push('0px');
        currentRow++;
      }
    } else if (item.type === 'break') {
      templateRows.push('var(--timeline-break-height)');
      const breakRow = createDailyBreakRow(item.start, item.end, `🔔 ${item.label} (${item.duration} MIN)`);
      breakRow.style.gridRow = String(currentRow);
      grid.appendChild(breakRow);
      currentRow++;
    }
  }

  // Riga finale: Edge Bottom (orario fine 6ª ora, es. 13:36)
  const edgeBottomRow = currentRow;
  templateRows.push('0px');
  grid.style.gridTemplateRows = templateRows.join(' ');

  // 2. Inizio Giornata (Edge Top: inizio ora 1, es. 08:00)
  const firstSlot = structure.find(s => s.type === 'lesson' && s.ora === 1) || structure[0];
  const edgeTop = createDailyEdge(firstSlot.start, false);
  edgeTop.style.gridRow = '1';
  grid.appendChild(edgeTop);

  // 3. Fine Giornata (Edge Bottom: fine ora 6, es. 13:36)
  const lastSlot = structure.filter(s => s.type === 'lesson').pop() || structure[structure.length - 1];
  const edgeBottom = createDailyEdge(lastSlot.end, true);
  edgeBottom.style.gridRow = String(edgeBottomRow);
  grid.appendChild(edgeBottom);

  // 4. Inserimento Card per il giorno selezionato:
  // Valuta dinamicamente blocchi a ore doppie o singole per qualsiasi numero di ore (es. 4, 5, 6, 7 o 8)
  const dayLessons = dayData.lezioni || [];
  const lessonSlots = structure.filter(s => s.type === 'lesson');
  const handledHours = new Set();

  for (let i = 0; i < lessonSlots.length; i++) {
    const slotA = lessonSlots[i];
    const hA = slotA.ora;
    if (handledHours.has(hA)) continue;

    const slotB = lessonSlots[i + 1];
    const hB = slotB ? slotB.ora : null;
    const lA = dayLessons.find(l => l.ora === hA);
    const lB = hB ? dayLessons.find(l => l.ora === hB) : null;
    const rA = hourRowMap.get(hA);
    const rB = hB ? hourRowMap.get(hB) : null;

    // Controlla se c'è una ricreazione tra slotA e slotB
    const hasBreakBetween = structure.some(s => s.type === 'break' && s.gridRow > rA && s.gridRow < rB);

    if (slotB && !hasBreakBetween && lA && lB && lA.materia === lB.materia && lA.aula === lB.aula && rA && rB) {
      // Blocco doppio continuo (stessa materia e aula)
      const slot = createDailyLessonSlot(lA, lA.inizio, lB.fine, 'lesson-slot-double');
      slot.style.gridRow = `${rA} / ${rB + 1}`;
      grid.appendChild(slot);
      handledHours.add(hA);
      handledHours.add(hB);
    } else {
      if (lA && rA) {
        const slot = createDailyLessonSlot(lA, lA.inizio, lA.fine, 'lesson-slot-single');
        slot.style.gridRow = String(rA);
        grid.appendChild(slot);
      } else if (rA && slotA) {
        // Slot non riempito: elemento trasparente senza card per non mostrare nulla
        const emptySlot = document.createElement('div');
        emptySlot.className = 'timeline-lesson-row is-empty';
        emptySlot.setAttribute('data-start', slotA.start);
        emptySlot.setAttribute('data-end', slotA.end);
        emptySlot.style.gridRow = String(rA);
        grid.appendChild(emptySlot);
      }
      handledHours.add(hA);
    }
  }

  elements.lessonsList.appendChild(grid);

  requestAnimationFrame(() => {
    updateTimelineCursor(elements.timelineContainer, getCurrentDate());
  });
}

/**
 * Render Vista Settimanale:
 * - Griglia permanente con linee guida sottili grigie sotto (5 righe x 6 colonne)
 * - Asse orari a sinistra compatto (48px) attaccato direttamente alle colonne dei giorni
 * - Blocchi unici continui a tutta altezza per materie da 2 ore consecutive (stessa materia e aula)
 * - Nessuna linea laser invasiva sopra il testo delle card
 */
function renderWeeklyView() {
  elements.viewDaily.classList.add('hidden-view');
  elements.viewWeekly.classList.remove('hidden-view');

  // Re-inizializza container con linea live e cursore
  elements.weeklyGridContainer.innerHTML = `
    <div class="weekly-live-line" id="weekly-live-line"></div>
    <div class="weekly-live-cursor" id="weekly-live-cursor">
      <span class="cursor-dot"></span>
      <span class="cursor-time" id="weekly-cursor-time">--:--</span>
    </div>
  `;

  const giorni = state.timetable.giorni || [];
  const now = getCurrentDate();
  const currentDayIndex = now.getDay(); // 1 = Lun, 2 = Mar, ..., 5 = Ven

  // Estrai la struttura globale dinamica (ore 1..N e ricreazioni)
  const structure = extractTimetableStructure(state.timetable);
  if (structure.length === 0) return;

  const numCols = giorni.length + 1; // 1 colonna asse tempo + N colonne giorni
  elements.weeklyGridContainer.style.gridTemplateColumns = `48px repeat(${giorni.length}, minmax(105px, 1fr))`;

  // 1. CELLE DI SFONDO DELLA GRIGLIA PERMANENTE
  structure.forEach((item) => {
    for (let col = 1; col <= numCols; col++) {
      const slotBg = document.createElement('div');
      slotBg.className = `grid-slot-bg ${item.type === 'break' ? 'slot-break' : ''}`;
      slotBg.style.gridRow = String(item.gridRow);
      slotBg.style.gridColumn = String(col);
      elements.weeklyGridContainer.appendChild(slotBg);
    }
  });

  // 2. RIGA 1: Intestazioni (Angolo + Colonne Giorni)
  const cornerHeader = document.createElement('div');
  cornerHeader.className = 'grid-header-corner';
  cornerHeader.style.gridRow = '1';
  cornerHeader.style.gridColumn = '1';
  elements.weeklyGridContainer.appendChild(cornerHeader);

  const dateMap = {
    'Lunedì': '14/09',
    'Martedì': '15/09',
    'Mercoledì': '16/09',
    'Giovedì': '17/09',
    'Venerdì': '18/09',
    'Sabato': '19/09'
  };

  giorni.forEach((day, dIdx) => {
    const colHeader = document.createElement('div');
    const isToday = (dIdx + 1) === currentDayIndex;
    colHeader.className = `grid-header-day ${isToday ? 'is-today' : ''}`;
    colHeader.style.gridRow = '1';
    colHeader.style.gridColumn = String(dIdx + 2);

    const shortDay = day.giorno.slice(0, 3).toUpperCase();
    const dateStr = day.data_str || dateMap[day.giorno] || '';
    const todayBadgeHtml = isToday ? `<div class="today-chip-badge">OGGI</div>` : '';

    colHeader.innerHTML = `
      <div class="grid-day-name">${shortDay}</div>
      <div class="grid-day-date">${dateStr}</div>
      ${todayBadgeHtml}
    `;
    elements.weeklyGridContainer.appendChild(colHeader);
  });

  // 3. ASSE ORARI A SINISTRA (Colonna 1) E RIGHE RICREAZIONE A TUTTA LARGHEZZA
  const hourRowMap = new Map(); // ora -> item.gridRow

  structure.forEach((item) => {
    if (item.type === 'lesson') {
      hourRowMap.set(item.ora, item.gridRow);

      const timeBox = document.createElement('div');
      timeBox.className = 'grid-time-slot-box';
      timeBox.setAttribute('data-row', String(item.ora));
      timeBox.setAttribute('data-start-min', item.startMin);
      timeBox.setAttribute('data-end-min', item.endMin);
      timeBox.style.gridColumn = '1';
      timeBox.style.gridRow = String(item.gridRow);
      timeBox.innerHTML = `
        <span class="grid-time-start">${item.start}</span>
        <span class="grid-time-end">${item.end}</span>
      `;
      elements.weeklyGridContainer.appendChild(timeBox);
    } else if (item.type === 'break') {
      // Label orario ricreazione sull'asse sinistro
      const breakTimeBox = document.createElement('div');
      breakTimeBox.className = 'grid-break-time-label';
      breakTimeBox.setAttribute('data-start-min', item.startMin);
      breakTimeBox.setAttribute('data-end-min', item.endMin);
      breakTimeBox.style.gridColumn = '1';
      breakTimeBox.style.gridRow = String(item.gridRow);
      breakTimeBox.innerHTML = `<span>${item.start}</span><span>${item.end}</span>`;
      elements.weeklyGridContainer.appendChild(breakTimeBox);

      // Barra ricreazione che attraversa tutte le colonne dei giorni
      const breakCell = document.createElement('div');
      breakCell.className = 'grid-cell-break';
      breakCell.setAttribute('data-start-min', item.startMin);
      breakCell.setAttribute('data-end-min', item.endMin);
      breakCell.style.gridColumn = `2 / ${numCols + 1}`;
      breakCell.style.gridRow = String(item.gridRow);
      breakCell.innerHTML = `<span>🔔 ${item.label} (${item.duration} MIN)</span>`;
      elements.weeklyGridContainer.appendChild(breakCell);
    }
  });

  // 4. CELLE LEZIONI PER OGNI GIORNO (con unione blocchi continui da 2 ore)
  giorni.forEach((day, dIdx) => {
    const colStr = String(dIdx + 2);
    const lezioni = day.lezioni || [];
    let lIdx = 0;

    while (lIdx < lezioni.length) {
      const curr = lezioni[lIdx];
      const next = lezioni[lIdx + 1];

      // Controlla se curr e next possono essere uniti:
      // - stessa materia e stessa aula
      // - ore consecutive (next.ora === curr.ora + 1)
      // - nessuna ricreazione presente tra la fine di curr e l'inizio di next
      const hasBreakBetween = structure.some(s => s.type === 'break' && s.startMin >= timeToMinutes(curr.fine) && s.endMin <= timeToMinutes(next?.inizio));
      const isDouble = next && curr.materia === next.materia && curr.aula === next.aula && (next.ora === curr.ora + 1) && !hasBreakBetween;

      const rStart = hourRowMap.get(curr.ora);

      if (isDouble && rStart) {
        const rEnd = hourRowMap.get(next.ora) + 1;
        const doubleCell = createGridCell(curr, day.giorno, timeToMinutes(curr.inizio), timeToMinutes(next.fine), true);
        doubleCell.style.gridColumn = colStr;
        doubleCell.style.gridRow = `${rStart} / ${rEnd}`;
        elements.weeklyGridContainer.appendChild(doubleCell);
        lIdx += 2;
      } else if (rStart) {
        const singleCell = createGridCell(curr, day.giorno, timeToMinutes(curr.inizio), timeToMinutes(curr.fine), false);
        singleCell.style.gridColumn = colStr;
        singleCell.style.gridRow = String(rStart);
        elements.weeklyGridContainer.appendChild(singleCell);
        lIdx += 1;
      } else {
        lIdx += 1;
      }
    }
  });

  // Aggiorna cursore live nella settimana
  requestAnimationFrame(() => {
    updateWeeklyLiveCursor(elements.weeklyGridContainer, getCurrentDate());
  });
}

/**
 * Crea una cella per la griglia settimanale pulita (solo Materia e Aula)
 */
function createGridCell(lesson, giorno, startMin, endMin, isDouble = false) {
  const cell = document.createElement('div');
  const themeClass = getSubjectThemeClass(lesson.materia);
  const doubleClass = isDouble ? 'span-2-hours' : '';

  cell.className = `grid-cell-lesson ${themeClass} ${doubleClass}`;
  cell.setAttribute('data-day', giorno);
  cell.setAttribute('data-start-min', startMin);
  cell.setAttribute('data-end-min', endMin);

  cell.innerHTML = `
    <div class="grid-lesson-name">${escapeHtml(lesson.materia)}</div>
    <div class="grid-lesson-room">${escapeHtml(lesson.aula)}</div>
  `;

  return cell;
}

/**
 * Ciclo di aggiornamento temporale real-time (ogni 5 sec)
 */
function tick() {
  if (!state.timetable) return;

  const now = getCurrentDate();

  // Controllo scatto di mezzanotte: aggiorna automaticamente la schermata se scatta il nuovo giorno
  const todayStr = now.toDateString();
  if (state.lastCalendarDay && state.lastCalendarDay !== todayStr && !state.simulatedTime) {
    state.lastCalendarDay = todayStr;
    state.selectedDay = getSmartDefaultDay(state.timetable.giorni, now);
    render();
  }

  if (state.currentView === 'daily') {
    updateTimelineCursor(elements.timelineContainer, now);
  } else {
    updateWeeklyLiveCursor(elements.weeklyGridContainer, now);
  }
}

/**
 * Configurazione Event Listeners
 */
function setupEventListeners() {
  // Switch vista Giorno / Settimana
  elements.btnViewDaily.addEventListener('click', () => {
    state.currentView = 'daily';
    elements.btnViewDaily.classList.add('active');
    elements.btnViewWeekly.classList.remove('active');
    render();
  });

  elements.btnViewWeekly.addEventListener('click', () => {
    state.currentView = 'weekly';
    elements.btnViewWeekly.classList.add('active');
    elements.btnViewDaily.classList.remove('active');
    render();
  });

  // Navigazione giorno precedente / successivo
  elements.btnPrevDay.addEventListener('click', () => {
    const idx = DAY_ORDER.indexOf(state.selectedDay);
    const nextIdx = (idx - 1 + DAY_ORDER.length) % DAY_ORDER.length;
    state.selectedDay = DAY_ORDER[nextIdx];
    render();
  });

  elements.btnNextDay.addEventListener('click', () => {
    const idx = DAY_ORDER.indexOf(state.selectedDay);
    const nextIdx = (idx + 1) % DAY_ORDER.length;
    state.selectedDay = DAY_ORDER[nextIdx];
    render();
  });

  // Navigazione chip giorni
  elements.daysNav.addEventListener('click', (e) => {
    const chip = e.target.closest('.day-chip');
    if (!chip) return;
    state.selectedDay = chip.getAttribute('data-day');
    render();
  });

  // Drawer Apertura e Chiusura
  elements.btnOpenDrawer.addEventListener('click', () => toggleDrawer(true));
  elements.btnCloseDrawer.addEventListener('click', () => toggleDrawer(false));
  elements.drawerOverlay.addEventListener('click', () => toggleDrawer(false));

  // Voci Drawer
  elements.navItemSchedule.addEventListener('click', () => {
    toggleDrawer(false);
    returnToScheduleView();
  });
  elements.navItemChangeClass.addEventListener('click', () => {
    toggleDrawer(false);
    openChangeScheduleView('image');
  });
  if (elements.navItemOriginalSchedule) {
    elements.navItemOriginalSchedule.addEventListener('click', () => {
      toggleDrawer(false);
      openOriginalScheduleView();
    });
  }

  // Selettore Orario / Elenco a Capsula in drawer-top
  if (elements.classSelect) {
    elements.classSelect.addEventListener('change', async (e) => {
      const selectedVal = e.target.value;
      if (selectedVal === '__new__') {
        toggleDrawer(false);
        openChangeScheduleView('image');
        elements.classSelect.value = getActiveTimetableId();
        return;
      }

      if (selectedVal && selectedVal !== getActiveTimetableId()) {
        toggleDrawer(false);
        await loadTimetableById(selectedVal);
      }
    });
  }

  // Tasto Torna all'orario dalla schermata Cambia Orario
  if (elements.btnBackToSchedule) {
    elements.btnBackToSchedule.addEventListener('click', () => {
      returnToScheduleView();
    });
  }

  // Tasto Torna all'orario dalla schermata Orario Originale
  if (elements.btnBackFromOriginal) {
    elements.btnBackFromOriginal.addEventListener('click', () => {
      returnToScheduleView();
    });
  }

  // Pulsante Ricarica Iframe Orario Originale
  if (elements.btnReloadOriginalIframe && elements.iframeOriginalSchedule) {
    elements.btnReloadOriginalIframe.addEventListener('click', () => {
      elements.iframeOriginalSchedule.src = `orario-originale/index.html?classe=4%20BINF&_t=${Date.now()}`;
    });
  }

  // Switch modalità Cambia Orario (4 Bottoni)
  if (elements.changeModePills) {
    elements.changeModePills.forEach(pill => {
      pill.addEventListener('click', () => {
        const tab = pill.getAttribute('data-tab');
        setChangeScheduleTab(tab);
      });
    });
  }



  // Ricerca testuale classi Volta
  if (elements.inputSearchVoltaClasses) {
    elements.inputSearchVoltaClasses.addEventListener('input', (e) => {
      state.voltaSearchQuery = e.target.value;
      if (elements.btnClearVoltaSearch) {
        elements.btnClearVoltaSearch.classList.toggle('hidden', !state.voltaSearchQuery);
      }
      renderVoltaClassesGrid();
    });
  }

  if (elements.btnClearVoltaSearch) {
    elements.btnClearVoltaSearch.addEventListener('click', () => {
      state.voltaSearchQuery = '';
      if (elements.inputSearchVoltaClasses) elements.inputSearchVoltaClasses.value = '';
      elements.btnClearVoltaSearch.classList.add('hidden');
      renderVoltaClassesGrid();
    });
  }

  // Filtri per anno classi Volta
  if (elements.catalogYearFilters) {
    elements.catalogYearFilters.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.catalogYearFilters.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.voltaFilterYear = btn.getAttribute('data-year') || 'all';
        renderVoltaClassesGrid();
      });
    });
  }

  // Funzione unificata di estrazione Gemini per PDF, Immagini e URL
  async function performExtraction({ imageBase64, mimeType, imageUrl, targetClass, type, sourceUrl }) {
    try {
      if (elements.extractionLoading) elements.extractionLoading.classList.remove('hidden');
      if (elements.extractionError) elements.extractionError.classList.add('hidden');

      const bodyPayload = {
        targetClass: targetClass || 'Mio Orario'
      };
      if (imageBase64) {
        bodyPayload.imageBase64 = imageBase64;
        bodyPayload.mimeType = mimeType || 'image/png';
      }
      if (imageUrl) {
        bodyPayload.imageUrl = imageUrl;
      }

      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || json.details || 'Estrazione fallita');
      }

      const extracted = json.timetable;
      const customItem = {
        id: (type || 'custom') + '_' + Date.now(),
        name: extracted.classe || targetClass || 'Mio Orario',
        school: extracted.istituto || (type === 'custom_pdf' ? 'Orario PDF' : 'Orario Personale'),
        type: type || 'custom_upload',
        isFavorite: true,
        sourceUrl: sourceUrl || null,
        lastUpdated: extracted.data_aggiornamento || new Date().toLocaleDateString('it-IT'),
        data: extracted
      };

      saveOrUpdateTimetable(customItem, true);
      closeTimetableModal();
      await loadTimetableById(customItem.id);
    } catch (err) {
      console.error('[EXTRACTION ERROR]', err);
      if (elements.extractionError) {
        elements.extractionError.classList.remove('hidden');
        if (elements.extractionErrorMsg) {
          elements.extractionErrorMsg.textContent = 'Errore estrazione: ' + err.message;
        }
      }
    } finally {
      if (elements.extractionLoading) elements.extractionLoading.classList.add('hidden');
    }
  }

  // Tab 2: Carica da PDF con Scansione e Selezione Classi
  let selectedPdfBase64 = null;
  let discoveredPdfClasses = [];
  let selectedPdfClassesSet = new Set();
  let pdfSchoolName = '';

  function renderDiscoveredPdfClasses(filterQuery = '') {
    if (!elements.pdfClassesGrid) return;
    elements.pdfClassesGrid.innerHTML = '';

    const query = filterQuery.toLowerCase().trim();
    const filtered = discoveredPdfClasses.filter(c => !query || c.toLowerCase().includes(query));

    if (elements.pdfClassesCount) {
      elements.pdfClassesCount.textContent = `${discoveredPdfClasses.length} ${discoveredPdfClasses.length === 1 ? 'classe' : 'classi'}`;
    }

    if (filtered.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.style.cssText = 'color: var(--text-dim); font-size: 0.8rem; padding: 14px; grid-column: 1 / -1; text-align: center;';
      emptyNotice.textContent = query ? 'Nessuna classe corrispondente alla ricerca' : 'Nessuna classe rilevata nel documento';
      elements.pdfClassesGrid.appendChild(emptyNotice);
      updatePdfExtractButtonState();
      return;
    }

    filtered.forEach(className => {
      const chip = document.createElement('div');
      const isSelected = selectedPdfClassesSet.has(className);
      chip.className = `pdf-class-chip ${isSelected ? 'selected' : ''}`;
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'pdf-class-name';
      nameSpan.textContent = className;

      const checkSpan = document.createElement('span');
      checkSpan.className = 'pdf-class-check';
      checkSpan.textContent = isSelected ? '✓' : '';

      chip.appendChild(nameSpan);
      chip.appendChild(checkSpan);

      chip.addEventListener('click', () => {
        if (selectedPdfClassesSet.has(className)) {
          selectedPdfClassesSet.delete(className);
        } else {
          selectedPdfClassesSet.add(className);
        }
        renderDiscoveredPdfClasses(elements.inputFilterPdfClasses ? elements.inputFilterPdfClasses.value : '');
      });

      elements.pdfClassesGrid.appendChild(chip);
    });

    updatePdfExtractButtonState();
  }

  function updatePdfExtractButtonState() {
    if (!elements.btnExtractSelectedPdfClasses) return;
    const count = selectedPdfClassesSet.size;
    elements.btnExtractSelectedPdfClasses.disabled = count === 0;
    if (count === 0) {
      elements.btnExtractSelectedPdfClasses.innerHTML = '<span>Seleziona almeno una classe</span>';
    } else if (count === 1) {
      const singleClass = Array.from(selectedPdfClassesSet)[0];
      elements.btnExtractSelectedPdfClasses.innerHTML = `<span>Estrai Orario per <strong>${escapeHtml(singleClass)}</strong></span>`;
    } else {
      elements.btnExtractSelectedPdfClasses.innerHTML = `<span>Estrai Orario per <strong>${count} Classi Selezionate</strong></span>`;
    }
  }

  if (elements.inputTimetablePdf) {
    elements.inputTimetablePdf.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (elements.pdfDropzoneText) {
        elements.pdfDropzoneText.textContent = `PDF selezionato: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
      }
      if (elements.btnScanPdfClasses) {
        elements.btnScanPdfClasses.disabled = false;
        elements.btnScanPdfClasses.classList.remove('hidden');
      }

      // Reset eventuale scansione precedente su cambio file
      discoveredPdfClasses = [];
      selectedPdfClassesSet.clear();
      if (elements.pdfClassesDiscoveryContainer) {
        elements.pdfClassesDiscoveryContainer.classList.add('hidden');
      }

      const reader = new FileReader();
      reader.onload = () => {
        selectedPdfBase64 = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  if (elements.pdfDropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      elements.pdfDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        elements.pdfDropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      elements.pdfDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        elements.pdfDropzone.classList.remove('dragover');
      });
    });
    elements.pdfDropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      if (file && elements.inputTimetablePdf) {
        elements.inputTimetablePdf.files = e.dataTransfer.files;
        elements.inputTimetablePdf.dispatchEvent(new Event('change'));
      }
    });
  }

  // Scansione e Rilevamento Classi nel PDF tramite Gemini
  if (elements.btnScanPdfClasses) {
    elements.btnScanPdfClasses.addEventListener('click', async () => {
      if (!selectedPdfBase64) {
        alert('Seleziona prima un documento PDF.');
        return;
      }

      try {
        if (elements.extractionLoading) {
          elements.extractionLoading.classList.remove('hidden');
          const title = elements.extractionLoading.querySelector('.loading-title');
          const sub = elements.extractionLoading.querySelector('.loading-sub');
          if (title) title.textContent = 'Scansione PDF in corso...';
          if (sub) sub.textContent = 'Gemini sta rilevando tutte le classi presenti nel documento';
        }

        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: selectedPdfBase64,
            mimeType: 'application/pdf',
            mode: 'list_classes'
          })
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || json.details || 'Impossibile rilevare le classi dal PDF');
        }

        discoveredPdfClasses = Array.isArray(json.classes) ? json.classes : [];
        pdfSchoolName = json.school || 'Istituto Scolastico';
        selectedPdfClassesSet.clear();

        if (discoveredPdfClasses.length === 0) {
          alert('Nessuna classe rilevata automaticamente. Inserire una classe generica.');
          discoveredPdfClasses = ['Classe'];
        }

        // Seleziona la prima classe per agevolare l'utente
        selectedPdfClassesSet.add(discoveredPdfClasses[0]);

        if (elements.pdfClassesDiscoveryContainer) {
          elements.pdfClassesDiscoveryContainer.classList.remove('hidden');
        }

        renderDiscoveredPdfClasses();

        // Scroll morbido verso la sezione delle classi trovate
        if (elements.pdfClassesDiscoveryContainer) {
          elements.pdfClassesDiscoveryContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

      } catch (err) {
        console.error('[PDF DISCOVERY ERROR]', err);
        alert('Errore durante la scansione delle classi: ' + err.message);
      } finally {
        if (elements.extractionLoading) elements.extractionLoading.classList.add('hidden');
      }
    });
  }

  // Filtro ricerca classi
  if (elements.inputFilterPdfClasses) {
    elements.inputFilterPdfClasses.addEventListener('input', (e) => {
      renderDiscoveredPdfClasses(e.target.value);
    });
  }

  // Seleziona tutte le classi
  if (elements.btnSelectAllPdfClasses) {
    elements.btnSelectAllPdfClasses.addEventListener('click', () => {
      discoveredPdfClasses.forEach(c => selectedPdfClassesSet.add(c));
      renderDiscoveredPdfClasses(elements.inputFilterPdfClasses ? elements.inputFilterPdfClasses.value : '');
    });
  }

  // Deseleziona tutte le classi
  if (elements.btnDeselectAllPdfClasses) {
    elements.btnDeselectAllPdfClasses.addEventListener('click', () => {
      selectedPdfClassesSet.clear();
      renderDiscoveredPdfClasses(elements.inputFilterPdfClasses ? elements.inputFilterPdfClasses.value : '');
    });
  }

  // Estrazione mirata per ciascuna classe selezionata
  if (elements.btnExtractSelectedPdfClasses) {
    elements.btnExtractSelectedPdfClasses.addEventListener('click', async () => {
      const selectedClasses = Array.from(selectedPdfClassesSet);
      if (selectedClasses.length === 0) {
        alert('Seleziona almeno una classe da estrarre.');
        return;
      }

      if (!selectedPdfBase64) {
        alert('Documento PDF non disponibile. Ricarica il file.');
        return;
      }

      elements.btnExtractSelectedPdfClasses.disabled = true;
      if (elements.pdfBatchProgressBox) {
        elements.pdfBatchProgressBox.classList.remove('hidden');
      }

      let lastImportedId = null;
      const total = selectedClasses.length;

      try {
        for (let i = 0; i < total; i++) {
          const targetClass = selectedClasses[i];
          const progressPercent = Math.round(((i) / total) * 100);

          if (elements.pdfBatchProgressBar) {
            elements.pdfBatchProgressBar.style.width = `${progressPercent}%`;
          }
          if (elements.pdfBatchProgressText) {
            elements.pdfBatchProgressText.textContent = `Estrazione classe ${i + 1} di ${total}: ${targetClass}...`;
          }

          const res = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: selectedPdfBase64,
              mimeType: 'application/pdf',
              targetClass: targetClass
            })
          });

          const json = await res.json();
          if (!res.ok || !json.success) {
            console.warn(`[BATCH EXTRACT WARN] Estrazione fallita per ${targetClass}:`, json.error);
            continue;
          }

          const extracted = json.timetable;
          const customItem = {
            id: 'pdf_' + targetClass.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + '_' + Date.now(),
            name: extracted.classe || targetClass,
            school: extracted.istituto || pdfSchoolName || 'Orario PDF',
            type: 'custom_pdf',
            isFavorite: false,
            sourceUrl: null,
            lastUpdated: extracted.data_aggiornamento || new Date().toLocaleDateString('it-IT'),
            data: extracted
          };

          saveOrUpdateTimetable(customItem, true);
          lastImportedId = customItem.id;
        }

        if (elements.pdfBatchProgressBar) {
          elements.pdfBatchProgressBar.style.width = '100%';
        }
        if (elements.pdfBatchProgressText) {
          elements.pdfBatchProgressText.textContent = `Completato! ${total} ${total === 1 ? 'classe importata' : 'classi importate'}.`;
        }

        renderSavedTimetablesList();

        if (lastImportedId) {
          closeTimetableModal();
          await loadTimetableById(lastImportedId);
        } else {
          alert('Impossibile estrarre gli orari delle classi selezionate.');
        }

      } catch (err) {
        console.error('[BATCH EXTRACT ERROR]', err);
        alert('Errore durante l\'estrazione: ' + err.message);
      } finally {
        elements.btnExtractSelectedPdfClasses.disabled = false;
        if (elements.pdfBatchProgressBox) {
          setTimeout(() => {
            elements.pdfBatchProgressBox.classList.add('hidden');
          }, 2000);
        }
      }
    });
  }

  // Tab 3: Carica da Immagine
  let selectedImgBase64 = null;
  let selectedImgMime = 'image/png';
  if (elements.inputTimetableImage) {
    elements.inputTimetableImage.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (elements.imageDropzoneText) {
        elements.imageDropzoneText.textContent = `Immagine selezionata: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
      }
      if (elements.btnExtractFromImage) {
        elements.btnExtractFromImage.disabled = false;
      }

      selectedImgMime = file.type || 'image/png';
      const reader = new FileReader();
      reader.onload = () => {
        selectedImgBase64 = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  if (elements.imageDropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      elements.imageDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        elements.imageDropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      elements.imageDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        elements.imageDropzone.classList.remove('dragover');
      });
    });
    elements.imageDropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      if (file && elements.inputTimetableImage) {
        elements.inputTimetableImage.files = e.dataTransfer.files;
        elements.inputTimetableImage.dispatchEvent(new Event('change'));
      }
    });
  }

  if (elements.btnExtractFromImage) {
    elements.btnExtractFromImage.addEventListener('click', async () => {
      if (!selectedImgBase64) {
        alert('Seleziona prima una foto o screenshot.');
        return;
      }
      const className = elements.inputImageClassname?.value.trim() || 'Orario Immagine';
      await performExtraction({
        imageBase64: selectedImgBase64,
        mimeType: selectedImgMime,
        targetClass: className,
        type: 'custom_image'
      });
    });
  }

  // Tab 4: Carica da URL
  if (elements.btnExtractFromUrl) {
    elements.btnExtractFromUrl.addEventListener('click', async () => {
      const url = elements.inputTimetableUrl?.value.trim();
      const className = elements.inputUrlClassname?.value.trim() || 'Orario URL';

      if (!url) {
        alert('Inserisci l\'URL dell\'immagine o del PDF dell\'orario');
        return;
      }

      await performExtraction({
        imageUrl: url,
        targetClass: className,
        type: 'custom_url',
        sourceUrl: url
      });
    });
  }

  // Navigazione Wizard Tutorial Widget
  if (elements.btnTutorialPrev) {
    elements.btnTutorialPrev.addEventListener('click', () => {
      if (currentTutorialStep > 0) setTutorialStep(currentTutorialStep - 1);
    });
  }

  if (elements.btnTutorialNext) {
    elements.btnTutorialNext.addEventListener('click', () => {
      if (currentTutorialStep < TOTAL_TUTORIAL_STEPS - 1) {
        setTutorialStep(currentTutorialStep + 1);
      } else {
        elements.modalWidget.classList.remove('open');
      }
    });
  }

  elements.stepIndicators.forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = parseInt(btn.getAttribute('data-step'), 10);
      if (!isNaN(step)) setTutorialStep(step);
    });
  });

  elements.tutorialDots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const step = parseInt(dot.getAttribute('data-step'), 10);
      if (!isNaN(step)) setTutorialStep(step);
    });
  });

  // Copia Formula Completa KWGT
  if (elements.btnCopyFormulaFull && elements.widgetFormulaFull) {
    elements.btnCopyFormulaFull.addEventListener('click', () => {
      const formulaText = elements.widgetFormulaFull.textContent;
      navigator.clipboard.writeText(formulaText).then(() => {
        elements.btnCopyFormulaFull.textContent = 'Copiato!';
        setTimeout(() => {
          elements.btnCopyFormulaFull.textContent = 'Copia Formula';
        }, 2000);
      });
    });
  }

  // Copia Formule Singole KWGT
  elements.btnMiniCopies.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        navigator.clipboard.writeText(targetEl.textContent).then(() => {
          const orig = btn.textContent;
          btn.textContent = 'Copiato!';
          setTimeout(() => {
            btn.textContent = orig;
          }, 1800);
        });
      }
    });
  });


  // Pulsante Sincronizza nel Footer del Drawer
  if (elements.btnSyncNow) {
    elements.btnSyncNow.addEventListener('click', () => triggerSync());
  }

  // Voce "Sincronizza orario" nel Menu del Drawer
  if (elements.navItemSync) {
    elements.navItemSync.addEventListener('click', () => {
      toggleDrawer(false);
      triggerSync();
    });
  }

  // Copia link Widget S24
  elements.btnCopyWidgetUrl.addEventListener('click', () => {
    const textToCopy = elements.widgetUrlDisplay.textContent;
    navigator.clipboard.writeText(textToCopy).then(() => {
      elements.btnCopyWidgetUrl.textContent = 'Copiato!';
      setTimeout(() => {
        elements.btnCopyWidgetUrl.textContent = 'Copia Link';
      }, 2000);
    });
  });

  // Pulsanti Simulatore Orario
  elements.simButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      elements.simButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const simTime = btn.getAttribute('data-sim-time');
      const simDay = btn.getAttribute('data-sim-day');

      if (simTime === 'real') {
        state.simulatedTime = null;
        const now = new Date();
        state.lastCalendarDay = now.toDateString();
        state.selectedDay = getSmartDefaultDay(state.timetable.giorni, now);
      } else {
        const [h, m] = simTime.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);

        const dayIndexMap = { 'Domenica': 0, 'Lunedì': 1, 'Martedì': 2, 'Mercoledì': 3, 'Giovedì': 4, 'Venerdì': 5, 'Sabato': 6 };
        if (simDay && dayIndexMap[simDay] !== undefined) {
          state.selectedDay = simDay;
          const targetDay = dayIndexMap[simDay];
          const currentDay = d.getDay();
          const dayDiff = targetDay - currentDay;
          d.setDate(d.getDate() + dayDiff);
        }
        state.simulatedTime = d;
      }

      elements.modalSettings.classList.remove('open');
      render();
      if (state.currentView === 'daily') {
        autoScrollToActiveLesson(elements.timelineContainer);
      }
    });
  });
}


/**
 * Formatta la data e l'ora della sincronizzazione in stile italiano chiaro
 */
function formatItalianSyncDate(dateInput) {
  if (!dateInput) return null;
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  const isToday = d.getDate() === now.getDate() &&
                  d.getMonth() === now.getMonth() &&
                  d.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.getDate() === yesterday.getDate() &&
                      d.getMonth() === yesterday.getMonth() &&
                      d.getFullYear() === yesterday.getFullYear();

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (isToday) {
    return `Oggi alle ${timeStr}`;
  }
  if (isYesterday) {
    return `Ieri alle ${timeStr}`;
  }

  const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${timeStr}`;
}

/**
 * Aggiorna il testo e la data nel footer in basso del menu (drawer)
 */
function updateDrawerSyncStatus() {
  if (!elements.drawerStatusText || !elements.drawerStatusDate) return;

  const storedTimestamp = localStorage.getItem('orario_scuola_last_sync_timestamp');
  if (storedTimestamp) {
    const formatted = formatItalianSyncDate(storedTimestamp);
    if (formatted) {
      elements.drawerStatusText.textContent = 'SINCRONIZZAZIONE AVVENUTA';
      elements.drawerStatusDate.textContent = `- ${formatted}`;
      return;
    }
  }

  if (state.timetable) {
    const status = (state.timetable.stato_orario || 'ORARIO AGGIORNATO').toUpperCase();
    elements.drawerStatusText.textContent = status;
    elements.drawerStatusDate.textContent = `- ${state.timetable.data_aggiornamento || new Date().toLocaleDateString('it-IT')}`.toUpperCase();
  }
}

/**
 * Gestione Banner / Pop-up animato di Sincronizzazione
 */
let syncBannerTimeout = null;

function showSyncBanner(status, customTitle, customSubtitle) {
  if (!elements.syncBanner) return;

  if (syncBannerTimeout) {
    clearTimeout(syncBannerTimeout);
    syncBannerTimeout = null;
  }

  elements.syncBanner.classList.remove('hidden', 'anim-exit', 'is-success', 'is-error');
  elements.syncBanner.classList.add('anim-enter');

  if (status === 'loading') {
    elements.syncBannerSpinner?.classList.remove('hidden');
    elements.syncBannerCheck?.classList.add('hidden');
    elements.syncBannerError?.classList.add('hidden');
    if (elements.syncBannerTitle) {
      elements.syncBannerTitle.textContent = customTitle || 'Sincronizzazione in corso...';
    }
    if (elements.syncBannerSubtitle) {
      elements.syncBannerSubtitle.textContent = customSubtitle || 'Verifica e aggiornamento orario...';
    }
  } else if (status === 'success') {
    elements.syncBanner.classList.add('is-success');
    elements.syncBannerSpinner?.classList.add('hidden');
    elements.syncBannerCheck?.classList.remove('hidden');
    elements.syncBannerError?.classList.add('hidden');
    if (elements.syncBannerTitle) {
      elements.syncBannerTitle.textContent = customTitle || 'Sincronizzazione completata!';
    }
    if (elements.syncBannerSubtitle) {
      elements.syncBannerSubtitle.textContent = customSubtitle || 'Orario aggiornato con successo';
    }

    syncBannerTimeout = setTimeout(() => {
      dismissSyncBanner();
    }, 2400);
  } else if (status === 'error') {
    elements.syncBanner.classList.add('is-error');
    elements.syncBannerSpinner?.classList.add('hidden');
    elements.syncBannerCheck?.classList.add('hidden');
    elements.syncBannerError?.classList.remove('hidden');
    if (elements.syncBannerTitle) {
      elements.syncBannerTitle.textContent = customTitle || 'Sincronizzazione non riuscita';
    }
    if (elements.syncBannerSubtitle) {
      elements.syncBannerSubtitle.textContent = customSubtitle || 'Impossibile contattare il server';
    }

    syncBannerTimeout = setTimeout(() => {
      dismissSyncBanner();
    }, 3200);
  }
}

function dismissSyncBanner() {
  if (!elements.syncBanner || elements.syncBanner.classList.contains('hidden')) return;
  elements.syncBanner.classList.remove('anim-enter');
  elements.syncBanner.classList.add('anim-exit');
  setTimeout(() => {
    elements.syncBanner.classList.add('hidden');
    elements.syncBanner.classList.remove('anim-exit', 'is-success', 'is-error');
  }, 280);
}

/**
 * Trigger operazione di sincronizzazione orario con animazione e aggiornamento data
 */
let isSyncing = false;

async function triggerSync() {
  if (isSyncing) return;
  isSyncing = true;

  if (elements.btnSyncNow) {
    elements.btnSyncNow.classList.add('spinning');
  }
  if (elements.syncBtnLabel) {
    elements.syncBtnLabel.textContent = 'SINCRONIZZAZIONE...';
  }

  const currentClassName = state.currentClass || (state.timetable && state.timetable.classe) || 'la tua classe';
  showSyncBanner('loading', 'Sincronizzazione in corso...', `Verifica orario per ${currentClassName}...`);

  // Assicura una rotella fluida di almeno 650ms per un feedback visivo naturale
  const minSpinTimer = new Promise(resolve => setTimeout(resolve, 650));

  let success = false;
  let errorMsg = 'Impossibile aggiornare l\'orario';

  try {
    const response = await fetch('api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        class_name: state.currentClass,
        mode: 'single',
        force: true
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.timetable) {
        state.timetable = normalizeTimetableMultiHourSlots(data.timetable);
        localStorage.setItem('cached_timetable', JSON.stringify(state.timetable));
        render();
        success = true;
      } else {
        await loadTimetableData();
        success = true;
      }
    } else {
      await loadTimetableData();
      success = true;
    }
  } catch (err) {
    console.log('[SYNC] Server /api/sync non attivo, fallback locale:', err.message);
    try {
      await loadTimetableData();
      success = true;
    } catch (e) {
      success = false;
      errorMsg = e.message || 'Errore di connessione';
    }
  }

  await minSpinTimer;

  const now = new Date();
  if (success) {
    localStorage.setItem('orario_scuola_last_sync_timestamp', now.toISOString());
    const formattedDate = formatItalianSyncDate(now);

    updateDrawerSyncStatus();
    showSyncBanner('success', 'Sincronizzazione completata!', `Aggiornato: ${formattedDate}`);

    if (elements.syncBtnLabel) {
      elements.syncBtnLabel.textContent = 'AGGIORNATO! ✓';
    }
  } else {
    showSyncBanner('error', 'Sincronizzazione fallita', errorMsg);
    if (elements.syncBtnLabel) {
      elements.syncBtnLabel.textContent = 'ERRORE';
    }
  }

  setTimeout(() => {
    if (elements.syncBtnLabel) {
      elements.syncBtnLabel.textContent = 'SINCRONIZZA ORARIO';
    }
    if (elements.btnSyncNow) {
      elements.btnSyncNow.classList.remove('spinning');
    }
    isSyncing = false;
  }, 2200);
}

function toggleDrawer(open) {
  if (open) {
    updateDrawerSyncStatus();
    elements.sidebarDrawer.classList.add('open');
    elements.drawerOverlay.classList.add('open');
    elements.sidebarDrawer.setAttribute('aria-hidden', 'false');
  } else {
    elements.sidebarDrawer.classList.remove('open');
    elements.drawerOverlay.classList.remove('open');
    elements.sidebarDrawer.setAttribute('aria-hidden', 'true');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init().catch(err => console.error('[INIT FATAL]', err));
  });
} else {
  init().catch(err => console.error('[INIT FATAL]', err));
}
