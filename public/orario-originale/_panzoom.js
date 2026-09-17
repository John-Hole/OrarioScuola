/**
 * Pan-Zoom Engine per Orario Scolastico Originale EDT
 * - Pinch-to-zoom fluido su touch (1.0x - 4.2x)
 * - Pan e trascinamento a 1 dito (touch) o mouse drag
 * - Doppio tocco per zoom rapido (2.3x) sulla lezione toccata e ripristino
 * - Toolbar flottante One UI: Ingrandisci (+), Rimpicciolisci (-), Livello zoom e Adatta allo schermo
 * - Zoom da rotellina del mouse e tastiera (+, -, 0)
 * - Supporto cambio classe / ricaricamento dinamico
 */
(function() {
  let viewport, stage, zoomLevelText;
  let scale = 1.0;
  const minScale = 1.0;
  const maxScale = 4.2;
  let panX = 0;
  let panY = 0;

  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialPanX = 0;
  let initialPanY = 0;

  let isPinching = false;
  let pinchStartDist = 0;
  let pinchStartScale = 1.0;
  let pinchMidX = 0;
  let pinchMidY = 0;
  let pinchStartPanX = 0;
  let pinchStartPanY = 0;

  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  function init() {
    viewport = document.getElementById('zoom-viewport');
    stage = document.getElementById('zoom-stage');
    zoomLevelText = document.getElementById('zoom-level-text');

    if (!viewport || !stage) return;

    setupImageObserver();
    attachListeners();
    resetZoom(false);
  }

  function getViewportDims() {
    return {
      vw: viewport.clientWidth || window.innerWidth,
      vh: viewport.clientHeight || (window.innerHeight - 95)
    };
  }

  function getStageDims() {
    return {
      cw: stage.offsetWidth || 1025,
      ch: stage.offsetHeight || 700
    };
  }

  function clampPan() {
    const { vw, vh } = getViewportDims();
    const { cw, ch } = getStageDims();
    const rw = cw * scale;
    const rh = ch * scale;

    // Asse X
    if (rw <= vw) {
      panX = (vw - rw) / 2;
    } else {
      const minX = vw - rw - 16;
      const maxX = 16;
      panX = Math.max(minX, Math.min(maxX, panX));
    }

    // Asse Y
    if (rh <= vh) {
      panY = 10;
    } else {
      const minY = vh - rh - 70; // spazio di sicurezza per la barra di zoom flottante
      const maxY = 10;
      panY = Math.max(minY, Math.min(maxY, panY));
    }
  }

  function applyTransform(animated = false) {
    if (!stage) return;
    if (animated) {
      stage.classList.add('animating');
    } else {
      stage.classList.remove('animating');
    }
    stage.style.transform = `translate3d(${Math.round(panX)}px, ${Math.round(panY)}px, 0) scale(${scale.toFixed(3)})`;
    if (zoomLevelText) {
      zoomLevelText.textContent = `${Math.round(scale * 100)}%`;
    }
  }

  function zoomAt(anchorX, anchorY, targetScale, animated = true) {
    const clampedScale = Math.max(minScale, Math.min(maxScale, targetScale));
    if (Math.abs(clampedScale - scale) < 0.001) return;

    const stageX = (anchorX - panX) / scale;
    const stageY = (anchorY - panY) / scale;

    scale = clampedScale;
    panX = anchorX - stageX * scale;
    panY = anchorY - stageY * scale;

    clampPan();
    applyTransform(animated);
  }

  function resetZoom(animated = true) {
    scale = 1.0;
    const { vw } = getViewportDims();
    const { cw } = getStageDims();
    panX = (vw - cw) / 2;
    panY = 10;
    clampPan();
    applyTransform(animated);
  }

  function attachListeners() {
    const btnIn = document.getElementById('btn-zoom-in');
    const btnOut = document.getElementById('btn-zoom-out');
    const btnReset = document.getElementById('btn-zoom-reset');
    const btnFit = document.getElementById('btn-zoom-fit');

    if (btnIn) {
      btnIn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const { vw, vh } = getViewportDims();
        zoomAt(vw / 2, vh / 2, scale + 0.35, true);
      });
    }
    if (btnOut) {
      btnOut.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const { vw, vh } = getViewportDims();
        zoomAt(vw / 2, vh / 2, scale - 0.35, true);
      });
    }
    if (btnReset) {
      btnReset.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetZoom(true);
      });
    }
    if (btnFit) {
      btnFit.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetZoom(true);
      });
    }

    // Doppio clic desktop
    viewport.addEventListener('dblclick', (e) => {
      if (e.target && e.target.closest('#floating-zoom-bar')) return;
      const rect = viewport.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      if (scale < 1.35) {
        zoomAt(clickX, clickY, 2.3, true);
      } else {
        resetZoom(true);
      }
    });

    // Touch events
    viewport.addEventListener('touchstart', onTouchStart, { passive: false });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', onTouchEnd, { passive: false });
    viewport.addEventListener('touchcancel', onTouchEnd, { passive: false });

    // Mouse events per desktop
    viewport.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    viewport.addEventListener('wheel', onWheel, { passive: false });

    // Resize
    window.addEventListener('resize', () => {
      clampPan();
      applyTransform(false);
    });

    // Tastiera
    window.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const { vw, vh } = getViewportDims();
      if (e.key === '+' || e.key === '=') {
        zoomAt(vw / 2, vh / 2, scale + 0.35, true);
      } else if (e.key === '-' || e.key === '_') {
        zoomAt(vw / 2, vh / 2, scale - 0.35, true);
      } else if (e.key === '0' || e.key === 'Escape') {
        resetZoom(true);
      }
    });
  }

  function onTouchStart(e) {
    if (e.target && e.target.closest('#floating-zoom-bar')) return;

    if (e.touches.length === 1) {
      const now = Date.now();
      const t = e.touches[0];
      const rect = viewport.getBoundingClientRect();
      const tapX = t.clientX - rect.left;
      const tapY = t.clientY - rect.top;

      // Doppio tocco
      if (now - lastTapTime < 320 && Math.hypot(tapX - lastTapX, tapY - lastTapY) < 35) {
        e.preventDefault();
        lastTapTime = 0;
        if (scale < 1.35) {
          zoomAt(tapX, tapY, 2.3, true);
        } else {
          resetZoom(true);
        }
        return;
      }
      lastTapTime = now;
      lastTapX = tapX;
      lastTapY = tapY;

      isDragging = true;
      dragStartX = t.clientX;
      dragStartY = t.clientY;
      initialPanX = panX;
      initialPanY = panY;
      stage.classList.remove('animating');
    } else if (e.touches.length === 2) {
      isPinching = true;
      isDragging = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      pinchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      pinchStartScale = scale;

      const rect = viewport.getBoundingClientRect();
      pinchMidX = (t1.clientX + t2.clientX) / 2 - rect.left;
      pinchMidY = (t1.clientY + t2.clientY) / 2 - rect.top;
      pinchStartPanX = panX;
      pinchStartPanY = panY;
      stage.classList.remove('animating');
    }
  }

  function onTouchMove(e) {
    if (isPinching && e.touches.length >= 2) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const factor = dist / (pinchStartDist || 1);
      const newScale = Math.max(minScale, Math.min(maxScale, pinchStartScale * factor));

      const rect = viewport.getBoundingClientRect();
      const curMidX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const curMidY = (t1.clientY + t2.clientY) / 2 - rect.top;

      const stageX = (pinchMidX - pinchStartPanX) / pinchStartScale;
      const stageY = (pinchMidY - pinchStartPanY) / pinchStartScale;

      scale = newScale;
      panX = curMidX - stageX * scale;
      panY = curMidY - stageY * scale;

      clampPan();
      applyTransform(false);
    } else if (isDragging && e.touches.length === 1) {
      const { vw, vh } = getViewportDims();
      const { cw, ch } = getStageDims();
      const isScrollable = (cw * scale > vw) || (ch * scale > vh);

      if (isScrollable || scale > 1.05) {
        e.preventDefault();
        const t = e.touches[0];
        const dx = t.clientX - dragStartX;
        const dy = t.clientY - dragStartY;
        panX = initialPanX + dx;
        panY = initialPanY + dy;
        clampPan();
        applyTransform(false);
      }
    }
  }

  function onTouchEnd(e) {
    if (e.touches.length < 2) {
      isPinching = false;
    }
    if (e.touches.length === 0) {
      isDragging = false;
      if (scale < minScale) {
        resetZoom(true);
      } else {
        clampPan();
        applyTransform(true);
      }
    }
  }

  let isMouseDown = false;
  function onMouseDown(e) {
    if (e.button !== 0) return;
    if (e.target && e.target.closest('#floating-zoom-bar')) return;
    e.preventDefault();
    isMouseDown = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initialPanX = panX;
    initialPanY = panY;
    viewport.classList.add('is-dragging');
    stage.classList.remove('animating');
  }

  function onMouseMove(e) {
    if (!isMouseDown) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    panX = initialPanX + dx;
    panY = initialPanY + dy;
    clampPan();
    applyTransform(false);
  }

  function onMouseUp() {
    if (isMouseDown) {
      isMouseDown = false;
      viewport.classList.remove('is-dragging');
      clampPan();
      applyTransform(true);
    }
  }

  function onWheel(e) {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const anchorX = e.clientX - rect.left;
    const anchorY = e.clientY - rect.top;
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.16 : 0.86;
    zoomAt(anchorX, anchorY, scale * factor, true);
  }

  function setupImageObserver() {
    const observer = new MutationObserver(() => {
      bindImage();
    });
    const target = document.getElementById('grille');
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }
    bindImage();
  }

  function bindImage() {
    const img = document.getElementById('imgGrilleOrario');
    if (img) {
      const onReady = () => {
        resetZoom(false);
      };
      if (img.complete && img.naturalWidth > 0) {
        onReady();
      } else {
        img.onload = onReady;
      }
    }
  }

  window.PanZoom = {
    zoomIn: () => {
      const { vw, vh } = getViewportDims();
      zoomAt(vw / 2, vh / 2, scale + 0.35, true);
    },
    zoomOut: () => {
      const { vw, vh } = getViewportDims();
      zoomAt(vw / 2, vh / 2, scale - 0.35, true);
    },
    reset: () => resetZoom(true),
    getScale: () => scale
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
