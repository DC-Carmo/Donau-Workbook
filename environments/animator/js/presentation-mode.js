/* Presentation is a display-only layer. The board renderer, resize pass and
 * playback authority remain in tactical-board.js and are never replaced. */
(() => {
  'use strict';
  const body = document.body;
  const stage = document.getElementById('canvasHost');
  const wrap = document.getElementById('canvasWrap');
  const entry = document.getElementById('presentButton');
  const topbar = document.getElementById('topbar');
  const menu = document.querySelector('.mobile-board-menu-actions');
  const sourcePlay = document.getElementById('seqBarPlay');
  let rotation = 0;
  let frame = 0;
  let fullscreenOwned = false;
  let generation = 0;
  let previousFocus;
  let savedScroll;
  let savedWrapStyle;
  let inertElements = [];
  const active = () => body.classList.contains('present-mode');

  const controls = document.createElement('div');
  controls.id = 'presentControls';
  controls.hidden = true;
  controls.setAttribute('role', 'toolbar');
  controls.setAttribute('aria-label', 'Presentation controls');
  controls.innerHTML = `
    <button type="button" data-present="left" aria-label="Rotate left 90 degrees">Rotate ◄</button>
    <button type="button" data-present="right" aria-label="Rotate right 90 degrees">Rotate ►</button>
    <button type="button" data-present="flip" aria-label="Flip 180 degrees">Flip</button>
    <button type="button" data-present="play">Play</button>
    <button type="button" data-present="exit">Exit</button>`;
  stage.append(controls);
  const play = controls.querySelector('[data-present="play"]');

  function syncPlayback() {
    if (!active()) return;
    // Read the same state/availability as the existing sequence control.
    play.textContent = S.animating ? 'Pause' : 'Play';
    play.disabled = sourcePlay.disabled;
    play.setAttribute('aria-label', S.animating ? 'Pause sequence' : 'Play sequence');
  }
  new MutationObserver(syncPlayback).observe(sourcePlay, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['disabled', 'aria-label'],
  });

  function positionEntry() {
    if (active()) return;
    const compact = body.classList.contains('is-phone');
    const parent = compact ? menu : topbar;
    if (entry.parentElement !== parent) parent.append(entry);
    entry.classList.toggle('mobile-board-menu-btn', compact);
    if (!compact) {
      const anchor = document.querySelector('.seq-bar').getBoundingClientRect();
      // An out-of-flow tab attached to the top bar adds no width/height to
      // any existing control or layout, including tightly packed laptops.
      entry.style.left = `${Math.max(8, Math.min(innerWidth - 104, anchor.right - 96))}px`;
      entry.style.top = `${topbar.getBoundingClientRect().bottom + 6}px`;
    } else {
      entry.style.removeProperty('left');
      entry.style.removeProperty('top');
    }
  }

  function fitPresentation() {
    if (!active()) return;
    const vv = window.visualViewport;
    const width = document.fullscreenElement === stage ? innerWidth : (vv?.width || innerWidth);
    const height = document.fullscreenElement === stage ? innerHeight : (vv?.height || innerHeight);
    stage.style.setProperty('--present-viewport-width', `${width}px`);
    stage.style.setProperty('--present-viewport-height', `${height}px`);
    stage.style.setProperty('--present-viewport-left', `${vv?.offsetLeft || 0}px`);
    stage.style.setProperty('--present-viewport-top', `${vv?.offsetTop || 0}px`);
    const barHeight = controls.getBoundingClientRect().height;
    const availableWidth = Math.max(1, width - 24);
    const barBottom = parseFloat(getComputedStyle(controls).bottom) || 12;
    const availableHeight = Math.max(1, height - barHeight - barBottom - 24);
    // Match the EXISTING renderer's natural orientation/aspect. Only the
    // display canvas is rotated, never the wrapper measured by resize().
    const phone = body.classList.contains('is-phone');
    const landscape = phone && !body.classList.contains('tb-mobile-portrait');
    const aspect = landscape ? FVH / FVW : FVW * (phone ? 1 : FIELD_X_STRETCH) / FVH;
    const quarterTurn = rotation % 180 !== 0;
    const limitW = quarterTurn ? availableHeight : availableWidth;
    const limitH = quarterTurn ? availableWidth : availableHeight;
    const boardWidth = Math.min(limitW, limitH * aspect);
    const boardHeight = boardWidth / aspect;
    const fitScale = Math.min(availableWidth / (quarterTurn ? boardHeight : boardWidth),
      availableHeight / (quarterTurn ? boardWidth : boardHeight), 1);
    stage.style.setProperty('--present-board-width', `${boardWidth}px`);
    stage.style.setProperty('--present-board-height', `${boardHeight}px`);
    stage.style.setProperty('--present-board-center', `${12 + availableHeight / 2}px`);
    stage.style.setProperty('--present-rotation', `${rotation}deg`);
    stage.style.setProperty('--present-scale', String(fitScale));
    scheduleResizePass();
  }

  function scheduleFit() {
    if (!active() || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      fitPresentation();
    });
  }

  function setPresentRotation(degrees) {
    if (!active() || !Number.isFinite(degrees)) return;
    rotation = ((Math.round(degrees / 90) * 90) % 360 + 360) % 360;
    fitPresentation();
  }

  function enterPresentMode() {
    if (active()) return;
    const token = ++generation;
    previousFocus = document.activeElement;
    savedScroll = { left: stage.scrollLeft, top: stage.scrollTop };
    savedWrapStyle = wrap.getAttribute('style');
    closeMobileBoardMenu();
    body.classList.add('present-mode');
    controls.hidden = false;
    rotation = 0;
    // Make every branch outside the stage inert; keep its original state.
    let branch = stage;
    inertElements = [];
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && !sibling.inert) {
          sibling.inert = true;
          inertElements.push(sibling);
        }
      }
      branch = branch.parentElement;
      if (branch === body) break;
    }
    if (!wrap.inert) { wrap.inert = true; inertElements.push(wrap); }
    stage.scrollTo(0, 0);
    fitPresentation();
    syncPlayback();
    controls.querySelector('button').focus({ preventScroll: true });
    // Request synchronously in the user's gesture. The scoped fixed stage
    // is already the fallback for unsupported/denied fullscreen (e.g. iOS).
    try {
      const request = stage.requestFullscreen?.();
      if (request) Promise.resolve(request).then(() => {
        if (token !== generation || !active()) {
          if (document.fullscreenElement === stage) document.exitFullscreen().catch(() => {});
          return;
        }
        fullscreenOwned = document.fullscreenElement === stage;
        scheduleFit();
      }).catch(() => { if (token === generation) scheduleFit(); });
    } catch (_) { scheduleFit(); }
  }

  function exitPresentMode() {
    if (!active()) return;
    ++generation;
    body.classList.remove('present-mode');
    controls.hidden = true;
    cancelAnimationFrame(frame);
    frame = 0;
    for (const element of inertElements) element.inert = false;
    inertElements = [];
    if (savedWrapStyle === null) wrap.removeAttribute('style');
    else wrap.setAttribute('style', savedWrapStyle);
    for (const name of [...stage.style]) {
      if (name.startsWith('--present-')) stage.style.removeProperty(name);
    }
    if (document.fullscreenElement === stage) document.exitFullscreen().catch(() => {});
    fullscreenOwned = false;
    scheduleResizePass();
    positionEntry();
    previousFocus?.focus({ preventScroll: true });
    const token = generation;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!active() && token === generation) stage.scrollTo(savedScroll.left, savedScroll.top);
    }));
  }

  entry.addEventListener('click', enterPresentMode);
  controls.addEventListener('click', event => {
    if (!active()) return;
    switch (event.target.closest('button')?.dataset.present) {
      case 'left': setPresentRotation(rotation - 90); break;
      case 'right': setPresentRotation(rotation + 90); break;
      case 'flip': setPresentRotation(rotation + 180); break;
      case 'play': toggleSmartPlay(); syncPlayback(); break;
      case 'exit': exitPresentMode(); break;
    }
  });
  // Capture at window, ahead of the editor's document/canvas shortcuts.
  for (const type of ['keydown', 'keyup', 'keypress']) {
    window.addEventListener(type, event => {
      if (!active()) return;
      event.stopImmediatePropagation();
      if (type !== 'keydown') return;
      if (event.key === 'Escape') { event.preventDefault(); exitPresentMode(); }
      else if (event.key === 'Tab') {
        event.preventDefault();
        const buttons = [...controls.querySelectorAll('button:not(:disabled)')];
        const index = buttons.indexOf(document.activeElement);
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
      } else if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (!event.repeat) {
          if (controls.contains(event.target)) event.target.closest('button')?.click();
          else play.click();
        }
      } else event.preventDefault();
    }, true);
  }
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mousemove',
    'mouseup', 'touchstart', 'touchmove', 'touchend', 'click', 'dblclick', 'contextmenu', 'wheel']) {
    window.addEventListener(type, event => {
      if (!active() || controls.contains(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true, passive: false });
  }
  document.addEventListener('fullscreenchange', () => {
    if (!active()) return;
    if (document.fullscreenElement === stage) fullscreenOwned = true;
    else if (fullscreenOwned) { exitPresentMode(); return; }
    scheduleFit();
  });
  window.addEventListener('resize', () => { positionEntry(); scheduleFit(); });
  window.visualViewport?.addEventListener('resize', scheduleFit);
  window.visualViewport?.addEventListener('scroll', scheduleFit);
  new ResizeObserver(() => { positionEntry(); scheduleFit(); }).observe(topbar);
  new ResizeObserver(scheduleFit).observe(controls);
  let layoutKey = '';
  new MutationObserver(() => {
    const nextKey = `${active()}/${body.classList.contains('is-phone')}/${body.classList.contains('tb-mobile-portrait')}`;
    if (nextKey === layoutKey) return;
    layoutKey = nextKey;
    positionEntry();
    scheduleFit();
  }).observe(body, {
    attributes: true, attributeFilter: ['class'],
  });
  window.enterPresentMode = enterPresentMode;
  window.exitPresentMode = exitPresentMode;
  window.setPresentRotation = setPresentRotation;
  positionEntry();
})();
