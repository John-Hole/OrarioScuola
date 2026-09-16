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
  toggleFavoriteTimetable,
  loadPresetVolta4Binf,
  getFavoriteTimetable,
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
  hasAutoScrolled: false
};

const DAY_ORDER = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'];

// Elementi DOM
const elements = {
  btnOpenDrawer: document.getElementById('btn-open-drawer'),
  btnViewDaily: document.getElementById('btn-view-daily'),
  btnViewWeekly: document.getElementById('btn-view-weekly'),
  viewDaily: document.getElementById('view-daily'),
  viewWeekly: document.getElementById('view-weekly'),

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
  navItemSchedule: document.getElementById('nav-item-schedule'),
  navItemChangeClass: document.getElementById('nav-item-change-class'),
  navItemSync: document.getElementById('nav-item-sync'),
  navItemWidget: document.getElementById('nav-item-widget'),
  navItemNotifications: document.getElementById('nav-item-notifications'),
  navItemSettings: document.getElementById('nav-item-settings'),
  drawerStatusText: document.getElementById('drawer-status-text'),
  drawerStatusDate: document.getElementById('drawer-status-date'),
  btnSyncNow: document.getElementById('btn-sync-now'),
  syncIcon: document.getElementById('sync-icon'),
  syncBtnLabel: document.getElementById('sync-btn-label'),

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

  // Modale Gestione Orari & Onboarding Multi-Orario
  modalManageTimetables: document.getElementById('modal-manage-timetables'),
  btnCloseModalTimetable: document.getElementById('btn-close-modal-timetable'),
  btnOpenAddTimetable: document.getElementById('btn-open-add-timetable'),
  savedTimetablesList: document.getElementById('saved-timetables-list'),
  ttTabButtons: document.querySelectorAll('.tt-tab-btn'),
  ttTabContents: document.querySelectorAll('.tt-tab-content'),
  btnSelect4binf: document.getElementById('btn-select-4binf'),
  starBtn4binf: document.getElementById('star-btn-4binf'),
  presetOtherChips: document.querySelectorAll('.class-chip'),
  inputTimetableUrl: document.getElementById('input-timetable-url'),
  inputUrlClassname: document.getElementById('input-url-classname'),
  btnExtractFromUrl: document.getElementById('btn-extract-from-url'),
  inputTimetableFile: document.getElementById('input-timetable-file'),
  inputFileClassname: document.getElementById('input-file-classname'),
  btnExtractFromFile: document.getElementById('btn-extract-from-file'),
  fileDropzone: document.getElementById('file-dropzone'),
  dropzoneText: document.getElementById('dropzone-text'),
  extractionLoading: document.getElementById('extraction-loading'),
  extractionError: document.getElementById('extraction-error'),
  extractionErrorMsg: document.getElementById('extraction-error-msg'),
  modalSavedTimetablesList: document.getElementById('modal-saved-timetables-list'),
  modalCustomTimetablesSection: document.getElementById('modal-custom-timetables-section')
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

  applyCalibration(state.calibration);
  updateCalibrationReadout();

  renderSavedTimetablesList();

  try {
    const activeId = getActiveTimetableId();
    if (activeId) {
      await loadTimetableById(activeId);
    } else {
      // Se non c'è un ID attivo esplicito, verifichiamo se c'è un preferito salvato
      const fav = getFavoriteTimetable();
      if (fav) {
        await loadTimetableById(fav.id);
      } else {
        // All'avvio carica direttamente il preset Volta 4 BINF senza bloccare l'utente con popup
        const preset = await loadPresetVolta4Binf();
        await loadTimetableById(preset.id);
      }
    }
  } catch (err) {
    console.error('[INIT LOAD TIMETABLE ERROR]', err);
    try {
      const resp = await fetch('data/timetable.json?t=' + Date.now());
      if (resp.ok) {
        state.timetable = await resp.json();
        const now = getCurrentDate();
        state.lastCalendarDay = now.toDateString();
        state.selectedDay = getSmartDefaultDay(state.timetable.giorni, now);
        render();
      }
    } catch (e2) {
      console.error('[CRITICAL FALLBACK ERROR]', e2);
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
    console.warn('[DATI] Nessun dato orario per ID:', id);
    openTimetableModal('preset');
    return;
  }

  setActiveTimetableId(id);
  state.currentClass = item.name || state.timetable.classe || '4 BINF';


  if (state.timetable) {
    if (elements.drawerStatusText) {
      elements.drawerStatusText.textContent = (state.timetable.stato_orario || 'ORARIO ATTIVO').toUpperCase();
    }
    if (elements.drawerStatusDate) {
      elements.drawerStatusDate.textContent = `- ${state.timetable.data_aggiornamento || new Date().toLocaleDateString('it-IT')}`.toUpperCase();
    }
  }

  // Giorno di partenza (giorno corrente fino alle 23:59 dello stesso giorno)
  const now = getCurrentDate();
  state.lastCalendarDay = now.toDateString();
  state.selectedDay = getSmartDefaultDay(state.timetable.giorni, now);

  renderSavedTimetablesList();
  render();

  setTimeout(() => {
    autoScrollToActiveLesson(elements.timelineContainer);
    state.hasAutoScrolled = true;
  }, 350);
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
 * Renderizza l'elenco degli orari salvati nel Drawer laterale e nel Modale
 */
function renderSavedTimetablesList() {
  const list = getAllSavedTimetables();
  const activeId = getActiveTimetableId();

  // 1. Popolamento Lista nel Drawer
  if (elements.savedTimetablesList) {
    elements.savedTimetablesList.innerHTML = '';

    if (list.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.style.fontSize = '0.74rem';
      emptyNotice.style.color = 'var(--text-dim)';
      emptyNotice.style.padding = '6px 4px';
      emptyNotice.textContent = 'Nessun orario salvato. Tocca + Aggiungi.';
      elements.savedTimetablesList.appendChild(emptyNotice);
    } else {
      list.forEach((item) => {
        const card = createTimetableCardElement(item, activeId, () => {
          toggleDrawer(false);
          loadTimetableById(item.id);
        });
        elements.savedTimetablesList.appendChild(card);
      });
    }
  }

  // 2. Popolamento Lista nel Modale "Cambia Orario" (Tab 1: Orari Salvati)
  if (elements.modalSavedTimetablesList && elements.modalCustomTimetablesSection) {
    elements.modalSavedTimetablesList.innerHTML = '';
    const customList = list.filter(item => item.type !== 'preset');

    if (customList.length === 0) {
      elements.modalCustomTimetablesSection.style.display = 'none';
    } else {
      elements.modalCustomTimetablesSection.style.display = 'block';
      customList.forEach((item) => {
        const card = createTimetableCardElement(item, activeId, () => {
          closeTimetableModal();
          loadTimetableById(item.id);
        });
        elements.modalSavedTimetablesList.appendChild(card);
      });
    }
  }
}

/**
 * Crea un elemento DOM per una card di orario salvato
 */
function createTimetableCardElement(item, activeId, onSelect) {
  const card = document.createElement('div');
  const isActive = item.id === activeId;
  card.className = `saved-tt-item ${isActive ? 'is-active' : ''}`;

  const infoDiv = document.createElement('div');
  infoDiv.className = 'saved-tt-info';

  const nameSpan = document.createElement('div');
  nameSpan.className = 'saved-tt-name';
  nameSpan.innerHTML = `<span>${item.name}</span> ${isActive ? '<span class="active-tag">ATTIVO</span>' : ''}`;

  const schoolSpan = document.createElement('div');
  schoolSpan.className = 'saved-tt-school';
  schoolSpan.textContent = item.school || (item.type === 'preset' ? 'Istituto A. Volta' : 'Orario Personale');

  infoDiv.appendChild(nameSpan);
  infoDiv.appendChild(schoolSpan);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'saved-tt-actions';

  // Bottone Stellina Preferito ⭐
  const starBtn = document.createElement('button');
  starBtn.className = `btn-tt-star ${item.isFavorite ? 'active' : ''}`;
  starBtn.title = item.isFavorite ? 'Rimuovi dai preferiti' : 'Imposta come preferito';
  starBtn.innerHTML = '★';
  starBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavoriteTimetable(item.id);
    renderSavedTimetablesList();
  });
  actionsDiv.appendChild(starBtn);

  // Bottone Cestino se personalizzato
  if (item.type !== 'preset') {
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-tt-delete';
    delBtn.title = 'Elimina questo orario';
    delBtn.innerHTML = '🗑️';
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
  }

  card.appendChild(infoDiv);
  card.appendChild(actionsDiv);

  // Click per selezionare e attivare l'orario
  card.addEventListener('click', () => {
    if (onSelect) onSelect();
  });

  return card;
}

/**
 * Gestione Modale Seleziona / Aggiungi Orario
 */
function openTimetableModal(initialTab = 'preset') {
  if (!elements.modalManageTimetables) return;
  setTimetableModalTab(initialTab);
  if (elements.extractionLoading) elements.extractionLoading.classList.add('hidden');
  if (elements.extractionError) elements.extractionError.classList.add('hidden');
  elements.modalManageTimetables.classList.add('open');
}

function closeTimetableModal() {
  if (!elements.modalManageTimetables) return;
  elements.modalManageTimetables.classList.remove('open');
}

function setTimetableModalTab(tabName) {
  if (elements.ttTabButtons) {
    elements.ttTabButtons.forEach(btn => {
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
  elements.navItemSchedule.addEventListener('click', () => toggleDrawer(false));
  elements.navItemChangeClass.addEventListener('click', () => {
    toggleDrawer(false);
    openTimetableModal('preset');
  });
  if (elements.btnOpenAddTimetable) {
    elements.btnOpenAddTimetable.addEventListener('click', () => {
      toggleDrawer(false);
      openTimetableModal('preset');
    });
  }
  elements.navItemSync.addEventListener('click', () => triggerSync());
  elements.navItemWidget.addEventListener('click', () => {
    toggleDrawer(false);
    setTutorialStep(0);
    elements.modalWidget.classList.add('open');
  });
  elements.navItemNotifications.addEventListener('click', () => {
    alert('Notifiche attive: riceverai un avviso al cambio dell\'ora e al suono della campanella.');
  });
  elements.navItemSettings.addEventListener('click', () => {
    toggleDrawer(false);
    elements.modalSettings.classList.add('open');
  });

  // Chiusura Modali
  elements.btnCloseModalWidget.addEventListener('click', () => elements.modalWidget.classList.remove('open'));
  elements.btnCloseModalSettings.addEventListener('click', () => elements.modalSettings.classList.remove('open'));

  // Gestione Modale Orari & Onboarding
  if (elements.btnCloseModalTimetable) {
    elements.btnCloseModalTimetable.addEventListener('click', closeTimetableModal);
  }
  if (elements.modalManageTimetables) {
    elements.modalManageTimetables.addEventListener('click', (e) => {
      if (e.target === elements.modalManageTimetables) closeTimetableModal();
    });
  }

  // Switch Tab Modale Orari
  if (elements.ttTabButtons) {
    elements.ttTabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        setTimetableModalTab(tab);
      });
    });
  }

  // Tab 1: Selezione Preset Volta 4 BINF
  if (elements.btnSelect4binf) {
    elements.btnSelect4binf.addEventListener('click', async () => {
      try {
        elements.btnSelect4binf.textContent = 'Caricamento...';
        const preset = await loadPresetVolta4Binf();
        closeTimetableModal();
        await loadTimetableById(preset.id);
      } catch (err) {
        console.error('[PRESET LOAD ERROR]', err);
        alert('Impossibile caricare l\'orario 4 BINF: ' + err.message);
      } finally {
        if (elements.btnSelect4binf) elements.btnSelect4binf.textContent = 'Seleziona e Apri';
      }
    });
  }

  if (elements.starBtn4binf) {
    elements.starBtn4binf.addEventListener('click', () => {
      elements.starBtn4binf.classList.toggle('active');
    });
  }

  // Chip altre classi della scuola Volta
  if (elements.presetOtherChips) {
    elements.presetOtherChips.forEach(chip => {
      chip.addEventListener('click', async () => {
        const clsName = chip.getAttribute('data-class');
        const customItem = {
          id: 'volta_' + clsName.toLowerCase().replace(/\s+/g, '_'),
          name: clsName,
          school: 'Istituto Tecnico A. Volta',
          type: 'preset_other',
          isFavorite: false,
          lastUpdated: new Date().toLocaleDateString('it-IT'),
          data: state.timetable || {}
        };
        saveOrUpdateTimetable(customItem, true);
        closeTimetableModal();
        await loadTimetableById(customItem.id);
      });
    });
  }

  // Tab 2: Estrazione da URL con Gemini
  if (elements.btnExtractFromUrl) {
    elements.btnExtractFromUrl.addEventListener('click', async () => {
      const url = elements.inputTimetableUrl?.value.trim();
      const className = elements.inputUrlClassname?.value.trim();

      if (!url) {
        alert('Inserisci l\'URL dell\'immagine o del PDF dell\'orario');
        return;
      }

      try {
        if (elements.extractionLoading) elements.extractionLoading.classList.remove('hidden');
        if (elements.extractionError) elements.extractionError.classList.add('hidden');

        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: url, targetClass: className })
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || json.details || 'Estrazione fallita');
        }

        const extracted = json.timetable;
        const customItem = {
          id: 'custom_url_' + Date.now(),
          name: extracted.classe || className || 'Mio Orario',
          school: extracted.istituto || 'Scuola',
          type: 'custom_url',
          isFavorite: true,
          sourceUrl: url,
          lastUpdated: extracted.data_aggiornamento || new Date().toLocaleDateString('it-IT'),
          data: extracted
        };

        saveOrUpdateTimetable(customItem, true);
        closeTimetableModal();
        await loadTimetableById(customItem.id);
      } catch (err) {
        console.error('[EXTRACT URL ERROR]', err);
        if (elements.extractionError) {
          elements.extractionError.classList.remove('hidden');
          if (elements.extractionErrorMsg) {
            elements.extractionErrorMsg.textContent = 'Errore Gemini: ' + err.message;
          }
        }
      } finally {
        if (elements.extractionLoading) elements.extractionLoading.classList.add('hidden');
      }
    });
  }

  // Tab 3: Estrazione da Foto o PDF con Gemini
  let selectedFileBase64 = null;
  let selectedFileMime = null;

  if (elements.inputTimetableFile) {
    elements.inputTimetableFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (elements.dropzoneText) {
        elements.dropzoneText.textContent = `Selezionato: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
      }
      if (elements.btnExtractFromFile) {
        elements.btnExtractFromFile.disabled = false;
      }

      selectedFileMime = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/png');
      const reader = new FileReader();
      reader.onload = () => {
        selectedFileBase64 = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  if (elements.fileDropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      elements.fileDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        elements.fileDropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      elements.fileDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        elements.fileDropzone.classList.remove('dragover');
      });
    });
    elements.fileDropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      if (file && elements.inputTimetableFile) {
        elements.inputTimetableFile.files = e.dataTransfer.files;
        elements.inputTimetableFile.dispatchEvent(new Event('change'));
      }
    });
  }

  if (elements.btnExtractFromFile) {
    elements.btnExtractFromFile.addEventListener('click', async () => {
      if (!selectedFileBase64) {
        alert('Seleziona prima una foto o un documento PDF.');
        return;
      }

      const className = elements.inputFileClassname?.value.trim();

      try {
        if (elements.extractionLoading) elements.extractionLoading.classList.remove('hidden');
        if (elements.extractionError) elements.extractionError.classList.add('hidden');

        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: selectedFileBase64,
            mimeType: selectedFileMime,
            targetClass: className
          })
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || json.details || 'Estrazione fallita');
        }

        const extracted = json.timetable;
        const customItem = {
          id: 'custom_file_' + Date.now(),
          name: extracted.classe || className || 'Mio Orario',
          school: extracted.istituto || 'Scuola',
          type: 'custom_file',
          isFavorite: true,
          lastUpdated: extracted.data_aggiornamento || new Date().toLocaleDateString('it-IT'),
          data: extracted
        };

        saveOrUpdateTimetable(customItem, true);
        closeTimetableModal();
        await loadTimetableById(customItem.id);
      } catch (err) {
        console.error('[EXTRACT FILE ERROR]', err);
        if (elements.extractionError) {
          elements.extractionError.classList.remove('hidden');
          if (elements.extractionErrorMsg) {
            elements.extractionErrorMsg.textContent = 'Errore Gemini: ' + err.message;
          }
        }
      } finally {
        if (elements.extractionLoading) elements.extractionLoading.classList.add('hidden');
      }
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


  // Pulsante Sincronizza
  elements.btnSyncNow.addEventListener('click', () => triggerSync());

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


async function triggerSync() {
  elements.btnSyncNow.classList.add('spinning');
  elements.syncBtnLabel.textContent = 'Scansione Gemini...';

  try {
    // Tenta la sincronizzazione dinamica con Gemini tramite l'endpoint del server locale
    const response = await fetch('api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        class_name: state.currentClass,
        mode: 'single', // Singola scansione per trigger manuale dell'utente
        force: true
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.timetable) {
        state.timetable = data.timetable;
        localStorage.setItem('cached_timetable', JSON.stringify(state.timetable));
        if (elements.drawerStatusText) {
          const vStatus = (state.timetable.verification && state.timetable.verification.scan_mode) 
            ? `GEMINI (${state.timetable.verification.scan_mode.toUpperCase()})` 
            : (state.timetable.stato_orario || 'ORARIO AGGIORNATO').toUpperCase();
          elements.drawerStatusText.textContent = vStatus;
        }
        if (elements.drawerStatusDate) {
          elements.drawerStatusDate.textContent = `- ${state.timetable.data_aggiornamento || new Date().toLocaleDateString('it-IT')}`.toUpperCase();
        }
        render();
        elements.syncBtnLabel.textContent = 'AGGIORNATO! ✓';
      } else {
        await loadTimetableData();
        elements.syncBtnLabel.textContent = 'AGGIORNATO! ✓';
      }
    } else {
      // Fallback su caricamento file statico se l'endpoint risponde con errore
      await loadTimetableData();
      elements.syncBtnLabel.textContent = 'AGGIORNATO! ✓';
    }
  } catch (err) {
    // Fallback offline / host statico senza server attivo
    console.log('[SYNC] Server /api/sync non attivo, ricarico da file locale:', err.message);
    try {
      await loadTimetableData();
      elements.syncBtnLabel.textContent = 'AGGIORNATO! ✓';
    } catch (e) {
      elements.syncBtnLabel.textContent = 'ERRORE';
    }
  }

  setTimeout(() => {
    elements.syncBtnLabel.textContent = 'SINCRONIZZA ORARIO';
    elements.btnSyncNow.classList.remove('spinning');
  }, 1800);
}

function toggleDrawer(open) {
  if (open) {
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
