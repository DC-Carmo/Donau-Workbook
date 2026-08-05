//  RUGBY TACTICAL BOARD - Complete Implementation
//  RDA Tactical Board product styling

// Full field, portrait orientation
//   x: 0-68  (left touchline -> right touchline, field width)
//   y: -10-110 (dead ball line top -> dead ball line bottom)
//   y=0:  top try line     y=100: bottom try line
//   y=22: top 22m line     y=78:  bottom 22m line
//   y=40: top 10m          y=60:  bottom 10m
//   y=50: halfway line
//   Posts: x=34, y=0 (top) and x=34, y=100 (bottom)

const F = { // Field constants
  W: 68, IG: 10, LEN: 100,
  YMIN: -10, YMAX: 110,  // including in-goals
  XMIN: 0,   XMAX: 68,
  // Display bounds (with small margin)
  DX0: -0.6, DX1: 68.6,
  DY0: -10.8,  DY1: 110.8,
};
const FVW = F.DX1 - F.DX0;
const FVH = F.DY1 - F.DY0;
const FIELD_X_STRETCH = 1.7;
const BALL_CARRY_OFFSET = { x: 1.45, y: -1.05 };
const MOBILE_TAP_TOGGLE_PX = 5;
const PENDING_GROUP_DRAG_PX = 8;
const SNAP_RADIUS = 4; // field units (~4m)
let GAINLINE_Y = 50;      // default: halfway
let showGainline = false;
let radialMenu = null; // { playerId, x, y } in canvas px
let teleStrokes = []; // [{ pts:[{x,y}], born: timestamp, color }]
let teleDrawing = null; // current stroke being drawn
let teleFadeRaf = null;
const TELE_DURATION = 3000; // ms before fully faded
const TELE_COLOR = '#facc15'; // yellow ink
let presetShowOpposition = false;
let currentPresetId = null;
const SCHEMA_VERSION = 2;

// Canvas scaling
let cvW=0, cvH=0, sc=1, sx=1, sy=1, ox=0, oy=0, renderDpr=1;
let isPhoneViewport = false;
let isMobilePortraitBoard = false;
let isPhoneLandscapeBoard = false;
let phoneVerticalPanPx = 0;
let phoneVerticalOverflowPx = 0;
let phoneUserPanned = false;
// Portrait-only "Fit Full Pitch" mode (toggled from More): temporarily
// contain-fits the whole pitch instead of the default large editing view.
// Never persisted; auto-returns to editing view on the triggers listed at
// its toggle function below.
let mobileFitFullPitch = false;
let mobilePortraitScrollTop = null; // last editing-view scroll position, restored across landscape<->portrait
let viewportState = null;
let resizeObserver = null;
let resizeRaf = 0;
let dprMediaQuery = null;
let dprMediaQueryListener = null;
const cv  = document.getElementById('field');
const supportsPointerEvents = typeof window !== 'undefined' && 'PointerEvent' in window;
let staticFieldCanvas = null;
let staticFieldCtx = null;
let staticFieldCacheKey = '';
let floatingSelectionToolbarRaf = 0;
let floatingToolbarOpenFlyout = '';

function isVerticalPhoneBoard() {
  // Upright pitch in PORTRAIT. Landscape rotates to a horizontal pitch (see the
  // isPhoneLandscapeBoard branch in toC/frC) so the whole pitch fits the wide screen.
  return isMobilePortraitBoard;
}

function normEvent(e) {
  const src = e.touches && e.touches.length > 0         ? e.touches[0]
            : e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0]
            : null;
  if (src) {
    e.preventDefault();
    return { clientX: src.clientX, clientY: src.clientY,
             pointerId: src.identifier, button: 0,
             buttons: e.touches && e.touches.length > 0 ? 1 : 0 };
  }
  return e;
}
let ctx = cv.getContext('2d');

function withRenderContext(nextCtx, fn) {
  const prevCtx = ctx;
  ctx = nextCtx;
  try {
    return fn();
  } finally {
    ctx = prevCtx;
  }
}

function syncCanvasResolution(canvas, context, width, height) {
  const pxW = Math.max(1, Math.round(width * renderDpr));
  const pxH = Math.max(1, Math.round(height * renderDpr));
  if (canvas.width !== pxW) canvas.width = pxW;
  if (canvas.height !== pxH) canvas.height = pxH;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in context) context.imageSmoothingQuality = 'high';
  context.setTransform(renderDpr, 0, 0, renderDpr, 0, 0);
}

function invalidateStaticFieldCache() {
  staticFieldCacheKey = '';
}

function getStaticFieldCacheKey() {
  return [
    cvW,
    cvH,
    renderDpr.toFixed(3),
    sx.toFixed(4),
    sy.toFixed(4),
    ox.toFixed(2),
    oy.toFixed(2),
    isPhoneViewport ? 1 : 0,
    Number(S?.stripeCount || 12).toFixed(2),
    Number(S?.textureStrength || 0).toFixed(3),
  ].join('|');
}

function ensureStaticFieldSnapshotBuffer() {
  if (!staticFieldCanvas) {
    staticFieldCanvas = document.createElement('canvas');
    staticFieldCtx = staticFieldCanvas.getContext('2d');
  }
  syncCanvasResolution(staticFieldCanvas, staticFieldCtx, cvW, cvH);
}

function toC(fx, fy) {
  if (isPhoneLandscapeBoard) {
    // Landscape: pitch rotated 90deg. Length (fy) -> screen X, width (fx) -> screen Y.
    return { x: ox + (fy - F.DY0) * sx, y: oy + (fx - F.DX0) * sy };
  }
  if (isVerticalPhoneBoard()) {
    return { x: ox + (fx - F.DX0) * sx, y: oy + (fy - F.DY0) * sy };
  }
  return { x: ox + (fx - F.DX0) * sx, y: oy + (fy - F.DY0) * sy };
}
function frC(cx, cy) {
  if (isPhoneLandscapeBoard) {
    return { x: (cy - oy) / sy + F.DX0, y: (cx - ox) / sx + F.DY0 };
  }
  if (isVerticalPhoneBoard()) {
    return { x: (cx - ox) / sx + F.DX0, y: (cy - oy) / sy + F.DY0 };
  }
  return { x: (cx - ox) / sx + F.DX0, y: (cy - oy) / sy + F.DY0 };
}
function d2(a, b)    { return Math.hypot(a.x - b.x, a.y - b.y); }
function isInsidePitch(point) {
  return !!point &&
    point.x >= F.XMIN && point.x <= F.XMAX &&
    point.y >= F.YMIN && point.y <= F.YMAX;
}
function clampFieldPoint(point) {
  return {
    x: clamp(point.x, F.XMIN, F.XMAX),
    y: clamp(point.y, F.YMIN, F.YMAX),
  };
}

function updateGainDisplayForY(y) {
  const el = document.getElementById('gainDisplay');
  if (!el) return;
  const dist = Math.round((GAINLINE_Y - y) * 1);
  const sign = dist > 0 ? '+' : '';
  el.textContent = dist === 0 ? tr('gainline.status', {}, 'On gainline') : `${sign}${dist}m`;
  el.style.color = dist > 0 ? '#4ade80' : dist < 0 ? '#f87171' : '#fbbf24';
}

function closeRadialMenu() {
  radialMenu = null;
  const menu = document.getElementById('radialMenu');
  if (menu) {
    menu.classList.remove('visible');
    menu.innerHTML = '';
  }
}

function ensureRadialSourcePlayerSelected(sourcePlayerId) {
  const sourcePlayer = S.players.find(player => player.id === sourcePlayerId) || null;
  if (!sourcePlayer) return null;
  selectPlayer(sourcePlayer.id, { highlightedIds: [sourcePlayer.id] });
  return sourcePlayer;
}

function resetRadialToolInteractionState(nextTool) {
  const staleTool = S.tool === nextTool;
  const hasWorkflow = !!activeWorkflowPlayerId();
  const hasRunSource = !!S.activeRunSourceId;
  const hasDrawing = !!S.drawing;
  if (!staleTool && !hasWorkflow && !hasRunSource && !hasDrawing) return;
  // Only clear the specific stale field(s) actually present, instead of
  // unconditionally clearing both pass/kick AND run state (each clear also
  // resets the highlight + legacy selection mirror, so doing both when only
  // one is stale is pure extra churn on the selected-player visuals).
  if (hasWorkflow) clearPassKickState();
  if (hasRunSource) clearArmedRunState();
  clearDragPlayer();
  if (hasDrawing) S.drawing = null;
  S.pointerTap = null;
  if (staleTool) S.tool = 'move';
}

function activateRadialAction(action, sourcePlayerId) {
  closeRadialMenu();
  if (!action || sourcePlayerId === null || sourcePlayerId === undefined) return false;
  // Look up (don't yet re-select) the source player: the two-tap gesture that
  // opens the radial menu already left it selected, so the one confirming
  // selectPlayer() call below - after any stale tool state is cleared - is
  // enough. Selecting it again here too would just be a second, redundant
  // reselect of the same player before we've even touched the tool state.
  const sourcePlayer = S.players.find(player => player.id === sourcePlayerId) || null;
  if (!sourcePlayer) return false;

  if (action.tool) {
    resetRadialToolInteractionState(action.tool);
    ensureRadialSourcePlayerSelected(sourcePlayer.id);
    setTool(action.tool);
    // Arrow armed from the radial is a one-shot, player-anchored draw: mark it
    // (after setTool(), which unconditionally clears it first) so
    // handlePointerDown starts the arrow at this player's position and
    // finishAnnotationDraft auto-returns to Move once it commits. Any other
    // radial tool leaves it at setTool()'s cleared default.
    if (action.tool === 'arrow') S.radialArrowSourcePlayerId = sourcePlayer.id;
    return true;
  }

  if (action.kind === 'ball') {
    ensureRadialSourcePlayerSelected(sourcePlayer.id);
    addBall();
    return true;
  }

  if (action.kind === 'remove') {
    ensureRadialSourcePlayerSelected(sourcePlayer.id);
    deleteSelected();
    return true;
  }

  return false;
}

function radialEventTargetsMenu(event) {
  const path = typeof event?.composedPath === 'function' ? event.composedPath() : [];
  return path.some((node) => {
    if (!node || typeof node !== 'object') return false;
    if (node.id === 'radialMenu') return true;
    return !!node.classList?.contains('radial-btn');
  });
}

function renderRadialMenu() {
  const menu = document.getElementById('radialMenu');
  if (!menu) return;
  if (!radialMenu) {
    menu.classList.remove('visible');
    menu.innerHTML = '';
    return;
  }
  const pl = S.players.find(player => player.id === radialMenu.playerId);
  if (!pl) {
    closeRadialMenu();
    return;
  }

  const center = toC(pl.x, pl.y);
  radialMenu.x = center.x;
  radialMenu.y = center.y;
  menu.innerHTML = '';
  menu.classList.add('visible');

  const actions = [
    { label: 'Arrow', icon: '&#8599;', tool: 'arrow', ariaLabel: 'Draw tactical arrow' },
    { label: 'Pass', icon: '~', tool: 'pass' },
    { label: 'Kick', icon: '&uarr;', tool: 'kick' },
    { label: 'Ball', icon: '&#9679;', kind: 'ball' },
    { label: 'Remove', icon: '&#10005;', kind: 'remove', danger: true },
  ];

  const radius = 52;
  actions.forEach((action, index) => {
    const angle = (-Math.PI / 2) + (index * (Math.PI * 2 / actions.length));
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `radial-btn${action.danger ? ' danger' : ''}`;
    btn.style.left = `${center.x + Math.cos(angle) * radius}px`;
    btn.style.top = `${center.y + Math.sin(angle) * radius}px`;
    btn.innerHTML = `<span>${action.icon}</span><span>${action.label}</span>`;
    if (action.ariaLabel) btn.setAttribute('aria-label', action.ariaLabel);
    let pointerHandled = false;
    const handleActivation = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const sourcePlayerId = radialMenu?.playerId ?? null;
      activateRadialAction(action, sourcePlayerId);
    };
    btn.addEventListener('pointerdown', (event) => {
      pointerHandled = true;
      handleActivation(event);
    });
    btn.addEventListener('click', (event) => {
      if (event.detail !== 0 || pointerHandled) {
        pointerHandled = false;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        return;
      }
      pointerHandled = false;
      handleActivation(event);
    });
    menu.appendChild(btn);
  });
}

function showRadial(pl, canvasX, canvasY) {
  radialMenu = { playerId: pl.id, x: canvasX, y: canvasY };
  renderRadialMenu();
}

function syncMobileNotesPanelHost() {
  const notes = document.querySelector('.sp-notes-panel');
  const host = document.getElementById('mobileNotesSheetHost');
  const anchor = document.getElementById('smartPanelNotesAnchor');
  if (!notes || !host || !anchor || !anchor.parentNode) return;
  if (isPhoneViewport) {
    if (notes.parentNode !== host) host.appendChild(notes);
    return;
  }
  const targetParent = anchor.parentNode;
  if (notes.parentNode !== targetParent || notes.previousElementSibling !== anchor) {
    targetParent.insertBefore(notes, anchor.nextSibling);
  }
}

function syncMobileBoardNameInput() {
  const desktopInput = document.getElementById('playName');
  const mobileInput = document.getElementById('mobilePlayNameInput');
  if (!desktopInput || !mobileInput || mobileInput === document.activeElement) return;
  if (mobileInput.value !== desktopInput.value) mobileInput.value = desktopInput.value;
}

// window.visualViewport reflects what is ACTUALLY visible in Safari (it can
// differ from window.innerWidth/innerHeight while the dynamic toolbar is
// showing/hiding). It is used ONLY to establish the outer visible phone
// region for orientation/size classification below - never as the source of
// canvas geometry (that always comes from #canvasWrap's own settled
// getBoundingClientRect(), after CSS layout - aspect-ratio, contain sizing,
// flex centring - has done all the real fitting work).
function getVisualViewportBox() {
  const vv = window.visualViewport;
  if (vv) {
    return {
      width: vv.width,
      height: vv.height,
      offsetLeft: vv.offsetLeft || 0,
      offsetTop: vv.offsetTop || 0,
    };
  }
  return {
    width: window.innerWidth || document.documentElement.clientWidth || 0,
    height: window.innerHeight || document.documentElement.clientHeight || 0,
    offsetLeft: 0,
    offsetTop: 0,
  };
}

// Phone LANDSCAPE only: #canvasHost/the side rails are the only things CSS
// positions. This measures their settled boxes and writes #canvasWrap's
// exact pixel rectangle (position:absolute; left/top/width/height) directly,
// contain-fitting the complete rendered-board's rotated aspect ratio into
// the space between the rails. Root-caused via empirical Playwright testing:
// the previous container-query (cqw/cqh) contain-fit technique measured as
// numerically correct in every geometry/computed-style check, yet the canvas
// painted nothing visible on screen in real Chrome (confirmed with
// canvas.toDataURL() showing a fully correct render while the actual
// composited page showed none) - isolated specifically to a canvas
// descendant of a container-query-sized, flex-centred #canvasWrap in phone
// landscape. Explicit absolute positioning does not exhibit it. This is the
// only function that writes #canvasWrap's landscape geometry.
const LANDSCAPE_BOARD_ASPECT = FVH / FVW; // rotated: pitch length / pitch width
const LANDSCAPE_RAIL_GAP_PX = 8;
function applyPhoneLandscapeWrapGeometry() {
  const host = document.getElementById('canvasHost');
  const wrap = document.getElementById('canvasWrap');
  const railLeft = document.getElementById('mobileRailLeft');
  const railRight = document.getElementById('mobileRailRight');
  if (!host || !wrap || !railLeft || !railRight) return false;
  const hostRect = host.getBoundingClientRect();
  const leftRailRect = railLeft.getBoundingClientRect();
  const rightRailRect = railRight.getBoundingClientRect();
  const usableLeft = Math.max(hostRect.left, leftRailRect.right + LANDSCAPE_RAIL_GAP_PX);
  const usableRight = Math.min(hostRect.right, rightRailRect.left - LANDSCAPE_RAIL_GAP_PX);
  const usableTop = hostRect.top;
  const usableBottom = hostRect.bottom;
  const availableWidth = usableRight - usableLeft;
  const availableHeight = usableBottom - usableTop;
  if (!Number.isFinite(availableWidth) || !Number.isFinite(availableHeight)
    || availableWidth <= 0 || availableHeight <= 0) {
    return false;
  }
  const widthFromHeight = availableHeight * LANDSCAPE_BOARD_ASPECT;
  const heightFromWidth = availableWidth / LANDSCAPE_BOARD_ASPECT;
  let wrapWidth, wrapHeight;
  if (widthFromHeight <= availableWidth) {
    wrapWidth = widthFromHeight;
    wrapHeight = availableHeight;
  } else {
    wrapWidth = availableWidth;
    wrapHeight = heightFromWidth;
  }
  if (!Number.isFinite(wrapWidth) || !Number.isFinite(wrapHeight) || wrapWidth <= 0 || wrapHeight <= 0) {
    return false;
  }
  const wrapLeft = usableLeft + (availableWidth - wrapWidth) / 2;
  const wrapTop = usableTop + (availableHeight - wrapHeight) / 2;
  // #canvasWrap is position:absolute inside the position:fixed #canvasHost
  // (zero padding/border on the host in this mode), so its containing block
  // origin IS hostRect's own top-left - convert back to host-relative px.
  wrap.style.left = `${wrapLeft - hostRect.left}px`;
  wrap.style.top = `${wrapTop - hostRect.top}px`;
  wrap.style.width = `${wrapWidth}px`;
  wrap.style.height = `${wrapHeight}px`;
  return true;
}

function clearPhoneLandscapeWrapGeometry() {
  const wrap = document.getElementById('canvasWrap');
  if (!wrap) return;
  wrap.style.left = '';
  wrap.style.top = '';
  wrap.style.width = '';
  wrap.style.height = '';
}

// Reads the FINAL, CSS-settled #canvasWrap box and derives the render
// transform from it directly - no independent fit math. CSS (aspect-ratio,
// max-width/max-height, flex centring, or the portrait scroller's 96% width)
// has already decided the board's exact size and position; this only
// translates that measured box into the sc/sx/sy/ox/oy the renderer needs.
function getPhoneViewportState() {
  const wrap = document.getElementById('canvasWrap');
  const rect = wrap ? wrap.getBoundingClientRect() : null;
  const availW = rect ? rect.width : 0;
  const availH = rect ? rect.height : 0;
  const isLandscape = !isMobilePortraitBoard;
  // Landscape: pitch length (FVH) maps to the wrap's width axis, width (FVW)
  // to its height axis (rotated). Portrait: upright, straight mapping.
  const fieldScaleX = isLandscape ? availW / FVH : availW / FVW;
  const fieldScaleY = isLandscape ? availH / FVW : availH / FVH;
  const fieldScale = fieldScaleX;
  const host = document.getElementById('canvasHost');
  const overflow = host ? Math.max(0, host.scrollHeight - host.clientHeight) : 0;
  return {
    availTop: rect ? rect.top : 0,
    availBottom: rect ? rect.bottom : 0,
    availLeft: rect ? rect.left : 0,
    availRight: rect ? rect.right : 0,
    availW,
    availH,
    fieldScale,
    fieldScaleX,
    fieldScaleY,
    // The board fills #canvasWrap exactly (no letterboxing WITHIN it - all
    // letterboxing/margin now happens outside, in #canvasHost, via CSS), so
    // the rendered board IS the wrap and the offset within it is always 0.
    fieldCssW: availW,
    fieldCssH: availH,
    baseX: 0,
    baseY: 0,
    overflow,
    cssWidth: availW,
    cssHeight: availH,
  };
}

function updateViewportStateAssertions() {
  if (!viewportState) {
    window.__viewportState = null;
    return;
  }
  const canaryOk = viewportState.cssWidth > 0 && viewportState.cssHeight > 0
    && viewportState.cssWidth < 4000 && viewportState.cssHeight < 4000;
  window.__viewportState = {
    ...viewportState,
    canaryOk,
  };
}

function translatePathPoints(path, dx, dy) {
  if (!path || !Array.isArray(path.pts) || !path.pts.length) return;
  path.pts = path.pts.map((pt) => ({
    x: pt.x + dx,
    y: pt.y + dy,
  }));
}

function resize() {
  const wrap = document.getElementById('canvasWrap');
  const vv = getVisualViewportBox();
  const vpW = vv.width || window.innerWidth || document.documentElement.clientWidth || 0;
  const vpH = vv.height || window.innerHeight || document.documentElement.clientHeight || 0;
  if (vpW < 50 || vpH < 50) {
    if (!window.__animatorResizeRetry) {
      window.__animatorResizeRetry = setTimeout(() => {
        window.__animatorResizeRetry = null;
        scheduleResizePass();
      }, 180);
    }
    return;
  }
  // Safari can fire orientationchange/resize with visualViewport/innerWidth
  // still reporting the PREVIOUS orientation's dimensions for one event,
  // before the real ones land, while #canvasWrap's own live CSS box (driven
  // by the browser's own reflow, independent of JS) has already flipped to
  // the new one. document.documentElement.clientWidth/Height is a second,
  // independently-updated source of the current layout viewport; when it
  // disagrees with vpW/vpH on which axis is longer, this pass's dimensions
  // are stale - classifying orientation from them would toggle the wrong
  // is-phone/tb-mobile-portrait CSS classes for one pass. Skip this pass
  // entirely (leaving whatever was last painted on screen untouched) and let
  // the next scheduled pass - orientationchange's own +250ms/+500ms
  // catch-ups, or the ResizeObserver on #canvasWrap/#topbar/#bottomPanel,
  // which will have settled - apply the real geometry instead.
  const docW = document.documentElement.clientWidth;
  const docH = document.documentElement.clientHeight;
  if (docW > 0 && docH > 0 && (vpW > vpH) !== (docW > docH)) {
    scheduleResizePass();
    return;
  }
  const coarse = !!window.matchMedia?.('(pointer: coarse)')?.matches;
  const noHover = !!window.matchMedia?.('(hover: none)')?.matches;
  const small = Math.min(vpW, vpH);
  const big = Math.max(vpW, vpH);
  const isPhone = (coarse || noHover)
    ? (small <= 560)
    : (small <= 480 && big <= 900);
  const MOBILE_PORTRAIT = isPhone && vpH > vpW;
  const PHONE_LANDSCAPE = isPhone && !MOBILE_PORTRAIT;
  renderDpr = Math.max(1, window.devicePixelRatio || 1);
  isPhoneViewport = isPhone;
  isMobilePortraitBoard = MOBILE_PORTRAIT;
  isPhoneLandscapeBoard = PHONE_LANDSCAPE;
  document.body.classList.toggle('is-phone', isPhone);
  document.body.classList.toggle('tb-mobile-portrait', MOBILE_PORTRAIT);
  document.body.classList.toggle('tb-fit-full-pitch', isPhone && MOBILE_PORTRAIT && mobileFitFullPitch);
  syncMobileNotesPanelHost();
  // Landscape only: write #canvasWrap's explicit pixel geometry from the
  // settled host/rail rects BEFORE reading it below (see
  // applyPhoneLandscapeWrapGeometry's doc comment for why this replaced the
  // former CSS-only container-query sizing). Any other mode clears leftover
  // inline geometry so it can't leak into portrait/desktop's own CSS sizing.
  if (isPhone && PHONE_LANDSCAPE) {
    if (!applyPhoneLandscapeWrapGeometry()) {
      if (!window.__animatorResizeRetry) {
        window.__animatorResizeRetry = setTimeout(() => {
          window.__animatorResizeRetry = null;
          scheduleResizePass();
        }, 180);
      }
      return;
    }
  } else {
    clearPhoneLandscapeWrapGeometry();
  }
  const phoneBox = isPhone ? getPhoneViewportState() : null;
  // CSS (aspect-ratio / max-width+max-height / the portrait scroller's fixed
  // width) now does 100% of the phone board's sizing and positioning; this
  // just validates the SETTLED result before using it. A momentarily-invalid
  // rect (0-size, non-finite, or implausibly small - e.g. mid-transition
  // before the class toggle above has been painted) is rejected WITHOUT
  // touching cv/sc/sx/sy/ox/oy, so whatever was last rendered stays on
  // screen (never blanks) and one rAF retry is scheduled to pick up the
  // settled geometry.
  if (isPhone) {
    const nums = phoneBox && [phoneBox.availW, phoneBox.availH, phoneBox.fieldScale, phoneBox.fieldScaleX, phoneBox.fieldScaleY];
    const isValid = !!phoneBox && nums.every(Number.isFinite)
      && phoneBox.availW > 100 && phoneBox.availH > 100
      && phoneBox.fieldScale > 0;
    if (!isValid) {
      if (!window.__animatorResizeRetry) {
        window.__animatorResizeRetry = setTimeout(() => {
          window.__animatorResizeRetry = null;
          scheduleResizePass();
        }, 180);
      }
      return;
    }
  }
  const wrapRect = wrap.getBoundingClientRect();
  const wrapW = wrap.clientWidth || wrapRect.width || cv.clientWidth || window.innerWidth;
  const wrapH = wrap.clientHeight || wrapRect.height || cv.clientHeight || window.innerHeight;
  cvW = isPhone ? Math.max(1, phoneBox?.cssWidth || wrapW) : Math.max(1, wrapW);
  cvH = isPhone ? Math.max(1, phoneBox?.cssHeight || wrapH) : Math.max(1, wrapH);
  const padX = Math.max(6, Math.min(12, cvW * 0.008));
  const padY = Math.max(8, Math.min(14, cvH * 0.01));
  if (isPhone) {
    cv.style.width = `${cvW}px`;
    cv.style.height = `${cvH}px`;
    sc = phoneBox.fieldScale;
    sx = phoneBox.fieldScaleX || sc;
    sy = phoneBox.fieldScaleY || sc;
    // The board fills #canvasWrap exactly now - no letterboxing offset
    // inside it, and panning is native #canvasHost scroll (see
    // startPortraitPan/its pointermove handler), not a render-transform
    // offset - so there is nothing left for ox/oy/phoneVerticalPanPx to do.
    ox = 0;
    oy = 0;
    phoneVerticalPanPx = 0;
    phoneVerticalOverflowPx = phoneBox.overflow;
    handleMobilePortraitScrollLifecycle(MOBILE_PORTRAIT);
    viewportState = {
      mode: MOBILE_PORTRAIT ? 'phone-portrait' : 'phone-landscape',
      availTop: phoneBox.availTop,
      availBottom: phoneBox.availBottom,
      availH: phoneBox.availH,
      availW: phoneBox.availW,
      cssWidth: cvW,
      cssHeight: cvH,
      fieldCssW: phoneBox.fieldCssW,
      fieldCssH: phoneBox.fieldCssH,
      overflow: phoneBox.overflow,
      baseX: 0,
      baseY: 0,
      panY: 0,
      panYMin: 0,
      panYMax: 0,
      fieldTop: phoneBox.availTop,
      fieldBottom: phoneBox.availBottom,
      dpr: renderDpr,
    };
  } else {
    cv.style.width = `${cvW}px`;
    cv.style.height = `${cvH}px`;
    wrap.style.width = '';
    wrap.style.height = '';
    cvH = Math.max(1, cv.clientHeight || wrapH || (window.innerHeight * 0.6));
    const baseFromWidth = (cvW - padX * 2) / (FVW * FIELD_X_STRETCH);
    const baseFromHeight = (cvH - padY * 2) / FVH;
    sc = Math.max(0.01, Math.min(baseFromWidth, baseFromHeight));
    sx = sc * FIELD_X_STRETCH;
    sy = sc;
    ox = (cvW - FVW * sx) / 2;
    oy = (cvH - FVH * sy) / 2;
    phoneVerticalOverflowPx = 0;
    phoneVerticalPanPx = 0;
    viewportState = {
      mode: 'desktop',
      availTop: 0,
      availBottom: cvH,
      availH: cvH,
      availW: cvW,
      cssWidth: cvW,
      cssHeight: cvH,
      fieldCssW: FVW * sx,
      fieldCssH: FVH * sy,
      baseX: ox,
      baseY: oy,
      panY: 0,
      panYMin: 0,
      panYMax: 0,
      fieldTop: oy,
      fieldBottom: oy + (FVH * sy),
      dpr: renderDpr,
    };
  }
  updateViewportStateAssertions();
  syncCanvasResolution(cv, ctx, cvW, cvH);
  invalidateStaticFieldCache();
  syncMobileBoardNameInput();
  updateMobileUI();
  render();
  scheduleSequenceDockPosition();
}

function scheduleResizePass() {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    resize();
  });
}

function bindDprChangeListener() {
  if (!window.matchMedia) return;
  if (dprMediaQuery && dprMediaQueryListener) {
    if (typeof dprMediaQuery.removeEventListener === 'function') {
      dprMediaQuery.removeEventListener('change', dprMediaQueryListener);
    } else if (typeof dprMediaQuery.removeListener === 'function') {
      dprMediaQuery.removeListener(dprMediaQueryListener);
    }
  }
  dprMediaQueryListener = () => {
    bindDprChangeListener();
    scheduleResizePass();
  };
  dprMediaQuery = window.matchMedia(`(resolution: ${(window.devicePixelRatio || 1)}dppx)`);
  if (typeof dprMediaQuery.addEventListener === 'function') {
    dprMediaQuery.addEventListener('change', dprMediaQueryListener);
  } else if (typeof dprMediaQuery.addListener === 'function') {
    dprMediaQuery.addListener(dprMediaQueryListener);
  }
}

function handlePhoneOrientationChange() {
  // iOS Safari reports stale / zero viewport dimensions for ~200-400ms after
  // orientationchange. Re-anchor the pan unconditionally (kills any stale pan
  // that could push the field off-screen when the aspect ratio flips) and re-run
  // the resize across the settle window; the ResizeObserver on #canvasWrap also
  // fires once the cell's real size lands.
  phoneUserPanned = false;
  scheduleResizePass();
  setTimeout(scheduleResizePass, 250);
  setTimeout(scheduleResizePass, 500);
}

function bindViewportObservers() {
  bindDprChangeListener();
  if (!window.__animatorResizeFallbackBound) {
    window.__animatorResizeFallbackBound = true;
    window.addEventListener('resize', scheduleResizePass);
    window.addEventListener('orientationchange', handlePhoneOrientationChange);
    window.addEventListener('pageshow', scheduleResizePass);
    document.addEventListener('visibilitychange', scheduleResizePass);
    document.addEventListener('fullscreenchange', scheduleSequenceDockPosition);
    if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
      window.visualViewport.addEventListener('resize', scheduleResizePass);
      window.visualViewport.addEventListener('resize', scheduleSequenceDockPosition);
      // Safari can pan the visual viewport (e.g. while the on-screen keyboard
      // or the dynamic toolbar is animating) without firing its own resize -
      // the phone fit reads visualViewport.offsetTop/offsetTop+height, so it
      // needs to re-run on scroll too, not just resize.
      window.visualViewport.addEventListener('scroll', scheduleResizePass);
    }
  }
  if (resizeObserver || typeof ResizeObserver !== 'function') {
    return;
  }
  const wrap = document.getElementById('canvasWrap');
  const topbar = document.getElementById('topbar');
  const bottomPanel = document.getElementById('bottomPanel');
  resizeObserver = new ResizeObserver(() => {
    scheduleResizePass();
  });
  [wrap, cv, topbar, bottomPanel].filter(Boolean).forEach((el) => resizeObserver.observe(el));
}

const GamePlan = {
  name: 'New Play',
  currentPhase: 0,
  phases: [
    {
      label: 'Phase 1',
      // Persistent state (serialized)
      players: [],
      ball: null,
      paths: [],
      passes: [],
      groups: [],
    }
  ]
};
window.GamePlan = GamePlan;

function tr(key, params = {}, fallback = '') {
  if (window.AnimatorBoardI18n && typeof window.AnimatorBoardI18n.t === 'function') {
    return window.AnimatorBoardI18n.t(key, params, fallback);
  }
  return fallback || key;
}

function modeLabel(key) {
  return tr(`mode.${key}`, {}, MODE_LABELS[key] || key);
}

function hintText(key) {
  return tr(`hint.${key}`, {}, HINTS[key] || '');
}

function S() {
  return GamePlan.phases[GamePlan.currentPhase];
}

// Persistent state (serialized with a phase / play payload)
[
  'label',
  'players',
  'ball',
  'ballOwner',
  'ballAttached',
  'paths',
  'passes',
  'groups',
  'annotations',
  'steps',
  'currentStep',
  'atkUsed',
  'defUsed',
].forEach(key => {
  Object.defineProperty(S, key, {
    configurable: true,
    get() {
      return S()[key];
    },
    set(value) {
      S()[key] = value;
    },
  });
});

Object.assign(S, {
  // Session state (never serialized)
  tool: 'move',
  tab: 'atk',
  projectId: null,
  projectMeta: null,
  playMetadata: null,
  projectPlayback: null,
  annotationDraft: null,
  arrowColor: '#d9b46c',
  arrowThickness: 'normal',
  arrowDash: 'solid',
  zoneColor: '#10b981',
  zoneThickness: 'normal',
  zoneDash: 'solid',
  boxColor: '#d9b46c',
  boxThickness: 'normal',
  boxDash: 'solid',
  ellipseColor: '#d9b46c',
  ellipseThickness: 'normal',
  ellipseDash: 'solid',
  // Selection model:
  // - selectedPlayerId: one player selected for editing at a time
  // - selectedObjectType/selectedAnnotationIdValue: non-player object selection
  // - activePasserId/activeKickerId/activeRunSourceId: armed workflow state
  // - highlightedPlayerIds: temporary workflow highlights only
  // S.selected and S.passFrom remain compatibility mirrors for older UI helpers.
  selected: null,
  selectedPlayerId: null,
  selectedPlayerIds: [],
  selectedGroupId: null,
  selectedObjectType: null,
  selectedAnnotationIdValue: null,
  currentStepBaseline: null,
  showGhostPrevious: false,
  moveGuideOrigins: {},
  annotationClipboard: null,
  dragPlayerId: null,
  dragging: null,       // { type:'player'|'group'|'ball', id? }
  dragOff: { x:0, y:0 },
  drawing: null,        // { pid, pts:[], last:{x,y} }
  passFrom: null,
  activePasserId: null,
  activeKickerId: null,
  activeRunSourceId: null,
  // Set only while an Arrow armed from the player radial menu is awaiting its
  // draw gesture or draft commit - marks the in-flight annotationDraft as a
  // one-shot, player-anchored Arrow (see activateRadialAction/handlePointerDown/
  // finishAnnotationDraft). Always null for the rail Arrow tool.
  radialArrowSourcePlayerId: null,
  highlightedPlayerIds: [],
  pendingGroupPlacement: null,
  history: [],          // undo stack (snapshots)
  future: [],           // redo stack
  animT: 0,
  animating: false,
  playAll: false,
  animSpd: 1,
  raf: null,
  lastTs: null,
  nextId: 1,
  ballAssignCandidate: null,
  pointerTap: null,
  draggingPendingGroup: false,
  selectedPassIdx: null,
  selectedPathPid: null,
});
const SPEEDS = [1, 2, 3];
let   spdIdx = 0;
function fmtSpd(v) { return v + '×'; }
const SAVED_PLAYS_KEY = 'coachmato.animator.savedPlays.v1';
const RECOVERY_DRAFT_KEY = 'rugby-gameplan:animator:recovery-draft:v1';
const RECOVERY_DRAFT_VERSION = 1;
const FIRST_USE_TUTORIAL_KEY = 'coachmato.animator.firstUseTutorial.v1';
const PROJECT_SCHEMA_VERSION = 4;
const AUTOSAVE_DEBOUNCE_MS = 800;
const PLAY_FILE_TYPE = 'rugby-gameplan-play';
const PLAY_FILE_VERSION = 1;
const PLAY_FILE_GENERATOR = 'Rugby GamePlan Tactical Board';
const IMPORT_MAX_STRING_LENGTH = 4000;
const IMPORT_MAX_NAME_LENGTH = 120;
const IMPORT_MAX_ID_LENGTH = 120;
const PHONE_UI_ACTION_GUARD_MS = 300;
const PHONE_DATA_ACTION_GUARD_MS = 400;
const NOTE_INLINE_EDIT_DOUBLE_TAP_MS = 320;
let lastPhoneAddAction = { team: null, at: -Infinity };
let playerNumberPickerState = { team: null, anchorId: null };
let phoneMoveToastTimer = null;
let phoneMoveToastShown = false;
let phoneDeleteConfirmTimers = { phase: null, move: null };
let phoneDeleteConfirmState = { phase: false, move: false };
const phoneDataActionAt = new Map();
let noteInlineEditorState = null;
let noteSelectionClearTimer = null;
let lastNoteSelectionTap = { id: null, at: 0 };
const PROJECT_TYPE = 'coachmato.animator.project';
const PLAYBACK_TIMELINE_MODEL = 'global_progress_v1';
const DEFAULT_PLAYBACK_DURATION = 5;

function claimPhoneDataAction(actionKey) {
  if (!isPhoneViewport) return true;
  const now = (typeof performance !== 'undefined' && Number.isFinite(performance.now())) ? performance.now() : Date.now();
  const lastAt = phoneDataActionAt.get(actionKey) ?? -Infinity;
  if ((now - lastAt) < PHONE_DATA_ACTION_GUARD_MS) return false;
  phoneDataActionAt.set(actionKey, now);
  return true;
}
const ANNOTATION_NOTE_DEFAULT = 'Note';
const NOTE_FONT = '"Barlow Condensed"';
const NOTE_LEGACY_SCALE_MIN = 0.6;
const NOTE_LEGACY_SCALE_MAX = 3.0;
const NOTE_DEFAULT_WIDTH = 12;
const NOTE_DEFAULT_HEIGHT = 6.5;
const NOTE_MIN_WIDTH = 2.4;
const NOTE_MIN_HEIGHT = 1.5;
const NOTE_MAX_WIDTH = 24;
const NOTE_MAX_HEIGHT = 18;
const NOTE_PADDING_X = 0.78;
const NOTE_PADDING_Y = 0.6;
const NOTE_HANDLE_HIT_PADDING = 1.25;
const ANNOTATION_CLIPBOARD_OFFSET = 1.5;
const ANNOTATION_NUDGE_STEP = 0.5;
const ARROW_DEFAULT_COLOR = '#d9b46c';
const SHAPE_DEFAULTS = Object.freeze({
  zone: { color: '#10b981', thickness: 'normal', dash: 'solid' },
  box: { color: '#d9b46c', thickness: 'normal', dash: 'solid' },
  ellipse: { color: '#d9b46c', thickness: 'normal', dash: 'solid' },
});
const ARROW_THICKNESS_PRESETS = Object.freeze({
  thin: 2.2,
  normal: 3.2,
  thick: 4.6,
});

function normalizeHexColor(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function colorsMatchSwatch(currentColor, swatchColor) {
  const current = normalizeHexColor(currentColor);
  const swatch = normalizeHexColor(swatchColor);
  if (!current || !swatch) return false;
  if (current === swatch) return true;
  return (current === '#d9b46c' && swatch === '#e3b23c')
    || (current === '#e3b23c' && swatch === '#d9b46c');
}

function arrowThicknessValue(value) {
  return Object.prototype.hasOwnProperty.call(ARROW_THICKNESS_PRESETS, value) ? value : 'normal';
}

function arrowDashValue(value) {
  return value === 'dashed' ? 'dashed' : 'solid';
}

function arrowStrokeWidthPx(value) {
  return ARROW_THICKNESS_PRESETS[arrowThicknessValue(value)] || ARROW_THICKNESS_PRESETS.normal;
}

function isShapeAnnotationType(type) {
  return type === 'zone' || type === 'box' || type === 'ellipse';
}

function defaultShapeStyle(type) {
  return SHAPE_DEFAULTS[type] || SHAPE_DEFAULTS.box;
}

function shapeStyleStateKeys(type) {
  if (type === 'zone' || type === 'ellipse') return { color: 'zoneColor', thickness: 'zoneThickness', dash: 'zoneDash' };
  return { color: 'boxColor', thickness: 'boxThickness', dash: 'boxDash' };
}

function constrainEllipseBounds(anchorX, anchorY, pointX, pointY) {
  const dx = pointX - anchorX;
  const dy = pointY - anchorY;
  const size = Math.max(Math.abs(dx), Math.abs(dy), 1.5);
  const nextX = anchorX + ((dx < 0) ? -size : size);
  const nextY = anchorY + ((dy < 0) ? -size : size);
  return {
    left: Math.min(anchorX, nextX),
    right: Math.max(anchorX, nextX),
    top: Math.min(anchorY, nextY),
    bottom: Math.max(anchorY, nextY),
  };
}

function currentShapeStyleSelection(type = null) {
  const selected = selectedAnnotation();
  const styleType = isShapeAnnotationType(selected?.type) ? selected.type : (isShapeAnnotationType(type) ? type : (isShapeAnnotationType(S.tool) ? S.tool : 'box'));
  const defaults = defaultShapeStyle(styleType);
  if (selected?.type === styleType) {
    return {
      type: styleType,
      color: selected.color || defaults.color,
      thickness: arrowThicknessValue(selected.thickness),
      dash: arrowDashValue(selected.dash),
    };
  }
  const keys = shapeStyleStateKeys(styleType);
  return {
    type: styleType,
    color: S[keys.color] || defaults.color,
    thickness: arrowThicknessValue(S[keys.thickness]),
    dash: arrowDashValue(S[keys.dash]),
  };
}

function applyShapeStyleSelection(partial = {}) {
  const selectedId = selectedAnnotationId();
  const selected = selectedAnnotation();
  const styleType = isShapeAnnotationType(selected?.type) ? selected.type : (isShapeAnnotationType(S.tool) ? S.tool : 'box');
  const current = currentShapeStyleSelection(styleType);
  const next = {
    type: styleType,
    color: partial.color || current.color || defaultShapeStyle(styleType).color,
    thickness: arrowThicknessValue(partial.thickness ?? current.thickness),
    dash: arrowDashValue(partial.dash ?? current.dash),
  };
  const keys = shapeStyleStateKeys(styleType);
  S[keys.color] = next.color;
  S[keys.thickness] = next.thickness;
  S[keys.dash] = next.dash;
  if (selected?.type === styleType && selectedId) {
    snapshot();
    const ann = findAnnotationById(selectedId);
    if (ann?.type === styleType) {
      ann.color = next.color;
      ann.thickness = next.thickness;
      ann.dash = next.dash;
    }
  }
  refreshInteractionUI();
  render();
  return next;
}

function shapeDashPattern(dash, strokeWidth) {
  return arrowDashValue(dash) === 'dashed'
    ? [Math.max(8, strokeWidth * 2.8), Math.max(6, strokeWidth * 1.9)]
    : [];
}

function hexToRgba(color, alpha) {
  const hex = normalizeHexColor(color).replace('#', '');
  if (hex.length !== 6) return `rgba(217,180,108,${alpha})`;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function syncColorSwatches(root, currentColor) {
  if (!root) return;
  root.querySelectorAll('.sp-color-swatch').forEach(sw => {
    sw.classList.toggle('active', colorsMatchSwatch(currentColor, sw.dataset.color));
  });
}

function syncArrowStyleButtons(root, arrowStyle) {
  if (!root) return;
  root.querySelectorAll('[data-arrow-thickness]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.arrowThickness === arrowStyle.thickness);
  });
  root.querySelectorAll('[data-arrow-dash]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.arrowDash === arrowStyle.dash);
  });
}

function syncShapeStyleButtons(root, shapeStyle) {
  if (!root) return;
  root.querySelectorAll('[data-shape-thickness]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.shapeThickness === shapeStyle.thickness);
  });
  root.querySelectorAll('[data-shape-dash]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.shapeDash === shapeStyle.dash);
  });
}

function syncNoteAlignButtons(root, align) {
  if (!root) return;
  root.querySelectorAll('[data-note-align]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.noteAlign === align);
  });
}

function annotationColorLabel(color) {
  const normalized = normalizeHexColor(color);
  if (normalized === '#ffffff') return 'White';
  if (normalized === '#e3b23c') return 'Gold';
  if (normalized === '#10b981') return 'Green';
  if (normalized === '#ef4444') return 'Red';
  if (normalized === '#3b82f6') return 'Blue';
  if (normalized === '#f97316') return 'Orange';
  return 'Color';
}

function styleWeightLabel(weight) {
  if (weight === 'thin') return 'Thin';
  if (weight === 'thick') return 'Thick';
  return 'Normal';
}

function styleLineLabel(dash) {
  return arrowDashValue(dash) === 'dashed' ? 'Dashed' : 'Solid';
}

function noteAlignLabel(align) {
  if (align === 'center') return 'C';
  if (align === 'right') return 'R';
  return 'L';
}

function closeFloatingToolbarFlyout() {
  floatingToolbarOpenFlyout = '';
  const toolbar = document.getElementById('floatingSelectionToolbar');
  if (!toolbar) return;
  toolbar.querySelectorAll('[data-flyout-target]').forEach(btn => {
    btn.setAttribute('aria-expanded', 'false');
  });
  toolbar.querySelectorAll('.floating-selection-toolbar-flyout').forEach(flyout => {
    flyout.hidden = true;
    flyout.dataset.placement = 'bottom';
    flyout.style.left = '0px';
    flyout.style.top = '';
    flyout.style.bottom = '';
  });
}
window.closeFloatingToolbarFlyout = closeFloatingToolbarFlyout;

function setFloatingToolbarColor(color) {
  setAnnotationColor(color);
  closeFloatingToolbarFlyout();
}
window.setFloatingToolbarColor = setFloatingToolbarColor;

function setFloatingToolbarLineStyle(dash) {
  const ann = selectedAnnotation();
  if (!ann) return;
  if (ann.type === 'arrow') setArrowDash(dash);
  else if (isShapeAnnotationType(ann.type)) setShapeDash(dash);
  closeFloatingToolbarFlyout();
}
window.setFloatingToolbarLineStyle = setFloatingToolbarLineStyle;

function setFloatingToolbarWeight(thickness) {
  const ann = selectedAnnotation();
  if (!ann) return;
  if (ann.type === 'arrow') setArrowThickness(thickness);
  else if (isShapeAnnotationType(ann.type)) setShapeThickness(thickness);
  closeFloatingToolbarFlyout();
}
window.setFloatingToolbarWeight = setFloatingToolbarWeight;

function setFloatingToolbarNoteAlign(align) {
  setSelectedNoteAlign(align);
  closeFloatingToolbarFlyout();
}
window.setFloatingToolbarNoteAlign = setFloatingToolbarNoteAlign;
const ANNOTATION_NUDGE_STEP_LARGE = 1.5;
const NOTE_LEGACY_REFERENCE_SCALE = 10;
const NOTE_LEGACY_FONT_PX = 12.5;
const STEP_MIN_COUNT = 3;
let firstUseTutorialDismissed = false;
const BOARD_BALL_ASSET_SRC = '../../assets/donau/images/rugby_ball_fire_scalable_bottom_right_fixed.svg';
const boardBallAsset = new Image();
let boardBallAssetReady = false;

boardBallAsset.addEventListener('load', () => {
  boardBallAssetReady = true;
  render();
});
boardBallAsset.src = BOARD_BALL_ASSET_SRC;

// ── Rugby Preset Architecture (Phase 2 — not yet implemented) ────────────
// Future presets will inject player positions + movement paths into the
// current step. Each preset is a pure data object — no side effects.
// Preset types: lineout, scrum, pod, backfield.
// Usage (future): applyPreset(RUGBY_PRESETS.lineout.left);
const RUGBY_PRESETS = {
  // lineout:  { variants: { left: null, right: null } },
  // scrum:    { variants: { left: null, right: null } },
  // pod:      { variants: { narrow: null, wide: null } },
  // backfield:{ variants: { standard: null } },
};

// ── Pitch texture configuration ──────────────────────────────────────────
const PITCH_CONFIG = {
  textureStrength: 0.09, // grass noise opacity (0–1); lower = subtler
  stripeCount:     12,   // mow stripes across field width
};

let _grassTile = null; // cached noise tile — built once, reused every frame

function getGrassTile() {
  if (_grassTile) return _grassTile;
  const SIZE = 256;
  const oc = document.createElement('canvas');
  oc.width = SIZE; oc.height = SIZE;
  const oc2 = oc.getContext('2d');
  const img = oc2.createImageData(SIZE, SIZE);
  const d = img.data;
  // Deterministic xorshift-32 so the pattern is always the same
  let s = 0xabcdef01;
  const rnd = () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
  for (let i = 0; i < SIZE * SIZE; i++) {
    const v = Math.floor(rnd() * 210 + 22); // 22–232, avoid pure black/white
    const idx = i * 4;
    d[idx] = d[idx + 1] = d[idx + 2] = v;
    d[idx + 3] = 255; // opacity handled by globalAlpha when drawing
  }
  oc2.putImageData(img, 0, 0);
  _grassTile = oc;
  return oc;
}

function isMobileBoardViewport() {
  return isPhoneViewport;
}

function hasSeenFirstUseTutorial() {
  try { return localStorage.getItem(FIRST_USE_TUTORIAL_KEY) === '1'; } catch(e) { return false; }
}

function markFirstUseTutorialSeen() {
  firstUseTutorialDismissed = true;
  try { localStorage.setItem(FIRST_USE_TUTORIAL_KEY, '1'); } catch(e) {}
}

function shouldShowFirstUseTutorial() {
  return !firstUseTutorialDismissed && !S.players.length && !S.ball && !S.annotations.length;
}

// Guided Onboarding Tour
let _tourCurrentStep = 0;
let _tourSpotlit = null;
let _tourActive = false;

const TOUR_STEPS = [
  {
    targetId: 'mobileAddAttackBtn',
    position: 'above',
    titleKey: 'tour.1.title',
    bodyKey: 'tour.1.body',
  },
  {
    targetId: 'mobileBallBtn',
    position: 'above',
    titleKey: 'tour.2.title',
    bodyKey: 'tour.2.body',
  },
  {
    targetId: null,
    position: 'centre',
    titleKey: 'tour.3.title',
    bodyKey: 'tour.3.body',
  },
  {
    targetId: 'bottomPanel',
    position: 'above',
    titleKey: 'tour.4.title',
    bodyKey: 'tour.4.body',
  },
  {
    targetId: 'phaseChipStrip',
    position: 'below',
    titleKey: 'tour.5.title',
    bodyKey: 'tour.5.body',
  },
  {
    targetId: 'playBtn',
    position: 'above',
    titleKey: 'tour.6.title',
    bodyKey: 'tour.6.body',
  },
];

function _tourClearSpotlight() {
  if (_tourSpotlit) {
    _tourSpotlit.classList.remove('tour-spotlight');
    _tourSpotlit = null;
  }
}

function _tourPositionTooltip(tooltip, targetEl, position) {
  const pad = 12;
  tooltip.style.left = '';
  tooltip.style.right = '';
  tooltip.style.top = '';
  tooltip.style.bottom = '';
  tooltip.style.transform = '';

  if (!targetEl || position === 'centre') {
    tooltip.style.left = '50%';
    tooltip.style.top = '50%';
    tooltip.style.transform = 'translate(-50%,-50%)';
    return;
  }

  const tr = targetEl.getBoundingClientRect();
  const tw = tooltip.offsetWidth || 280;
  const th = tooltip.offsetHeight || 160;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = tr.left + tr.width / 2 - tw / 2;
  left = Math.max(pad, Math.min(left, vw - tw - pad));

  if (position === 'above') {
    const top = tr.top - th - 14;
    tooltip.style.left = left + 'px';
    tooltip.style.top = Math.max(pad, top) + 'px';
  } else {
    const top = tr.bottom + 14;
    tooltip.style.left = left + 'px';
    tooltip.style.top = Math.min(top, vh - th - pad) + 'px';
  }
}

function _tourShowStep(index) {
  const backdrop = document.getElementById('tourBackdrop');
  const tooltip  = document.getElementById('tourTooltip');
  const counter  = document.getElementById('tourCounter');
  const title    = document.getElementById('tourTitle');
  const body     = document.getElementById('tourBody');
  const nextBtn  = document.getElementById('tourNext');
  const skipBtn  = document.getElementById('tourSkip');
  if (!tooltip) return;

  _tourClearSpotlight();

  const step = TOUR_STEPS[index];
  const isLast = index === TOUR_STEPS.length - 1;

  counter.textContent = tr('tour.counter', { current: index + 1, total: TOUR_STEPS.length }, `Step ${index + 1} of ${TOUR_STEPS.length}`);
  title.textContent = tr(step.titleKey, {}, step.title || '');
  body.innerHTML = tr(step.bodyKey, {}, step.body || '');
  nextBtn.textContent = isLast ? tr('tour.done', {}, 'Done') : tr('tour.next', {}, 'Next');
  if (skipBtn) skipBtn.textContent = tr('tour.skip', {}, 'Skip tour');

  const targetEl = step.targetId ? document.getElementById(step.targetId) : null;
  if (targetEl) {
    targetEl.classList.add('tour-spotlight');
    _tourSpotlit = targetEl;
  }

  if (backdrop) backdrop.classList.add('active');
  tooltip.classList.add('active');

  requestAnimationFrame(() => {
    _tourPositionTooltip(tooltip, targetEl, step.position);
  });

  nextBtn.onclick = () => {
    if (isLast) {
      endTour();
    } else {
      _tourCurrentStep++;
      _tourShowStep(_tourCurrentStep);
    }
  };
  skipBtn.onclick = () => endTour();
}

function startTour() {
  if (_tourActive) return;
  _tourActive = true;
  _tourCurrentStep = 0;
  _tourShowStep(0);
}

function endTour() {
  if (!_tourActive && firstUseTutorialDismissed) return;
  _tourActive = false;
  _tourClearSpotlight();
  const backdrop = document.getElementById('tourBackdrop');
  const tooltip  = document.getElementById('tourTooltip');
  if (backdrop) backdrop.classList.remove('active');
  if (tooltip) tooltip.classList.remove('active');
  markFirstUseTutorialSeen();
  updateBoardStatus();
}

function dismissFirstUseTutorial() {
  endTour();
}

function completeFirstUseTutorial() {
  if (firstUseTutorialDismissed) return;
  if (_tourActive) {
    endTour();
    return;
  }
  markFirstUseTutorialSeen();
  updateBoardStatus();
}

window.dismissFirstUseTutorial = dismissFirstUseTutorial;
window.startTour = startTour;

const R = () => {
  const base = Math.max(19, Math.min(30, sc * 2.22));
  if (isPhoneViewport) return Math.max(20, Math.min(27, sc * 2.38));
  return base;
};

function nowIso() {
  return new Date().toISOString();
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function mkProjectId() {
  return `project_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function mkAnnotationId() {
  return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function playerRef(pl) {
  return pl ? { num: pl.num, team: pl.team } : null;
}

function samePlayerRef(a, b) {
  return !!a && !!b && a.num === b.num && a.team === b.team;
}

function findPlayerByRef(ref) {
  if (!ref) return null;
  return S.players.find(pl => pl.num === ref.num && pl.team === ref.team) || null;
}

function findBallSnapTarget(ball = S.ball) {
  if (!ball) return null;
  return S.players.find(p => d2({ x: ball.x, y: ball.y }, { x: p.x, y: p.y }) < SNAP_RADIUS) || null;
}

function normalizePlayerRef(ref) {
  if (!ref || typeof ref !== 'object') return null;
  const team = ref.team === 'D' ? 'D' : ref.team === 'A' ? 'A' : null;
  const num = Number(ref.num);
  if (!team || !Number.isFinite(num)) return null;
  return { num, team };
}

function normalizeGroupRef(ref) {
  return normalizePlayerRef(ref);
}

function normalizeGroupState(group = {}, index = 0) {
  const refs = Array.isArray(group.playerRefs)
    ? group.playerRefs.map(normalizeGroupRef).filter(Boolean)
    : [];
  if (!refs.length) return null;
  return {
    id: group.id || `group_${index + 1}`,
    label: String(group.label || `Pack ${index + 1}`).trim(),
    type: group.type || 'pack',
    team: group.team === 'D' ? 'D' : 'A',
    active: group.active !== false,
    color: typeof group.color === 'string' ? group.color : '',
    playerRefs: refs,
  };
}

function playerMatchesRef(player, ref) {
  return !!player && !!ref && player.num === ref.num && player.team === ref.team;
}

function normalizePlaybackSettings(playback = {}) {
  const currentSpeed = Number(playback.currentSpeed);
  const defaultSpeed = Number(playback.defaultSpeed);
  return {
    durationSeconds: DEFAULT_PLAYBACK_DURATION,
    currentSpeed: SPEEDS.includes(currentSpeed) ? currentSpeed : 1,
    defaultSpeed: SPEEDS.includes(defaultSpeed) ? defaultSpeed : 1,
    timelineModel: PLAYBACK_TIMELINE_MODEL,
  };
}

function playerKey(ref) {
  return ref?.team && Number.isFinite(Number(ref.num)) ? `${ref.team}:${Number(ref.num)}` : null;
}

function normalizeStepPlayers(players = []) {
  if (!Array.isArray(players)) return [];
  const normalized = players
    .map(pl => {
      const id = Number(pl?.id);
      const colorOverride = typeof pl?.colorOverride === 'string' ? pl.colorOverride : '';
      const team = pl?.team === 'D' ? 'D' : pl?.team === 'A' ? 'A' : null;
      const num = Number(pl?.num);
      const x = Number(pl?.x);
      const y = Number(pl?.y);
      if (!team || !Number.isFinite(num) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
      return {
        ...(Number.isFinite(id) ? { id } : {}),
        num,
        team,
        x,
        y,
        ...(colorOverride ? { colorOverride } : {}),
      };
    })
    .filter(Boolean);
  const deduped = new Map();
  normalized.forEach(player => {
    deduped.set(playerKey(player), player);
  });
  return Array.from(deduped.values());
}

function normalizeBallPosition(ball) {
  if (!ball || typeof ball !== 'object') return null;
  const x = Number(ball.x);
  const y = Number(ball.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function normalizeStepPath(path) {
  if (!path || typeof path !== 'object') return null;
  const team = path.team === 'D' ? 'D' : path.team === 'A' ? 'A' : null;
  const num = Number(path.num);
  const pts = Array.isArray(path.pts)
    ? path.pts
        .map(pt => {
          const x = Number(pt?.x);
          const y = Number(pt?.y);
          return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
        })
        .filter(Boolean)
    : [];
  if (!team || !Number.isFinite(num) || pts.length < 2) return null;
  return { num, team, pts };
}

function normalizeStepPass(pass) {
  if (!pass || typeof pass !== 'object') return null;
  const style = pass.style === 'kick' ? 'kick' : pass.style === 'pass' ? 'pass' : null;
  if (!style) return null;
  const fromNum = Number(pass.fromNum);
  const fromT = pass.fromT === 'D' ? 'D' : pass.fromT === 'A' ? 'A' : null;
  if (!fromT || !Number.isFinite(fromNum)) return null;
  // Field-target kick: no receiver, has coordinate target
  if (style === 'kick' && pass.toNum === undefined && pass.targetX !== undefined) {
    const targetX = Number(pass.targetX), targetY = Number(pass.targetY);
    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) return null;
    return { fromNum, fromT, targetX, targetY, style: 'kick' };
  }
  const toNum = Number(pass.toNum);
  const toT = pass.toT === 'D' ? 'D' : pass.toT === 'A' ? 'A' : null;
  if (!toT || !Number.isFinite(toNum)) return null;
  return { fromNum, fromT, toNum, toT, style };
}

function normalizeStepState(step = {}, fallbackPlayers = []) {
  const fallback = normalizeStepPlayers(fallbackPlayers);
  const players = normalizeStepPlayers(step.players);
  return {
    players: players.length ? players : fallback,
    ball: normalizeBallPosition(step.ball),
    ballOwner: normalizePlayerRef(step.ballOwner || step.ball?.owner),
    ballAttached: !!step.ballAttached,
    paths: Array.isArray(step.paths) ? step.paths.map(normalizeStepPath).filter(Boolean) : [],
    passes: Array.isArray(step.passes) ? step.passes.map(normalizeStepPass).filter(Boolean) : [],
    annotations: Array.isArray(step.annotations) ? step.annotations.map(normalizeAnnotation).filter(Boolean) : [],
  };
}

function normalizePhaseState(phase = {}, index = 0) {
  const fallbackStep = normalizeStepState({
    players: cloneData(phase.players || []),
    ball: phase.ball ? cloneData(phase.ball) : null,
    ballOwner: normalizePlayerRef(phase.ballOwner || phase.ball?.owner),
    ballAttached: !!phase.ballAttached,
    paths: cloneData(phase.paths || []),
    passes: cloneData(phase.passes || []),
    annotations: Array.isArray(phase.annotations) ? phase.annotations : [],
  });
  const steps = Array.isArray(phase.steps) && phase.steps.length
    ? phase.steps.map(step => normalizeStepState(step, fallbackStep.players))
    : [fallbackStep];
  const currentStep = clamp(Number.isFinite(phase.currentStep) ? Number(phase.currentStep) : 0, 0, steps.length - 1);
  const liveStep = steps[currentStep] || steps[0] || fallbackStep;
  const players = cloneData(liveStep.players);
  const groups = Array.isArray(phase.groups)
    ? phase.groups.map((group, groupIndex) => normalizeGroupState(group, groupIndex)).filter(Boolean)
    : [];

  return {
    id: typeof phase.id === 'string' && phase.id.trim() ? phase.id : crypto.randomUUID(),
    label: phase.label || `Phase ${index + 1}`,
    notes: typeof phase.notes === 'string' ? phase.notes : '',
    players,
    ball: liveStep.ball ? cloneData(liveStep.ball) : null,
    ballOwner: normalizePlayerRef(liveStep.ballOwner),
    ballAttached: !!liveStep.ballAttached,
    paths: cloneData(liveStep.paths),
    passes: cloneData(liveStep.passes),
    groups,
    annotations: cloneData(liveStep.annotations),
    steps,
    currentStep,
    atkUsed: new Set(players.filter(pl => pl.team === 'A').map(pl => pl.num)),
    defUsed: new Set(players.filter(pl => pl.team === 'D').map(pl => pl.num)),
  };
}

function cloneStepState(step) {
  return normalizeStepState(cloneData(step), step?.players || []);
}

function emptyStepState() {
  return { players: [], ball: null, ballOwner: null, ballAttached: false, paths: [], passes: [], annotations: [] };
}

function liveBoardToStepState() {
  return normalizeStepState({
    players: S.players.map(({ id, num, team, x, y, colorOverride }) => ({
      id, num, team, x, y,
      ...(colorOverride ? { colorOverride } : {}),
    })),
    ball: S.ball ? { ...S.ball } : null,
    ballOwner: normalizePlayerRef(S.ballOwner),
    ballAttached: !!S.ballAttached,
    paths: S.paths.map(path => {
      const pl = S.players.find(q => q.id === path.pid);
      return pl ? { num: pl.num, team: pl.team, pts: path.pts.map(pt => ({ ...pt })) } : null;
    }).filter(Boolean),
    passes: S.passes.map(pass => {
      const from = S.players.find(q => q.id === pass.from);
      if (!from) return null;
      if (pass.style === 'kick' && pass.to === null && pass.targetX !== undefined) {
        return { fromNum: from.num, fromT: from.team, targetX: pass.targetX, targetY: pass.targetY, style: 'kick' };
      }
      const to = S.players.find(q => q.id === pass.to);
      return to ? { fromNum: from.num, fromT: from.team, toNum: to.num, toT: to.team, style: pass.style } : null;
    }).filter(Boolean),
    annotations: cloneData(Array.isArray(S.annotations) ? S.annotations : []),
  });
}

function ensureSteps() {
  if (!Array.isArray(S.steps) || !S.steps.length) {
    S.steps = [liveBoardToStepState()];
  }
  S.currentStep = clamp(S.currentStep, 0, S.steps.length - 1);
}

function persistCurrentStep() {
  ensureSteps();
  S.steps[S.currentStep] = liveBoardToStepState();
}

function commitLiveBoardToCurrentStep() {
  ensureSteps();
  S.steps[S.currentStep] = liveBoardToStepState();
}

function serializePhase(phase = S(), index = GamePlan.currentPhase) {
  const normalized = normalizePhaseState(phase, index);
  return {
    id: normalized.id,
    label: normalized.label || `Phase ${index + 1}`,
    notes: normalized.notes,
    players: cloneData(normalized.players),
    ball: normalized.ball ? cloneData(normalized.ball) : null,
    ballOwner: normalizePlayerRef(normalized.ballOwner),
    ballAttached: !!normalized.ballAttached,
    paths: cloneData(normalized.paths),
    passes: cloneData(normalized.passes),
    groups: cloneData(normalized.groups),
    annotations: cloneData(normalized.annotations),
    currentStep: normalized.currentStep,
    steps: normalized.steps.map(step => cloneStepState(step)),
  };
}

function persistCurrentPhase() {
  persistCurrentStep();
  // normalizePhaseState()/serializePhase() derive their top-level .passes/.paths
  // from the just-persisted .steps[currentStep], which is in the SERIALIZED
  // shape needed for storage (passes keyed by fromNum/fromT/toNum/toT, paths
  // keyed by num/team) - that shape is only valid inside .steps. S.passes and
  // S.paths are getters straight into this same phase object's top-level
  // .passes/.paths, so assigning the round-tripped result there directly would
  // replace the live, id-keyed runtime shape (pass.from/pass.to are player
  // ids; path.pid/path.color) with the serialized one, breaking every
  // id-based lookup against S.players (silently corrupting or dropping the
  // pass/path next time anything reads it as live state). Capture fresh,
  // independent clones of the actual live arrays first and restore them onto
  // the persisted phase object afterward, so persisting never mutates - or
  // leaves a serialized-shaped copy of - runtime Pass/Kick/path state. The
  // exported/autosaved payload is unaffected: it's built from .steps, not
  // from these top-level fields.
  const livePasses = cloneData(S.passes);
  const livePaths = cloneData(S.paths);
  const persistedPhase = normalizePhaseState(serializePhase(S(), GamePlan.currentPhase), GamePlan.currentPhase);
  persistedPhase.passes = livePasses;
  persistedPhase.paths = livePaths;
  GamePlan.phases[GamePlan.currentPhase] = persistedPhase;
}

function serializeGamePlan(nameOverride) {
  persistCurrentPhase();
  const title = nameOverride || currentPlayTitle();
  GamePlan.name = title;
  return {
    name: title,
    currentPhase: clamp(GamePlan.currentPhase, 0, Math.max(0, GamePlan.phases.length - 1)),
    phases: GamePlan.phases.map((phase, index) => serializePhase(phase, index)),
  };
}

function setLiveBoardFromStep(step, { keepSelection = false } = {}) {
  const normalized = normalizeStepState(step);
  const selectedPlayerRef = keepSelection && S.selectedObjectType === 'player'
    ? playerRef(S.players.find(pl => pl.id === S.selectedPlayerId))
    : null;
  const selectedObjectType = keepSelection ? S.selectedObjectType : null;
  const selectedAnnotation = keepSelection ? S.selectedAnnotationIdValue : null;
  let nextIdSeed = S.nextId;
  S.players = normalized.players.map(pl => {
    const id = Number.isFinite(Number(pl.id)) ? Number(pl.id) : nextIdSeed++;
    nextIdSeed = Math.max(nextIdSeed, id + 1);
    return { ...pl, id, isBC: false };
  });
  S.nextId = nextIdSeed;
  S.atkUsed = new Set(S.players.filter(pl => pl.team === 'A').map(pl => pl.num));
  S.defUsed = new Set(S.players.filter(pl => pl.team === 'D').map(pl => pl.num));
  S.ball = normalized.ball ? { ...normalized.ball } : null;
  S.ballOwner = normalizePlayerRef(normalized.ballOwner);
  S.ballAttached = !!normalized.ballAttached;
  S.annotations = normalized.annotations.map(item => normalizeAnnotation(item)).filter(Boolean);

  S.paths = normalized.paths.map(path => {
    const pl = S.players.find(q => q.num === path.num && q.team === path.team);
    const col = path.team === 'A' ? '#60a5fa' : '#f87171';
    return pl ? { pid: pl.id, pts: path.pts || [], color: col } : null;
  }).filter(Boolean);

  S.passes = normalized.passes.map(pass => {
    const from = S.players.find(q => q.num === pass.fromNum && q.team === pass.fromT);
    if (!from) return null;
    if (pass.style === 'kick' && pass.targetX !== undefined) {
      return { from: from.id, to: null, targetX: pass.targetX, targetY: pass.targetY, style: 'kick' };
    }
    const to = S.players.find(q => q.num === pass.toNum && q.team === pass.toT);
    return to ? { from: from.id, to: to.id, style: pass.style } : null;
  }).filter(Boolean);

  const selectedPlayer = selectedPlayerRef ? S.players.find(pl => samePlayerRef(playerRef(pl), selectedPlayerRef)) : null;
  S.selectedPlayerId = selectedPlayer?.id || null;
  S.selectedObjectType = selectedObjectType === 'player' && !selectedPlayer ? null : selectedObjectType;
  S.selectedAnnotationIdValue = selectedAnnotation;
  S.currentStepBaseline = cloneStepState(normalized);
  S.moveGuideOrigins = {};
  syncLegacySelectionState();
  if (S.ballAttached && S.ballOwner) syncAttachedBallToOwner();
  else if (S.ball && !S.ballOwner) updateBallOwnerFromPosition();
  else applyBallOwnershipVisualState();
}

function goToPhase(idx) {
  clearPendingCanonicalPhaseStart();
  resetDeleteConfirm('phase');
  resetDeleteConfirm('move');
  persistCurrentPhase();
  cancelCanonicalPlaybackFrame();
  S.animating = false;
  S.playAll = false;
  S.lastTs = null;
  S.animT = 0;
  canonicalPlaybackBoundaryIndex = null;
  canonicalPlaybackMode = 'idle';
  GamePlan.currentPhase = Math.max(0, Math.min(idx, GamePlan.phases.length - 1));
  const phase = normalizePhaseState(GamePlan.phases[GamePlan.currentPhase], GamePlan.currentPhase);
  GamePlan.phases[GamePlan.currentPhase] = phase;
  clearSelectedObject();
  S.dragging = null;
  S.drawing = null;
  clearPassKickState();
  S.annotationDraft = null;
  setLiveBoardFromStep(phase.steps[phase.currentStep] || emptyStepState());
  rebuildPalette();
  updateSelInfo();
  updatePhaseUI();
  refreshInteractionUI();
  render();
}

function addPhase() {
  clearPendingCanonicalPhaseStart();
  snapshot();
  const current = serializePhase(S(), GamePlan.currentPhase);
  const sourceStep = cloneStepState(current.steps?.[Number(current.currentStep)] || current.steps?.[0] || emptyStepState());
  const carryForwardStep = createCarryForwardStep(sourceStep);
  current.id = crypto.randomUUID();
  current.label = `Phase ${GamePlan.phases.length + 1}`;
  current.notes = '';
  current.players = cloneData(carryForwardStep.players);
  current.ball = carryForwardStep.ball ? cloneData(carryForwardStep.ball) : null;
  current.ballOwner = normalizePlayerRef(carryForwardStep.ballOwner);
  current.ballAttached = !!carryForwardStep.ballAttached;
  current.paths = [];
  current.passes = [];
  current.annotations = cloneData(carryForwardStep.annotations || []);
  current.steps = [carryForwardStep];
  current.currentStep = 0;
  const nextPhaseIndex = GamePlan.phases.length;
  const nextPhase = normalizePhaseState(current, nextPhaseIndex);
  GamePlan.phases.push(nextPhase);
  cancelCanonicalPlaybackFrame();
  S.animating = false;
  S.playAll = false;
  S.lastTs = null;
  S.animT = 0;
  canonicalPlaybackBoundaryIndex = null;
  canonicalPlaybackMode = 'idle';
  GamePlan.currentPhase = nextPhaseIndex;
  clearSelectedObject();
  S.dragging = null;
  S.drawing = null;
  clearPassKickState();
  S.annotationDraft = null;
  setLiveBoardFromStep(nextPhase.steps[nextPhase.currentStep] || emptyStepState());
  S.ballOwner = null;
  S.ballAttached = false;
  applyBallOwnershipVisualState();
  rebuildPalette();
  updateSelInfo();
  updatePhaseUI();
  refreshInteractionUI();
  flashMobilePhaseCounter();
  render();
}

function relabelPhases() {
  GamePlan.phases.forEach((phase, index) => {
    phase.label = `Phase ${index + 1}`;
  });
}

function loadCurrentPhaseBoardState() {
  const phase = normalizePhaseState(GamePlan.phases[GamePlan.currentPhase], GamePlan.currentPhase);
  GamePlan.phases[GamePlan.currentPhase] = phase;
  clearSelectedObject();
  S.dragging = null;
  S.drawing = null;
  clearPassKickState();
  S.annotationDraft = null;
  setLiveBoardFromStep(phase.steps[phase.currentStep] || emptyStepState());
  S.ballOwner = normalizePlayerRef(phase.ballOwner);
  S.ballAttached = !!phase.ballAttached;
  applyBallOwnershipVisualState();
  rebuildPalette();
  updateSelInfo();
  updatePhaseUI();
  refreshInteractionUI();
}

function addPhaseAfterCurrent() {
  clearPendingCanonicalPhaseStart();
  if (!claimPhoneDataAction('more:phase:add')) return;
  resetDeleteConfirm('phase');
  resetDeleteConfirm('move');
  snapshot();
  persistCurrentPhase();
  const current = serializePhase(S(), GamePlan.currentPhase);
  const sourceStep = cloneStepState(current.steps?.[Number(current.currentStep)] || current.steps?.[0] || emptyStepState());
  const carryForwardStep = createCarryForwardStep(sourceStep);
  const nextPhase = normalizePhaseState({
    id: crypto.randomUUID(),
    label: `Phase ${GamePlan.currentPhase + 2}`,
    notes: '',
    players: cloneData(carryForwardStep.players),
    ball: carryForwardStep.ball ? cloneData(carryForwardStep.ball) : null,
    ballOwner: normalizePlayerRef(carryForwardStep.ballOwner),
    ballAttached: !!carryForwardStep.ballAttached,
    paths: [],
    passes: [],
    annotations: cloneData(carryForwardStep.annotations || []),
    steps: [carryForwardStep],
    currentStep: 0,
  }, GamePlan.currentPhase + 1);
  const nextPhaseIndex = GamePlan.currentPhase + 1;
  snapshot();
  GamePlan.phases.splice(nextPhaseIndex, 0, nextPhase);
  relabelPhases();
  cancelCanonicalPlaybackFrame();
  S.animating = false;
  S.playAll = false;
  S.lastTs = null;
  S.animT = 0;
  canonicalPlaybackBoundaryIndex = null;
  canonicalPlaybackMode = 'idle';
  GamePlan.currentPhase = nextPhaseIndex;
  loadCurrentPhaseBoardState();
  flashMobilePhaseCounter();
  render();
}

function resetDeleteConfirm(kind) {
  if (phoneDeleteConfirmTimers[kind]) {
    clearTimeout(phoneDeleteConfirmTimers[kind]);
    phoneDeleteConfirmTimers[kind] = null;
  }
  phoneDeleteConfirmState[kind] = false;
}

function armDeleteConfirm(kind) {
  resetDeleteConfirm(kind);
  phoneDeleteConfirmState[kind] = true;
  phoneDeleteConfirmTimers[kind] = setTimeout(() => {
    phoneDeleteConfirmState[kind] = false;
    phoneDeleteConfirmTimers[kind] = null;
    refreshInteractionUI();
  }, 3000);
  refreshInteractionUI();
}

function confirmDeleteAction(kind) {
  if (phoneDeleteConfirmState[kind]) {
    resetDeleteConfirm(kind);
    return true;
  }
  armDeleteConfirm(kind);
  return false;
}

function deleteCurrentPhaseWithConfirm() {
  if (!claimPhoneDataAction('more:phase:delete')) return;
  if (!confirmDeleteAction('phase')) return;
  resetDeleteConfirm('move');
  snapshot();
  persistCurrentPhase();
  stopPlayback(true);
  if (GamePlan.phases.length === 1) {
    GamePlan.currentPhase = 0;
    GamePlan.phases = [normalizePhaseState({ label: 'Phase 1' }, 0)];
    setHint('Phase reset. Build the board again from a clean starting phase.');
  } else {
    GamePlan.phases.splice(GamePlan.currentPhase, 1);
    GamePlan.currentPhase = Math.min(GamePlan.currentPhase, GamePlan.phases.length - 1);
    relabelPhases();
    setHint(`Phase ${GamePlan.currentPhase + 1} ready after deletion.`);
  }
  loadCurrentPhaseBoardState();
  flashMobilePhaseCounter();
  render();
}

function activatePhaseForPlayback(idx, { resetToStart = false } = {}) {
  S.animT = 0;
  GamePlan.currentPhase = Math.max(0, Math.min(idx, GamePlan.phases.length - 1));
  const phase = normalizePhaseState(GamePlan.phases[GamePlan.currentPhase], GamePlan.currentPhase);
  if (resetToStart) phase.currentStep = 0;
  GamePlan.phases[GamePlan.currentPhase] = phase;
  clearSelectedObject();
  S.dragging = null;
  S.drawing = null;
  clearPassKickState();
  S.annotationDraft = null;
  setLiveBoardFromStep(phase.steps[phase.currentStep] || emptyStepState());
  rebuildPalette();
  updateSelInfo();
  updatePhaseUI();
  refreshInteractionUI();
}

function updatePhaseUI() {
  const total = GamePlan.phases.length;
  const cur = GamePlan.currentPhase;
  const strip = document.getElementById('phaseChipStrip');
  if (!strip) return;
  strip.innerHTML = '';
  GamePlan.phases.forEach((phase, index) => {
    const wrap = document.createElement('span');
    wrap.className = 'seq-chip-wrap';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tb-phase-chip${index === cur ? ' active' : ''}`;
    btn.textContent = String(index + 1);
    btn.title = phase?.label || `Phase ${index + 1}`;
    btn.setAttribute('aria-label', `Go to ${phase?.label || `Phase ${index + 1}`}`);
    btn.setAttribute('aria-current', index === cur ? 'step' : 'false');
    btn.onclick = () => goToPhase(index);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'seq-chip-del';
    del.textContent = '×';
    del.title = `Delete Step ${index + 1}`;
    del.onclick = (e) => { e.stopPropagation(); deleteStepAt(index); };

    wrap.appendChild(btn);
    wrap.appendChild(del);
    strip.appendChild(wrap);
  });
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'tb-phase-chip tb-phase-chip-add';
  addBtn.textContent = '+';
  addBtn.title = 'Add phase';
  addBtn.setAttribute('aria-label', 'Add phase');
  addBtn.onclick = () => addPhase();
  strip.appendChild(addBtn);
}

function createCarryForwardStep(step) {
  const source = normalizeStepState(step);
  const pathByPlayer = new Map(
    source.paths.map(path => [playerKey({ team: path.team, num: path.num }), path])
  );

  const players = source.players.map(player => {
    const path = pathByPlayer.get(playerKey(player));
    if (path && Array.isArray(path.pts) && path.pts.length >= 2) {
      const end = catmullRom(path.pts, 1.0);
      return {
        ...player,
        x: end.x,
        y: end.y,
        isBC: false,
      };
    }
    return {
      ...player,
      isBC: false,
    };
  });

  const carriedPlayerByRef = new Map(
    players.map(player => [playerKey(player), player])
  );

  let ball = source.ball ? cloneData(source.ball) : null;
  const finalPass = source.passes[source.passes.length - 1];
  if (finalPass?.style === 'kick' && finalPass.targetX !== undefined && finalPass.targetY !== undefined) {
    ball = { x: finalPass.targetX, y: finalPass.targetY };
  } else if (finalPass && finalPass.toT !== undefined && finalPass.toNum !== undefined) {
    const receiver = carriedPlayerByRef.get(playerKey({ team: finalPass.toT, num: finalPass.toNum }));
    if (receiver) {
      ball = { x: receiver.x, y: receiver.y };
    }
  }

  return normalizeStepState({
    players,
    ball,
    ballOwner: null,
    ballAttached: false,
    paths: [],
    passes: [],
    annotations: cloneData(source.annotations || []),
  }, players);
}

function phasePlaybackTargetIndex(startIdx = GamePlan.currentPhase) {
  return startIdx < GamePlan.phases.length - 1 ? startIdx + 1 : null;
}

function canonicalPlaybackTargetIndex(startIndex = getCurrentCanonicalMoveIndex()) {
  const moveCount = getCanonicalMoveCount();
  if (!Number.isInteger(startIndex) || startIndex < 0 || startIndex >= moveCount - 1) return null;
  return startIndex + 1;
}

function currentPhaseHasPlayablePlayback() {
  return canonicalPlaybackTargetIndex() !== null;
}

function projectHasPlayablePlayback() {
  return canonicalPlaybackTargetIndex() !== null;
}

function phasePlaybackStepAt(index) {
  const source = index === GamePlan.currentPhase
    ? serializePhase(S(), index)
    : GamePlan.phases[index];
  const normalizedPhase = normalizePhaseState(source, index);
  return cloneStepState(normalizedPhase.steps[normalizedPhase.currentStep] || emptyStepState());
}

function phaseStepCountAt(phaseIndex) {
  const phase = GamePlan.phases?.[phaseIndex];
  if (!phase) return 0;
  return Array.isArray(phase.steps) ? phase.steps.length : 0;
}

function getCanonicalMoveRefs() {
  const phases = Array.isArray(GamePlan.phases) ? GamePlan.phases : [];
  const refs = [];
  phases.forEach((phase, phaseIndex) => {
    const stepCount = Array.isArray(phase?.steps) ? phase.steps.length : 0;
    for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
      refs.push({ phaseIndex, stepIndex });
    }
  });
  return refs;
}

function getCanonicalMoveCount() {
  return getCanonicalMoveRefs().length;
}

function getCanonicalMoveRef(index) {
  const refs = getCanonicalMoveRefs();
  if (!refs.length) return null;
  if (!Number.isInteger(index) || index < 0 || index >= refs.length) return null;
  return refs[index] || null;
}

function getCurrentCanonicalMoveIndex() {
  const refs = getCanonicalMoveRefs();
  if (!refs.length) return -1;
  if (!Number.isInteger(GamePlan.currentPhase) || !Number.isInteger(S.currentStep)) return -1;
  const phases = Array.isArray(GamePlan.phases) ? GamePlan.phases : [];
  if (GamePlan.currentPhase < 0 || GamePlan.currentPhase >= phases.length) return -1;
  if (S.currentStep < 0 || S.currentStep >= phaseStepCountAt(GamePlan.currentPhase)) return -1;
  return refs.findIndex(ref => ref.phaseIndex === GamePlan.currentPhase && ref.stepIndex === S.currentStep);
}

function hasPreviousCanonicalMove() {
  const currentIndex = getCurrentCanonicalMoveIndex();
  return currentIndex > 0;
}

function hasNextCanonicalMove() {
  const currentIndex = getCurrentCanonicalMoveIndex();
  return currentIndex >= 0 && currentIndex < getCanonicalMoveCount() - 1;
}

function getCanonicalPhasePlaybackRange(moveIndex = getCurrentCanonicalMoveIndex()) {
  const ref = getCanonicalMoveRef(moveIndex);
  if (!ref) return null;
  const refs = getCanonicalMoveRefs();
  const firstIndex = refs.findIndex(r => r.phaseIndex === ref.phaseIndex);
  if (firstIndex < 0) return null;
  const moveCount = phaseStepCountAt(ref.phaseIndex);
  return {
    phaseIndex: ref.phaseIndex,
    firstIndex,
    lastIndex: firstIndex + moveCount - 1,
    moveCount,
  };
}

function clearPendingCanonicalPhaseStart() {
  if (!pendingCanonicalPhaseStart) return false;
  pendingCanonicalPhaseStart = false;
  return true;
}

function shouldKeepPendingCanonicalPhaseStart() {
  const currentIndex = getCurrentCanonicalMoveIndex();
  const moveCount = getCanonicalMoveCount();
  return pendingCanonicalPhaseStart && moveCount > 0 && currentIndex === moveCount - 1;
}

function syncPendingCanonicalPhaseStart() {
  if (!pendingCanonicalPhaseStart) return false;
  if (shouldKeepPendingCanonicalPhaseStart()) return false;
  pendingCanonicalPhaseStart = false;
  return true;
}

function getCanonicalPhaseStartContext() {
  syncPendingCanonicalPhaseStart();
  const currentRef = getCanonicalMoveRef(getCurrentCanonicalMoveIndex());
  if (!currentRef) return { kind: 'unavailable', currentRef: null, nextRef: null };
  const nextRef = getCanonicalMoveRef(getCurrentCanonicalMoveIndex() + 1);
  if (!nextRef) {
    return {
      kind: pendingCanonicalPhaseStart ? 'pending-final' : 'final-move',
      currentRef,
      nextRef: null,
    };
  }
  if (nextRef.phaseIndex !== currentRef.phaseIndex) {
    return { kind: 'existing-boundary', currentRef, nextRef };
  }
  return { kind: 'split-available', currentRef, nextRef };
}

function getCanonicalPhaseActionDetails() {
  const context = getCanonicalPhaseStartContext();
  if (context.kind === 'unavailable') {
    return {
      context,
      label: tr('dock.phaseAction.start'),
      note: '',
      ariaLabel: tr('dock.phaseAction.unavailable'),
      title: tr('dock.phaseAction.unavailableTitle'),
      pressed: false,
      disabled: true,
    };
  }
  if (context.kind === 'existing-boundary') {
    const currentMoveNumber = getCurrentCanonicalMoveIndex() + 1;
    return {
      context,
      label: tr('dock.phaseAction.removeBreak'),
      note: tr('dock.phaseAction.removeBreak.note', { move: currentMoveNumber }),
      ariaLabel: tr('dock.phaseAction.removeBreak.aria'),
      title: tr('dock.phaseAction.removeBreak.title'),
      pressed: false,
      disabled: false,
    };
  }
  if (context.kind === 'pending-final') {
    return {
      context,
      label: tr('dock.phaseAction.cancel'),
      note: tr('dock.phaseAction.cancel.note'),
      ariaLabel: tr('dock.phaseAction.cancel.aria'),
      title: tr('dock.phaseAction.cancel.title'),
      pressed: true,
      disabled: false,
    };
  }
  if (context.kind === 'final-move') {
    return {
      context,
      label: tr('dock.phaseAction.next'),
      note: '',
      ariaLabel: tr('dock.phaseAction.next.aria'),
      title: tr('dock.phaseAction.next.title'),
      pressed: false,
      disabled: false,
    };
  }
  return {
    context,
    label: tr('dock.phaseAction.start'),
    note: tr('dock.phaseAction.start.note', { phase: context.currentRef.phaseIndex + 2 }),
    ariaLabel: tr('dock.phaseAction.start.aria'),
    title: tr('dock.phaseAction.start.title'),
    pressed: false,
    disabled: false,
  };
}

function removeCanonicalPhaseBreakAfterCurrentMove() {
  const context = getCanonicalPhaseStartContext();
  if (context.kind !== 'existing-boundary') return false;
  snapshot();
  stopPlayback(true);
  clearPendingCanonicalPhaseStart();
  const currentPhaseIndex = context.currentRef.phaseIndex;
  const nextPhaseIndex = context.nextRef.phaseIndex;
  const currentPhase = normalizePhaseState(GamePlan.phases[currentPhaseIndex], currentPhaseIndex);
  const nextPhase = normalizePhaseState(GamePlan.phases[nextPhaseIndex], nextPhaseIndex);
  currentPhase.steps = [
    ...currentPhase.steps.map(step => cloneStepState(step)),
    ...nextPhase.steps.map(step => cloneStepState(step)),
  ];
  currentPhase.currentStep = clamp(context.currentRef.stepIndex, 0, currentPhase.steps.length - 1);
  GamePlan.phases[currentPhaseIndex] = normalizePhaseState(currentPhase, currentPhaseIndex);
  GamePlan.phases.splice(nextPhaseIndex, 1);
  relabelPhases();
  GamePlan.currentPhase = currentPhaseIndex;
  loadCurrentPhaseBoardState();
  setHint(`Phase ${nextPhaseIndex + 1} merged into Phase ${currentPhaseIndex + 1}.`);
  flashMobilePhaseCounter();
  render();
  return true;
}

function startCanonicalPhaseAfterCurrentMove() {
  const context = getCanonicalPhaseStartContext();
  if (context.kind === 'unavailable') return false;
  if (context.kind === 'existing-boundary') {
    return removeCanonicalPhaseBreakAfterCurrentMove();
  }
  if (context.kind === 'pending-final') {
    clearPendingCanonicalPhaseStart();
    setHint('Pending new phase cancelled. The next Move will stay in the current phase.');
    refreshInteractionUI();
    return true;
  }
  if (context.kind === 'final-move') {
    pendingCanonicalPhaseStart = true;
    setHint('The next added Move will start a new phase.');
    refreshInteractionUI();
    return true;
  }

  persistCurrentPhase();
  snapshot();
  const sourcePhase = normalizePhaseState(serializePhase(S(), GamePlan.currentPhase), GamePlan.currentPhase);
  const splitAfterStepIndex = context.currentRef.stepIndex;
  const currentSteps = Array.isArray(sourcePhase.steps) ? sourcePhase.steps : [];
  const leadingSteps = currentSteps.slice(0, splitAfterStepIndex + 1);
  const trailingSteps = currentSteps.slice(splitAfterStepIndex + 1);
  if (!trailingSteps.length) {
    pendingCanonicalPhaseStart = true;
    setHint('The next added Move will start a new phase.');
    refreshInteractionUI();
    return true;
  }

  sourcePhase.steps = leadingSteps;
  sourcePhase.currentStep = clamp(splitAfterStepIndex, 0, Math.max(0, leadingSteps.length - 1));
  const currentPhaseIndex = context.currentRef.phaseIndex;
  GamePlan.phases[currentPhaseIndex] = normalizePhaseState(sourcePhase, currentPhaseIndex);

  const nextPhaseIndex = currentPhaseIndex + 1;
  const nextPhase = normalizePhaseState({
    id: crypto.randomUUID(),
    label: `Phase ${nextPhaseIndex + 1}`,
    notes: '',
    groups: cloneData(sourcePhase.groups || []),
    steps: trailingSteps,
    currentStep: 0,
  }, nextPhaseIndex);
  GamePlan.phases.splice(nextPhaseIndex, 0, nextPhase);
  relabelPhases();
  GamePlan.currentPhase = currentPhaseIndex;
  loadCurrentPhaseBoardState();
  setHint(`New phase starts at Move ${getCurrentCanonicalMoveIndex() + 2}.`);
  flashMobilePhaseCounter();
  render();
  return true;
}

function deleteCanonicalMove(index = getCurrentCanonicalMoveIndex()) {
  syncPendingCanonicalPhaseStart();
  const moveCount = getCanonicalMoveCount();
  if (moveCount <= 1) {
    setHint('A play must contain at least one Move.');
    refreshInteractionUI();
    return false;
  }
  const targetRef = getCanonicalMoveRef(index);
  if (!targetRef) return false;

  snapshot();
  stopPlayback(true);
  clearPendingCanonicalPhaseStart();

  const targetPhaseIndex = targetRef.phaseIndex;
  const targetPhase = normalizePhaseState(GamePlan.phases[targetPhaseIndex], targetPhaseIndex);
  const targetSteps = Array.isArray(targetPhase.steps) ? targetPhase.steps.map(step => cloneStepState(step)) : [];
  if (targetRef.stepIndex < 0 || targetRef.stepIndex >= targetSteps.length) return false;
  targetSteps.splice(targetRef.stepIndex, 1);

  const removedGroupNumber = targetSteps.length ? null : targetPhaseIndex + 1;
  if (targetSteps.length) {
    targetPhase.steps = targetSteps;
    targetPhase.currentStep = clamp(targetRef.stepIndex, 0, targetSteps.length - 1);
    GamePlan.phases[targetPhaseIndex] = normalizePhaseState(targetPhase, targetPhaseIndex);
  } else {
    GamePlan.phases.splice(targetPhaseIndex, 1);
  }

  relabelPhases();
  const remainingMoveCount = getCanonicalMoveCount();
  const nextIndex = Math.min(index, remainingMoveCount - 1);
  const nextRef = getCanonicalMoveRef(nextIndex);
  if (!nextRef) return false;

  const nextPhase = normalizePhaseState(GamePlan.phases[nextRef.phaseIndex], nextRef.phaseIndex);
  nextPhase.currentStep = clamp(nextRef.stepIndex, 0, nextPhase.steps.length - 1);
  GamePlan.phases[nextRef.phaseIndex] = normalizePhaseState(nextPhase, nextRef.phaseIndex);
  GamePlan.currentPhase = nextRef.phaseIndex;
  loadCurrentPhaseBoardState();
  setHint(removedGroupNumber
    ? `Move ${index + 1} removed. Phase ${removedGroupNumber} also removed.`
    : `Move ${index + 1} removed. Now viewing Move ${nextIndex + 1}.`);
  flashMobilePhaseCounter();
  render();
  return true;
}

function goToCanonicalMove(index, options = {}) {
  syncPendingCanonicalPhaseStart();
  const targetRef = getCanonicalMoveRef(index);
  if (!targetRef) return false;
  const targetStepCount = phaseStepCountAt(targetRef.phaseIndex);
  if (targetStepCount <= 0 || targetRef.stepIndex < 0 || targetRef.stepIndex >= targetStepCount) return false;
  const samePhase = targetRef.phaseIndex === GamePlan.currentPhase;
  const targetStepIndex = targetRef.stepIndex;

  if (samePhase) {
    if (targetStepIndex === S.currentStep) return true;
    gotoStep(targetStepIndex, options);
    return true;
  }

  if (options.snapshotBefore) snapshot();
  goToPhase(targetRef.phaseIndex);
  if (S.currentStep !== targetStepIndex) {
    gotoStep(targetStepIndex, { ...options, snapshotBefore: false });
  }
  return true;
}

function getCanonicalMoveDisplay() {
  const count = getCanonicalMoveCount();
  const index = getCurrentCanonicalMoveIndex();
  return {
    count,
    index,
    current: index >= 0 ? index + 1 : null,
    hasSelection: index >= 0,
  };
}

function goToPreviousCanonicalMove(options = {}) {
  const currentIndex = getCurrentCanonicalMoveIndex();
  if (currentIndex <= 0) return false;
  return goToCanonicalMove(currentIndex - 1, options);
}

function goToNextCanonicalMove(options = {}) {
  const currentIndex = getCurrentCanonicalMoveIndex();
  if (currentIndex < 0) return false;
  return goToCanonicalMove(currentIndex + 1, options);
}

function addCanonicalMove() {
  syncPendingCanonicalPhaseStart();
  if (pendingCanonicalPhaseStart) {
    pendingCanonicalPhaseStart = false;
    return addPhase();
  }
  return addStep();
}

function phasePathForPlayer(step, player) {
  const key = playerKey(player);
  return step.paths.find(path => playerKey({ team: path.team, num: path.num }) === key) || null;
}

function emptyPlayMetadata(title = '') {
  return {
    title: title || '',
    purpose: '',
    coachingPoints: [],
    decisionCue: '',
    commonMistakes: [],
  };
}

function normalizeTextList(list, maxItems) {
  const items = Array.isArray(list) ? list : [];
  return items
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeProjectMetadata(project = {}, metadata = {}) {
  const stamp = nowIso();
  return {
    title: String(metadata.title || project.name || '').trim(),
    purpose: String(metadata.purpose || '').trim(),
    coachingPoints: normalizeTextList(metadata.coachingPoints, 3),
    decisionCue: String(metadata.decisionCue || '').trim(),
    commonMistakes: normalizeTextList(metadata.commonMistakes, 3),
    createdAt: metadata.createdAt || project.createdAt || project.savedAt || stamp,
    updatedAt: metadata.updatedAt || project.updatedAt || project.savedAt || stamp,
    source: metadata.source || project.source || 'animator',
  };
}

function annotationSelection(id) {
  return `ann:${id}`;
}

function selectedAnnotationId() {
  return S.selectedAnnotationIdValue || null;
}

function groupMembers(group) {
  if (!group) return [];
  return group.playerRefs
    .map(ref => S.players.find(player => playerMatchesRef(player, ref)) || null)
    .filter(Boolean);
}

function clearPendingGroupPlacement() {
  S.pendingGroupPlacement = null;
  S.draggingPendingGroup = false;
}

function buildGroupPlacementState(group, anchorPlayerId = null) {
  const members = groupMembers(group);
  if (!members.length) return null;
  const center = members.reduce((acc, member) => ({
    x: acc.x + member.x,
    y: acc.y + member.y,
  }), { x: 0, y: 0 });
  center.x /= members.length;
  center.y /= members.length;
  return {
    id: group.id,
    anchorPlayerId,
    center,
    startPositions: members.map(member => ({ id: member.id, x: member.x, y: member.y })),
    startBall: S.ball ? { x: S.ball.x, y: S.ball.y } : null,
    anchorStart: null,
    lastFp: null,
  };
}

function movePendingGroupTo(pending, fp) {
  if (!pending?.startPositions?.length || !fp) return;
  const members = pending.startPositions
    .map(member => {
      const pl = S.players.find(player => player.id === member.id);
      return pl ? { live: pl, start: member } : null;
    })
    .filter(Boolean);
  if (!members.length) return;
  if (!pending.anchorStart) pending.anchorStart = { x: fp.x, y: fp.y };
  if (!pending.lastFp) {
    pending.lastFp = { x: fp.x, y: fp.y };
    return;
  }
  const dxRaw = fp.x - pending.lastFp.x;
  const dyRaw = fp.y - pending.lastFp.y;
  const dxMin = Math.max(...members.map(({ live }) => F.XMIN - live.x));
  const dxMax = Math.min(...members.map(({ live }) => F.XMAX - live.x));
  const dyMin = Math.max(...members.map(({ live }) => F.YMIN - live.y));
  const dyMax = Math.min(...members.map(({ live }) => F.YMAX - live.y));
  const dx = clamp(dxRaw, dxMin, dxMax);
  const dy = clamp(dyRaw, dyMin, dyMax);
  members.forEach(({ live }) => {
    live.x += dx;
    live.y += dy;
    const path = S.paths.find(pathItem => pathItem.pid === live.id);
    if (path && path.pts.length) translatePathPoints(path, dx, dy);
    if (live.isBC && S.ball) {
      if (S.ballAttached && samePlayerRef(playerRef(live), S.ballOwner)) {
        S.ball = attachedBallPositionForPlayer(live);
      } else if (pending.startBall) {
        S.ball.x = clamp(S.ball.x + dx, F.XMIN, F.XMAX);
        S.ball.y = clamp(S.ball.y + dy, F.YMIN, F.YMAX);
      }
      updateGainDisplayForY(live.y);
    }
  });
  pending.lastFp = { x: fp.x, y: fp.y };
}

function placeGroupAtPoint(placement, point) {
  if (!placement?.startPositions?.length) return false;
  const members = placement.startPositions
    .map(start => {
      const live = S.players.find(player => player.id === start.id);
      return live ? { live, start } : null;
    })
    .filter(Boolean);
  if (!members.length) return false;
  const dxRaw = point.x - placement.center.x;
  const dyRaw = point.y - placement.center.y;
  const dxMin = Math.max(...members.map(({ start }) => F.XMIN - start.x));
  const dxMax = Math.min(...members.map(({ start }) => F.XMAX - start.x));
  const dyMin = Math.max(...members.map(({ start }) => F.YMIN - start.y));
  const dyMax = Math.min(...members.map(({ start }) => F.YMAX - start.y));
  const dx = clamp(dxRaw, dxMin, dxMax);
  const dy = clamp(dyRaw, dyMin, dyMax);
  members.forEach(({ live, start }) => {
    const prevX = live.x;
    const prevY = live.y;
    live.x = start.x + dx;
    live.y = start.y + dy;
    const path = S.paths.find(pathItem => pathItem.pid === live.id);
    if (path && path.pts.length) translatePathPoints(path, live.x - prevX, live.y - prevY);
    if (live.isBC && S.ball) {
      if (S.ballAttached && samePlayerRef(playerRef(live), S.ballOwner)) {
        S.ball = attachedBallPositionForPlayer(live);
      } else if (placement.startBall) {
        S.ball.x = placement.startBall.x + dx;
        S.ball.y = placement.startBall.y + dy;
      }
      updateGainDisplayForY(live.y);
    }
  });
  return true;
}

function groupForPlayer(player) {
  if (!player) return null;
  return (S.groups || []).find(group => group.playerRefs.some(ref => playerMatchesRef(player, ref))) || null;
}

function activeGroupForPlayer(player) {
  const group = groupForPlayer(player);
  return group?.active ? group : null;
}

function selectedGroup() {
  return (S.groups || []).find(group => group.id === S.selectedGroupId) || null;
}

function playerUsesSelectedGroup(player) {
  const group = selectedGroup();
  return !!group && group.playerRefs.some(ref => playerMatchesRef(player, ref));
}

function clearSelectedGroup() {
  S.selectedGroupId = null;
}

function syncLegacySelectionState() {
  if (S.selectedPlayerId !== null) S.selected = S.selectedPlayerId;
  else if (S.selectedObjectType === 'ball') S.selected = '__ball__';
  else if (S.selectedObjectType === 'annotation' && S.selectedAnnotationIdValue) S.selected = annotationSelection(S.selectedAnnotationIdValue);
  else S.selected = null;
  S.passFrom = null;
}

function clearHighlightedPlayers() {
  S.highlightedPlayerIds = [];
}

function clearPassKickState() {
  S.activePasserId = null;
  S.activeKickerId = null;
  clearHighlightedPlayers();
  syncLegacySelectionState();
}

function clearArmedRunState() {
  S.activeRunSourceId = null;
  clearHighlightedPlayers();
  syncLegacySelectionState();
}

function returnInteractionToMoveTool() {
  S.tool = 'move';
  document.querySelectorAll('[data-tool]').forEach(button => {
    button.classList.toggle('active', button.dataset.tool === 'move');
  });
  cv.style.cursor = 'default';
  setHint(HINTS.move || '');
}

function cancelArmedKick() {
  if (!S.activeKickerId) return false;
  clearPassKickState();
  clearSelectedObject();
  clearDragPlayer();
  S.pointerTap = null;
  returnInteractionToMoveTool();
  refreshInteractionUI();
  render();
  return true;
}

function cancelArmedRun() {
  if (!S.activeRunSourceId) return false;
  clearArmedRunState();
  clearSelectedObject();
  clearDragPlayer();
  S.drawing = null;
  S.pointerTap = null;
  returnInteractionToMoveTool();
  refreshInteractionUI();
  render();
  return true;
}

function activeWorkflowPlayerId() {
  return S.activeKickerId || S.activePasserId || null;
}

function clearSelectedObject() {
  S.selectedPlayerId = null;
  S.selectedPlayerIds = [];
  clearSelectedGroup();
  clearPendingGroupPlacement();
  S.selectedAnnotationIdValue = null;
  S.selectedObjectType = null;
  syncLegacySelectionState();
}

function selectGroup(id) {
  S.selectedPlayerId = null;
  S.selectedPlayerIds = [];
  S.selectedGroupId = id;
  S.selectedAnnotationIdValue = null;
  S.selectedObjectType = null;
  S.selectedPassIdx = null;
  S.selectedPathPid = null;
  clearHighlightedPlayers();
  syncLegacySelectionState();
}

function selectPlayer(id, { highlightedIds = [] } = {}) {
  // Player selection is exclusive: selecting a player clears other object/path selections
  // so later actions always resolve from this one player id.
  S.selectedPlayerId = id;
  S.selectedPlayerIds = id !== null ? [id] : [];
  clearSelectedGroup();
  clearPendingGroupPlacement();
  S.selectedAnnotationIdValue = null;
  S.selectedObjectType = 'player';
  S.selectedPassIdx = null;
  S.selectedPathPid = null;
  S.ballAssignCandidate = id;
  S.highlightedPlayerIds = Array.isArray(highlightedIds) ? [...highlightedIds] : [];
  syncLegacySelectionState();
  // Covers select, drag-start (selectPlayer runs at the top of a player
  // drag) and add-player (addPlayerByNum selects the new player) in one
  // hook - all three are "return to editing view" triggers.
  if (id !== null) mobileAutoReturnFromFitFullPitch();
}

function selectedPlayers() {
  const ids = Array.isArray(S.selectedPlayerIds) && S.selectedPlayerIds.length
    ? S.selectedPlayerIds
    : (S.selectedPlayerId !== null ? [S.selectedPlayerId] : []);
  return ids
    .map(id => S.players.find(player => player.id === id) || null)
    .filter(Boolean);
}

function togglePlayerSelection(id) {
  const ids = new Set(Array.isArray(S.selectedPlayerIds) ? S.selectedPlayerIds : []);
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  const nextIds = Array.from(ids);
  S.selectedPlayerIds = nextIds;
  S.selectedPlayerId = nextIds.length ? nextIds[nextIds.length - 1] : null;
  clearSelectedGroup();
  clearPendingGroupPlacement();
  S.selectedAnnotationIdValue = null;
  S.selectedObjectType = nextIds.length ? 'player' : null;
  S.selectedPassIdx = null;
  S.selectedPathPid = null;
  S.ballAssignCandidate = nextIds.length === 1 ? nextIds[0] : null;
  clearHighlightedPlayers();
  syncLegacySelectionState();
}

function setDragPlayer(id) {
  S.dragPlayerId = id;
}

function clearDragPlayer() {
  S.dragPlayerId = null;
}

function selectBall(candidateId = null) {
  S.selectedPlayerId = null;
  S.selectedPlayerIds = [];
  clearSelectedGroup();
  clearPendingGroupPlacement();
  S.selectedAnnotationIdValue = null;
  S.selectedObjectType = 'ball';
  S.selectedPassIdx = null;
  S.selectedPathPid = null;
  clearHighlightedPlayers();
  S.ballAssignCandidate = candidateId;
  syncLegacySelectionState();
}

function selectAnnotationById(id) {
  if (noteInlineEditorState && noteInlineEditorState.id !== id) endNoteInlineEdit();
  S.selectedPlayerId = null;
  S.selectedPlayerIds = [];
  clearSelectedGroup();
  clearPendingGroupPlacement();
  S.selectedAnnotationIdValue = id;
  S.selectedObjectType = 'annotation';
  S.selectedPassIdx = null;
  S.selectedPathPid = null;
  clearHighlightedPlayers();
  const annotation = findAnnotationById(id);
  if (annotation?.type === 'arrow') {
    S.arrowColor = annotation.color || ARROW_DEFAULT_COLOR;
    S.arrowThickness = arrowThicknessValue(annotation.thickness);
    S.arrowDash = arrowDashValue(annotation.dash);
  } else if (isShapeAnnotationType(annotation?.type)) {
    const keys = shapeStyleStateKeys(annotation.type);
    S[keys.color] = annotation.color || defaultShapeStyle(annotation.type).color;
    S[keys.thickness] = arrowThicknessValue(annotation.thickness);
    S[keys.dash] = arrowDashValue(annotation.dash);
  }
  syncLegacySelectionState();
}

function isBallSelected() {
  return S.selectedObjectType === 'ball';
}

function isPlayerSelected(id) {
  return (Array.isArray(S.selectedPlayerIds) && S.selectedPlayerIds.includes(id))
    || S.selectedPlayerId === id
    || playerUsesSelectedGroup(S.players.find(player => player.id === id));
}

function setWorkflowSource(id, tool = S.tool) {
  if (tool === 'kick') {
    S.activeKickerId = id;
    S.activePasserId = null;
  } else {
    S.activePasserId = id;
    S.activeKickerId = null;
  }
  S.activeRunSourceId = null;
  S.highlightedPlayerIds = id ? [id] : [];
  syncLegacySelectionState();
}

function setArmedRunSource(id) {
  S.activeRunSourceId = id;
  S.activePasserId = null;
  S.activeKickerId = null;
  S.highlightedPlayerIds = id ? [id] : [];
  syncLegacySelectionState();
}

function regroupSelectedPack() {
  const targetPlayer = S.selectedPlayerId !== null
    ? S.players.find(player => player.id === S.selectedPlayerId)
    : null;
  const group = selectedGroup() || groupForPlayer(targetPlayer);
  if (!group) return;
  group.active = true;
  selectGroup(group.id);
  setHint(`${group.label} regrouped. Click the pack, then click again to place it.`);
  refreshInteractionUI();
  render();
}

function editSelectedPackIndividuals() {
  const group = selectedGroup();
  if (!group) return;
  group.active = false;
  const leadPlayer = groupMembers(group)[0] || null;
  if (leadPlayer) selectPlayer(leadPlayer.id);
  else clearSelection();
  setHint(`${group.label} unlocked. Players can now be edited individually.`);
  refreshInteractionUI();
  render();
}

function selectedColorTarget() {
  const players = selectedPlayers();
  if (players.length > 1) return players;
  if (players.length === 1) {
    return players[0];
  }
  return selectedGroup();
}

function setSelectedUnitColor(color) {
  const target = selectedColorTarget();
  if (!target) return;
  if (Array.isArray(target)) {
    target.forEach(player => { player.colorOverride = color; });
    setHint(`${target.length} player colors updated.`);
  } else if (S.selectedPlayerId !== null) {
    target.colorOverride = color;
    setHint('Player color updated.');
  } else if (S.selectedGroupId) {
    target.color = color;
    setHint(`${target.label} color updated.`);
  }
  persistCurrentStep();
  refreshInteractionUI();
  render();
}

function findAnnotationById(id) {
  return S.annotations.find(item => item.id === id) || null;
}

function selectedAnnotation() {
  const id = selectedAnnotationId();
  return id ? findAnnotationById(id) : null;
}

function annotationEditableTarget(target) {
  return !!target && (
    target.tagName === 'INPUT'
    || target.tagName === 'TEXTAREA'
    || target.isContentEditable
  );
}

function defaultAnnotationText() {
  const input = document.getElementById('annotationText');
  const txt = input?.value?.trim();
  return txt || ANNOTATION_NOTE_DEFAULT;
}

function annotationColor(type) {
  if (type === 'zone') return '#10b981';
  if (type === 'box') return '#d9b46c';
  if (type === 'ellipse') return '#d9b46c';
  if (type === 'arrow') return '#d9b46c';
  return '#f3f4f6';
}

function currentArrowStyleSelection() {
  const selected = selectedAnnotation();
  if (selected?.type === 'arrow') {
    return {
      color: selected.color || ARROW_DEFAULT_COLOR,
      thickness: arrowThicknessValue(selected.thickness),
      dash: arrowDashValue(selected.dash),
    };
  }
  return {
    color: S.arrowColor || ARROW_DEFAULT_COLOR,
    thickness: arrowThicknessValue(S.arrowThickness),
    dash: arrowDashValue(S.arrowDash),
  };
}

function applyArrowStyleSelection(partial = {}) {
  const selectedId = selectedAnnotationId();
  const hasSelectedArrow = selectedAnnotation()?.type === 'arrow';
  const current = currentArrowStyleSelection();
  const next = {
    color: partial.color || current.color || ARROW_DEFAULT_COLOR,
    thickness: arrowThicknessValue(partial.thickness ?? current.thickness),
    dash: arrowDashValue(partial.dash ?? current.dash),
  };
  S.arrowColor = next.color;
  S.arrowThickness = next.thickness;
  S.arrowDash = next.dash;
  if (hasSelectedArrow && selectedId) {
    snapshot();
    const ann = findAnnotationById(selectedId);
    if (ann?.type === 'arrow') {
      ann.color = next.color;
      ann.thickness = next.thickness;
      ann.dash = next.dash;
    }
  }
  if (!hasSelectedArrow) {
    refreshInteractionUI();
    render();
    return next;
  }
  refreshInteractionUI();
  render();
  return next;
}

function noteScaleValue(note) {
  const scale = Number(note?.scale);
  return Number.isFinite(scale) ? clamp(scale, NOTE_LEGACY_SCALE_MIN, NOTE_LEGACY_SCALE_MAX) : 1;
}

function noteLegacyDimensions(note) {
  const scale = noteScaleValue(note);
  const text = String(note?.text || ANNOTATION_NOTE_DEFAULT);
  ctx.save();
  ctx.font = `700 ${NOTE_LEGACY_FONT_PX}px ${NOTE_FONT}`;
  const baseTextWidth = ctx.measureText(text).width;
  ctx.restore();
  const widthPx = Math.max(52 * scale, (baseTextWidth + 18) * scale);
  const heightPx = (NOTE_LEGACY_FONT_PX + 12) * scale;
  return {
    width: clamp(widthPx / NOTE_LEGACY_REFERENCE_SCALE, NOTE_MIN_WIDTH, NOTE_MAX_WIDTH),
    height: clamp(heightPx / NOTE_LEGACY_REFERENCE_SCALE, NOTE_MIN_HEIGHT, NOTE_MAX_HEIGHT),
  };
}

function noteWidthValue(note) {
  const width = Number(note?.width);
  if (Number.isFinite(width)) return clamp(width, NOTE_MIN_WIDTH, NOTE_MAX_WIDTH);
  if (Number.isFinite(Number(note?.scale))) {
    const legacy = noteLegacyDimensions(note);
    return Number.isFinite(legacy.width) ? legacy.width : NOTE_DEFAULT_WIDTH;
  }
  return NOTE_DEFAULT_WIDTH;
}

function noteHeightValue(note) {
  const height = Number(note?.height);
  if (Number.isFinite(height)) return clamp(height, NOTE_MIN_HEIGHT, NOTE_MAX_HEIGHT);
  if (Number.isFinite(Number(note?.scale))) {
    const legacy = noteLegacyDimensions(note);
    return Number.isFinite(legacy.height) ? legacy.height : NOTE_DEFAULT_HEIGHT;
  }
  return NOTE_DEFAULT_HEIGHT;
}

function noteDimensions(note) {
  return {
    width: noteWidthValue(note),
    height: noteHeightValue(note),
  };
}

function noteAlignValue(note) {
  return note?.align === 'center' || note?.align === 'right' ? note.align : 'left';
}

function normalizeAnnotation(annotation) {
  if (!annotation || typeof annotation !== 'object' || !annotation.type) return null;
  const base = {
    id: annotation.id || mkAnnotationId(),
    type: annotation.type,
    color: annotation.color || annotationColor(annotation.type),
    opacity: Number(annotation.opacity) || 1,
  };
  if (annotation.type === 'note') {
    const x = Number(annotation.x), y = Number(annotation.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return {
      ...base,
      x,
      y,
      text: String(annotation.text ?? ANNOTATION_NOTE_DEFAULT).slice(0, 160),
      align: noteAlignValue(annotation),
      width: noteWidthValue(annotation),
      height: noteHeightValue(annotation),
    };
  }
  if (annotation.type === 'arrow') {
    const start = annotation.start || {};
    const end = annotation.end || {};
    const sx = Number(start.x), sy = Number(start.y), ex = Number(end.x), ey = Number(end.y);
    if (![sx, sy, ex, ey].every(Number.isFinite)) return null;
    return {
      ...base,
      start: { x: sx, y: sy },
      end: { x: ex, y: ey },
      color: annotation.color || annotationColor('arrow'),
      thickness: arrowThicknessValue(annotation.thickness),
      dash: arrowDashValue(annotation.dash),
    };
  }
  if (annotation.type === 'zone') {
    const x = Number(annotation.x), y = Number(annotation.y), r = Number(annotation.r);
    if (![x, y, r].every(Number.isFinite)) return null;
    return {
      ...base,
      x,
      y,
      r: Math.max(1.5, r),
      color: annotation.color || annotationColor('zone'),
      thickness: arrowThicknessValue(annotation.thickness),
      dash: arrowDashValue(annotation.dash),
    };
  }
  if (annotation.type === 'circle') {
    const x = Number(annotation.x);
    const y = Number(annotation.y);
    const r = Number(annotation.r);
    if (![x, y, r].every(Number.isFinite)) return null;
    return {
      ...base,
      type: 'ellipse',
      x: x - Math.max(1.5, r),
      y: y - Math.max(1.5, r),
      w: Math.max(3, Math.abs(r) * 2),
      h: Math.max(3, Math.abs(r) * 2),
      rotation: normalizeShapeRotation(annotation.rotation),
      color: annotation.color || annotationColor('zone'),
      thickness: arrowThicknessValue(annotation.thickness),
      dash: arrowDashValue(annotation.dash),
    };
  }
  if (annotation.type === 'box') {
    const x = Number(annotation.x);
    const y = Number(annotation.y);
    const w = Number(annotation.w);
    const h = Number(annotation.h);
    if (![x, y, w, h].every(Number.isFinite)) return null;
    return {
      ...base,
      x,
      y,
      w: Math.max(1.5, Math.abs(w)),
      h: Math.max(1.5, Math.abs(h)),
      rotation: normalizeShapeRotation(annotation.rotation),
      color: annotation.color || annotationColor('box'),
      thickness: arrowThicknessValue(annotation.thickness),
      dash: arrowDashValue(annotation.dash),
    };
  }
  if (annotation.type === 'ellipse') {
    const x = Number(annotation.x);
    const y = Number(annotation.y);
    const w = Number(annotation.w);
    const h = Number(annotation.h);
    if (![x, y, w, h].every(Number.isFinite)) return null;
    return {
      ...base,
      x,
      y,
      w: Math.max(1.5, Math.abs(w)),
      h: Math.max(1.5, Math.abs(h)),
      rotation: normalizeShapeRotation(annotation.rotation),
      color: annotation.color || annotationColor('ellipse'),
      thickness: arrowThicknessValue(annotation.thickness),
      dash: arrowDashValue(annotation.dash),
    };
  }
  return null;
}

function applyBallOwnershipVisualState() {
  S.players.forEach(pl => {
    pl.isBC = samePlayerRef(playerRef(pl), S.ballOwner);
  });
}

function attachedBallPositionForPlayer(pl) {
  return {
    x: clamp(pl.x + BALL_CARRY_OFFSET.x, -2, 70),
    y: clamp(pl.y + BALL_CARRY_OFFSET.y, -11, 111),
  };
}

function syncAttachedBallToOwner() {
  if (!S.ballAttached || !S.ballOwner) return false;
  const owner = findPlayerByRef(S.ballOwner);
  if (!owner) {
    S.ballAttached = false;
    applyBallOwnershipVisualState();
    return false;
  }
  S.ball = attachedBallPositionForPlayer(owner);
  applyBallOwnershipVisualState();
  return true;
}

function manualBallAssignmentTarget() {
  if (selectedPlayers().length > 1) return null;
  if (S.selectedPlayerId !== null) {
    return S.players.find(p => p.id === S.selectedPlayerId) || null;
  }
  if (isBallSelected() && S.ballAssignCandidate) {
    return S.players.find(p => p.id === S.ballAssignCandidate) || null;
  }
  return null;
}

function assignBallToPlayer(player, { snapshotBefore = false, source = 'manual' } = {}) {
  if (!player) return false;
  if (snapshotBefore) snapshot();
  if (!S.ball) S.ball = { x: 34, y: 50 };
  S.ballOwner = playerRef(player);
  S.ballAttached = true;
  S.ballAssignCandidate = player.id;
  syncAttachedBallToOwner();
  selectPlayer(player.id);
  completeFirstUseTutorial();
  const prefix = source === 'place' ? 'Ball placed with' : 'Ball given to';
  setHint(`${prefix} ${player.team === 'A' ? 'Attack' : 'Defence'} #${player.num}.`);
  refreshInteractionUI();
  render();
  return true;
}

function giveBallToSelectedPlayer() {
  const player = manualBallAssignmentTarget();
  if (!player) return;
  assignBallToPlayer(player, { snapshotBefore: true, source: 'manual' });
}

window.giveBallToSelectedPlayer = giveBallToSelectedPlayer;

function giveBall(playerId) {
  snapshot();
  const target = S.players.find(pl => pl.id === playerId);
  if (target) {
    S.ball = { x: target.x, y: target.y };
    S.ballOwner = playerRef(target);
    S.ballAttached = false;
    applyBallOwnershipVisualState();
    selectPlayer(target.id);
    setTool('move');
  }
  render();
}
window.giveBall = giveBall;

const PRESET_GROUP_ATTACK = '#2563eb';
const PRESET_GROUP_DEFENCE = '#dc2626';

function makeGroup(id, label, team, nums, color, type = 'pack') {
  return {
    id,
    label,
    type,
    team,
    active: true,
    color,
    playerRefs: nums.map(num => ({ num, team })),
  };
}

function scrumPack(team, yBase, midX = 34) {
  return [
    { num: 1, team, x: midX - 2.2, y: yBase },
    { num: 2, team, x: midX, y: yBase },
    { num: 3, team, x: midX + 2.2, y: yBase },
    { num: 4, team, x: midX - 1.1, y: yBase + 1.8 },
    { num: 5, team, x: midX + 1.1, y: yBase + 1.8 },
    { num: 6, team, x: midX - 3.7, y: yBase + 3.4 },
    { num: 7, team, x: midX + 3.7, y: yBase + 3.4 },
    { num: 8, team, x: midX, y: yBase + 4.8 },
  ];
}

function scrumBacks(side = 'centre', team = 'A', yBase = 60) {
  if (side === 'left') {
    return [
      { num: 9, team, x: 24.5, y: yBase },
      { num: 10, team, x: 27.5, y: yBase + 8 },
      { num: 11, team, x: 8.5, y: yBase + 9 },
      { num: 12, team, x: 32, y: yBase + 10 },
      { num: 13, team, x: 40.5, y: yBase + 11.5 },
      { num: 14, team, x: 58, y: yBase + 15 },
      { num: 15, team, x: 46.5, y: yBase + 20.5 },
    ];
  }
  if (side === 'right') {
    return [
      { num: 9, team, x: 56.5, y: yBase },
      { num: 10, team, x: 40.5, y: yBase + 10.5 },
      { num: 11, team, x: 2, y: yBase + 16.5 },
      { num: 12, team, x: 32.5, y: yBase + 15.5 },
      { num: 13, team, x: 21.5, y: yBase + 17 },
      { num: 14, team, x: 66, y: yBase + 15 },
      { num: 15, team, x: 20.5, y: yBase + 33 },
    ];
  }
  return [
    { num: 9, team, x: 41, y: yBase },
    { num: 10, team, x: 34, y: yBase + 7 },
    { num: 11, team, x: 10, y: yBase + 11 },
    { num: 12, team, x: 42, y: yBase + 9 },
    { num: 13, team, x: 50, y: yBase + 11 },
    { num: 14, team, x: 60, y: yBase + 11 },
    { num: 15, team, x: 34, y: yBase + 20 },
  ];
}

function scrumDefence(anchorX = 34, yBase = 42) {
  return [
    ...scrumPack('D', yBase, anchorX),
    { num: 9, team: 'D', x: anchorX + 1.8, y: yBase + 5.8 },
    { num: 10, team: 'D', x: anchorX - 6, y: yBase + 7.8 },
    { num: 11, team: 'D', x: anchorX - 16, y: yBase + 9.5 },
    { num: 12, team: 'D', x: anchorX + 7.5, y: yBase + 8.4 },
    { num: 13, team: 'D', x: anchorX + 16.5, y: yBase + 10.2 },
    { num: 14, team: 'D', x: anchorX + 26, y: yBase + 11.2 },
    { num: 15, team: 'D', x: anchorX + 9, y: yBase + 18 },
  ];
}

function lineoutChain(team, count, xStart, yBase) {
  const nums = count === 5 ? [1, 2, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7];
  return nums.map((num, index) => ({ num, team, x: xStart + index * 4, y: yBase }));
}

function attackLineoutSupport(yBase = 84) {
  return [
    { num: 8, team: 'A', x: 34, y: yBase + 4 },
    { num: 9, team: 'A', x: 42, y: yBase + 1 },
    { num: 10, team: 'A', x: 48, y: yBase - 1 },
    { num: 11, team: 'A', x: 20, y: yBase + 2 },
    { num: 12, team: 'A', x: 54, y: yBase + 2 },
    { num: 13, team: 'A', x: 60, y: yBase + 4 },
    { num: 14, team: 'A', x: 64, y: yBase + 1 },
    { num: 15, team: 'A', x: 34, y: yBase + 10 },
  ];
}

function defenceLineoutSupport(yBase = 80) {
  return [
    { num: 8, team: 'D', x: 34, y: yBase - 5 },
    { num: 9, team: 'D', x: 42, y: yBase - 2 },
    { num: 10, team: 'D', x: 48, y: yBase - 1 },
    { num: 11, team: 'D', x: 18, y: yBase - 1 },
    { num: 12, team: 'D', x: 54, y: yBase },
    { num: 13, team: 'D', x: 60, y: yBase + 1 },
    { num: 14, team: 'D', x: 66, y: yBase - 1 },
    { num: 15, team: 'D', x: 34, y: yBase - 10 },
  ];
}

function kickoffReceivePlayers() {
  return [
    { num: 15, team: 'A', x: 34, y: 22 },
    { num: 11, team: 'A', x: 16, y: 29 },
    { num: 14, team: 'A', x: 52, y: 29 },
    { num: 10, team: 'A', x: 26, y: 34 },
    { num: 12, team: 'A', x: 42, y: 34 },
    { num: 13, team: 'A', x: 50, y: 38 },
    { num: 9, team: 'A', x: 34, y: 38 },
    { num: 1, team: 'A', x: 28, y: 26 },
    { num: 2, team: 'A', x: 32, y: 27 },
    { num: 3, team: 'A', x: 36, y: 26 },
    { num: 4, team: 'A', x: 30, y: 30 },
    { num: 5, team: 'A', x: 34, y: 31 },
    { num: 6, team: 'A', x: 26, y: 33 },
    { num: 7, team: 'A', x: 38, y: 33 },
    { num: 8, team: 'A', x: 34, y: 35 },
    { num: 10, team: 'D', x: 28, y: 8 },
    { num: 12, team: 'D', x: 40, y: 8 },
    { num: 15, team: 'D', x: 34, y: 6 },
  ];
}

function kickoffChasePlayers() {
  return [
    { num: 10, team: 'A', x: 34.2, y: 51.5 },
    { num: 11, team: 'A', x: 3.5, y: 57.2 },
    { num: 4, team: 'A', x: 14, y: 56.8 },
    { num: 3, team: 'A', x: 21.3, y: 55.8 },
    { num: 5, team: 'A', x: 27.2, y: 55.8 },
    { num: 1, team: 'A', x: 32.5, y: 55.5 },
    { num: 2, team: 'A', x: 37, y: 54.8 },
    { num: 7, team: 'A', x: 44.8, y: 55.2 },
    { num: 12, team: 'A', x: 50.5, y: 55.5 },
    { num: 13, team: 'A', x: 56.2, y: 55.6 },
    { num: 6, team: 'A', x: 61.2, y: 55.7 },
    { num: 8, team: 'A', x: 66.2, y: 56.2 },
    { num: 14, team: 'A', x: 67, y: 56.2 },
    { num: 9, team: 'A', x: 59, y: 64.5 },
    { num: 15, team: 'A', x: 33, y: 74 },
    { num: 15, team: 'D', x: 34, y: 18 },
    { num: 11, team: 'D', x: 18, y: 22 },
    { num: 14, team: 'D', x: 50, y: 22 },
  ];
}

function scrumPreset(id, name, cat, anchorX, side) {
  return {
    id,
    name,
    cat,
    desc: 'Attack forwards load as a draggable scrum pack. Unlock the pack to edit individual forwards.',
    defaultGroupId: 'atk_scrum_pack',
    focusTeam: 'A',
    players: [
      ...scrumPack('A', 56, anchorX),
      ...scrumBacks(side, 'A', 60),
      ...scrumDefence(anchorX + 1.5, 49.5),
    ],
    groups: [
      makeGroup('atk_scrum_pack', 'Attack Scrum Pack', 'A', [1, 2, 3, 4, 5, 6, 7, 8], PRESET_GROUP_ATTACK),
      makeGroup('def_scrum_pack', 'Defence Scrum Pack', 'D', [1, 2, 3, 4, 5, 6, 7, 8], PRESET_GROUP_DEFENCE),
    ],
  };
}

function scrumAttackFivePreset() {
  return {
    id: 'scrum_attack_five',
    name: 'Scrum Attack 5-Man',
    cat: 'Scrum Attack',
    desc: 'Compact attacking scrum picture with the strike shape already spaced beyond halfway.',
    defaultGroupId: 'atk_scrum_five_pack',
    focusTeam: 'A',
    players: [
      { num: 2, team: 'A', x: 5.5, y: 60.2 },
      { num: 1, team: 'A', x: 11, y: 62.2 },
      { num: 4, team: 'A', x: 13.2, y: 62.2 },
      { num: 5, team: 'A', x: 15.6, y: 62.2 },
      { num: 6, team: 'A', x: 18, y: 62.2 },
      { num: 3, team: 'A', x: 20.6, y: 62.2 },
      { num: 9, team: 'A', x: 16, y: 69.5 },
      { num: 10, team: 'A', x: 27, y: 74.5 },
      { num: 8, team: 'A', x: 32, y: 76 },
      { num: 7, team: 'A', x: 37.5, y: 76.5 },
      { num: 11, team: 'A', x: 15.5, y: 85 },
      { num: 12, team: 'A', x: 35, y: 82.5 },
      { num: 13, team: 'A', x: 44, y: 84.5 },
      { num: 14, team: 'A', x: 65.5, y: 86.5 },
      { num: 15, team: 'A', x: 42, y: 94 },
    ],
    groups: [
      makeGroup('atk_scrum_five_pack', 'Attack 5-Man Scrum', 'A', [1, 2, 3, 4, 5, 6], PRESET_GROUP_ATTACK),
    ],
  };
}

function lineoutDefenceFivePreset() {
  return {
    id: 'lineout_5_defence_shape',
    name: 'Lineout Defence 5-Man',
    cat: 'Lineouts',
    desc: 'Five-man defensive lineout picture with hooker offset and the backfield already covered.',
    defaultGroupId: 'def_lineout_five_shape',
    focusTeam: 'D',
    players: [
      { num: 2, team: 'D', x: 4.2, y: 66 },
      { num: 1, team: 'D', x: 6, y: 71.2 },
      { num: 4, team: 'D', x: 8.2, y: 71.2 },
      { num: 5, team: 'D', x: 10.4, y: 71.2 },
      { num: 6, team: 'D', x: 12.6, y: 71.2 },
      { num: 3, team: 'D', x: 15.2, y: 71.2 },
      { num: 9, team: 'D', x: 10.3, y: 63 },
      { num: 10, team: 'D', x: 17, y: 64.2 },
      { num: 8, team: 'D', x: 22, y: 64 },
      { num: 7, team: 'D', x: 26.2, y: 64.2 },
      { num: 12, team: 'D', x: 30.8, y: 64 },
      { num: 13, team: 'D', x: 35.3, y: 64.2 },
      { num: 11, team: 'D', x: 9.5, y: 53.2 },
      { num: 15, team: 'D', x: 37, y: 49.8 },
      { num: 14, team: 'D', x: 49.2, y: 49.8 },
    ],
    groups: [
      makeGroup('def_lineout_five_shape', 'Defence 5-Man Lineout', 'D', [1, 2, 3, 4, 5, 6], PRESET_GROUP_DEFENCE),
    ],
  };
}

function lineoutAttackSevenPreset() {
  return {
    id: 'lineout_7_attack',
    name: 'Lineout 7-Man Attack',
    cat: 'Lineouts',
    desc: 'Seven-man attacking lineout with 11 fixed left, 14 fixed right, and the strike runners spaced underneath.',
    defaultGroupId: 'atk_lineout_seven_shape',
    focusTeam: 'A',
    players: [
      { num: 2, team: 'A', x: 2.2, y: 60.2 },
      { num: 1, team: 'A', x: 7, y: 61.8 },
      { num: 4, team: 'A', x: 9.1, y: 61.8 },
      { num: 5, team: 'A', x: 11.2, y: 61.8 },
      { num: 6, team: 'A', x: 13.3, y: 61.8 },
      { num: 7, team: 'A', x: 15.4, y: 61.8 },
      { num: 8, team: 'A', x: 17.5, y: 61.8 },
      { num: 3, team: 'A', x: 19.6, y: 61.8 },
      { num: 9, team: 'A', x: 11.5, y: 68.6 },
      { num: 10, team: 'A', x: 25.5, y: 72.2 },
      { num: 13, team: 'A', x: 33.8, y: 73.2 },
      { num: 12, team: 'A', x: 27.8, y: 78.2 },
      { num: 11, team: 'A', x: 3.2, y: 80.5 },
      { num: 15, team: 'A', x: 39.5, y: 88.2 },
      { num: 14, team: 'A', x: 63.8, y: 90.8 },
    ],
    groups: [
      makeGroup('atk_lineout_seven_shape', 'Attack 7-Man Lineout', 'A', [1, 2, 3, 4, 5, 6, 7, 8], PRESET_GROUP_ATTACK),
    ],
  };
}

function lineoutDefenceSevenPreset() {
  return {
    id: 'lineout_7_defence',
    name: 'Lineout 7-Man Defence',
    cat: 'Lineouts',
    desc: 'Seven-man defensive lineout with the line intact and 10 to 15 connected across the same defensive lane.',
    defaultGroupId: 'def_lineout_seven_shape',
    focusTeam: 'D',
    players: [
      { num: 2, team: 'D', x: 4.2, y: 60.2 },
      { num: 1, team: 'D', x: 7, y: 61.8 },
      { num: 4, team: 'D', x: 9.1, y: 61.8 },
      { num: 5, team: 'D', x: 11.2, y: 61.8 },
      { num: 6, team: 'D', x: 13.3, y: 61.8 },
      { num: 7, team: 'D', x: 15.4, y: 61.8 },
      { num: 8, team: 'D', x: 17.5, y: 61.8 },
      { num: 3, team: 'D', x: 19.6, y: 61.8 },
      { num: 9, team: 'D', x: 11.5, y: 68.6 },
      { num: 10, team: 'D', x: 20, y: 73.2 },
      { num: 11, team: 'D', x: 8, y: 73.2 },
      { num: 12, team: 'D', x: 26, y: 73.2 },
      { num: 13, team: 'D', x: 32, y: 73.2 },
      { num: 15, team: 'D', x: 38, y: 73.2 },
      { num: 14, team: 'D', x: 50, y: 73.2 },
    ],
    groups: [
      makeGroup('def_lineout_seven_shape', 'Defence 7-Man Lineout', 'D', [1, 2, 3, 4, 5, 6, 7, 8], PRESET_GROUP_DEFENCE),
    ],
  };
}

function lineoutPreset(id, name, count, attacking) {
  const nums = count === 5 ? [1, 2, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7];
  return {
    id,
    name,
    cat: 'Lineouts',
    desc: 'Lineout pods load as a draggable block. Click the pack to move it, or unlock to edit individuals.',
    defaultGroupId: attacking ? 'atk_lineout_pack' : 'def_lineout_pack',
    focusTeam: attacking ? 'A' : 'D',
    players: [
      ...lineoutChain('A', count, 8, 50),
      ...attackLineoutSupport(50),
      ...lineoutChain('D', count, 10, 46),
      ...defenceLineoutSupport(46),
    ],
    groups: [
      makeGroup('atk_lineout_pack', count === 5 ? 'Attack 5-Man Lineout' : 'Attack 7-Man Lineout', 'A', nums, PRESET_GROUP_ATTACK),
      makeGroup('def_lineout_pack', count === 5 ? 'Defence 5-Man Lineout' : 'Defence 7-Man Lineout', 'D', nums, PRESET_GROUP_DEFENCE),
    ],
  };
}

const PLAYS = [
  {
    id: 'scrum_attack',
    name: 'Scrum — Attack',
    cat: 'Scrum',
    desc: 'Attack 8-man scrum pack + backline. Drag the pack to position.',
    defaultGroupId: 'atk_scrum_pack',
    focusTeam: 'A',
    players: [
      { num: 1, team: 'A', x: 30.5, y: 50.5 },
      { num: 2, team: 'A', x: 33,   y: 49.8 },
      { num: 3, team: 'A', x: 35.5, y: 50.5 },
      { num: 4, team: 'A', x: 31.5, y: 48.5 },
      { num: 5, team: 'A', x: 34,   y: 48.0 },
      { num: 6, team: 'A', x: 30,   y: 46.5 },
      { num: 7, team: 'A', x: 36.5, y: 46.5 },
      { num: 8, team: 'A', x: 33,   y: 45.0 },
      { num: 9,  team: 'A', x: 29,  y: 43.5 },
      { num: 10, team: 'A', x: 25,  y: 40.0 },
      { num: 12, team: 'A', x: 20,  y: 38.0 },
      { num: 13, team: 'A', x: 14,  y: 36.5 },
      { num: 11, team: 'A', x: 6,   y: 34.0 },
      { num: 14, team: 'A', x: 62,  y: 34.0 },
      { num: 15, team: 'A', x: 34,  y: 28.0 },
    ],
    groups: [
      makeGroup('atk_scrum_pack', 'Attack Scrum Pack', 'A', [1,2,3,4,5,6,7,8], PRESET_GROUP_ATTACK),
    ],
  },
  {
    id: 'scrum_defence',
    name: 'Scrum — Defence',
    cat: 'Scrum',
    desc: 'Defence 8-man scrum pack + defensive shape. Drag the pack to position.',
    defaultGroupId: 'def_scrum_pack',
    focusTeam: 'D',
    players: [
      { num: 1, team: 'D', x: 30.5, y: 53.5 },
      { num: 2, team: 'D', x: 33,   y: 54.2 },
      { num: 3, team: 'D', x: 35.5, y: 53.5 },
      { num: 4, team: 'D', x: 31.5, y: 55.5 },
      { num: 5, team: 'D', x: 34,   y: 56.0 },
      { num: 6, team: 'D', x: 30,   y: 57.5 },
      { num: 7, team: 'D', x: 36.5, y: 57.5 },
      { num: 8, team: 'D', x: 33,   y: 59.0 },
      { num: 9,  team: 'D', x: 37,  y: 61.0 },
      { num: 10, team: 'D', x: 42,  y: 64.0 },
      { num: 12, team: 'D', x: 48,  y: 66.0 },
      { num: 13, team: 'D', x: 54,  y: 67.5 },
      { num: 11, team: 'D', x: 62,  y: 69.5 },
      { num: 14, team: 'D', x: 6,   y: 69.5 },
      { num: 15, team: 'D', x: 34,  y: 75.0 },
    ],
    groups: [
      makeGroup('def_scrum_pack', 'Defence Scrum Pack', 'D', [1,2,3,4,5,6,7,8], PRESET_GROUP_DEFENCE),
    ],
  },
  lineoutPreset('lineout_5_attack', 'Lineout 5-Man Attack', 5, true),
  lineoutPreset('lineout_5_defence', 'Lineout 5-Man Defence', 5, false),
  lineoutAttackSevenPreset(),
  lineoutDefenceSevenPreset(),
  {
    id: 'kickoff_receive',
    name: 'Kickoff Receive Setup',
    cat: 'Kickoffs',
    desc: 'Backfield catcher with a secure support pod underneath the reception picture.',
    focusTeam: 'A',
    players: kickoffReceivePlayers(),
    groups: [],
  },
  {
    id: 'kickoff_chase',
    name: 'Kickoff Chase Line',
    cat: 'Kickoffs',
    desc: 'Connected restart chase line with support depth behind the kicker.',
    focusTeam: 'A',
    players: kickoffChasePlayers(),
    groups: [],
  },
];

function presetFocusTeam(play) {
  return play?.focusTeam === 'D' ? 'D' : 'A';
}

function presetPlayersForView(play) {
  const players = Array.isArray(play?.players) ? play.players : [];
  if (presetShowOpposition) return cloneData(players);
  const focusTeam = presetFocusTeam(play);
  return cloneData(players.filter(player => player.team === focusTeam));
}

function presetGroupsForView(play) {
  const groups = Array.isArray(play?.groups) ? play.groups : [];
  if (presetShowOpposition) return cloneData(groups);
  const focusTeam = presetFocusTeam(play);
  return cloneData(groups.filter(group => group.team === focusTeam));
}

function updatePresetOptionsUI() {
  const btn = document.getElementById('presetOppositionToggle');
  if (!btn) return;
  btn.textContent = presetShowOpposition ? tr('opposition.on', {}, 'Opposition: On') : tr('opposition.off', {}, 'Opposition: Off');
  btn.classList.toggle('sp-btn-accent', presetShowOpposition);
}

function togglePresetOpposition() {
  presetShowOpposition = !presetShowOpposition;
  updatePresetOptionsUI();
  if (currentPresetId) {
    loadPlay(currentPresetId, { snapshotBefore: false });
    return;
  }
  render();
}

function presetToProject(play) {
  const players = presetPlayersForView(play);
  const groups = presetGroupsForView(play);
  return {
    name: play.name,
    currentPhase: 0,
    phases: [
      {
        label: 'Phase 1',
        players: cloneData(players),
        ball: null,
        paths: [],
        passes: [],
        groups: cloneData(groups),
        annotations: [],
        currentStep: 0,
        steps: [
          normalizeStepState({
            players: cloneData(players),
            ball: null,
            paths: [],
            passes: [],
            annotations: [],
          })
        ],
      }
    ],
    metadata: { title: play.name, source: 'preset' },
    playback: normalizePlaybackSettings({}),
    cat: play.cat,
  };
}

function buildPlayList() {
  const c = document.getElementById('playList');
  if (!c) return;
  c.innerHTML = '';
  const groups = new Map();
  PLAYS.forEach(play => {
    if (!groups.has(play.cat)) groups.set(play.cat, []);
    groups.get(play.cat).push(play);
  });
  groups.forEach((plays, cat) => {
    const visiblePlays = cat === 'Kickoffs'
      ? plays.filter(play => Array.isArray(play?.players) && play.players.length)
      : plays;
    if (!visiblePlays.length) return;

    const section = document.createElement('div');
    section.className = 'play-category-section';

    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'play-category-label play-category-toggle';
    label.setAttribute('aria-expanded', 'false');
    label.innerHTML = `<span>${cat}</span><span class="play-cat-chevron">&#8250;</span>`;
    section.appendChild(label);

    const list = document.createElement('div');
    list.className = 'play-category-list';
    list.hidden = true;

    visiblePlays.forEach(play => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'play-preset-btn';
      btn.innerHTML = `<div class="play-preset-name">${play.name}</div><div class="play-preset-copy">${play.desc || 'Load a clean coaching picture.'}</div>`;
      btn.onclick = () => loadPlay(play.id);
      list.appendChild(btn);
    });

    label.onclick = () => {
      const isOpen = !list.hidden;
      if (!isOpen && !document.body.classList.contains('is-phone')) {
        c.querySelectorAll('.play-category-section').forEach(otherSection => {
          if (otherSection === section) return;
          const otherLabel = otherSection.querySelector('.play-category-toggle');
          const otherList = otherSection.querySelector('.play-category-list');
          const otherChevron = otherSection.querySelector('.play-cat-chevron');
          if (otherList) otherList.hidden = true;
          if (otherLabel) otherLabel.setAttribute('aria-expanded', 'false');
          if (otherChevron) otherChevron.style.transform = '';
          otherSection.classList.remove('is-open');
        });
      }
      list.hidden = isOpen;
      label.setAttribute('aria-expanded', String(!isOpen));
      const chevron = label.querySelector('.play-cat-chevron');
      if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
      section.classList.toggle('is-open', !isOpen);
    };

    section.appendChild(list);
    c.appendChild(section);
  });
}

function loadPlay(id, { snapshotBefore = true } = {}) {
  const play = PLAYS.find(p => p.id === id);
  if (!play) return;
  closeRadialMenu();
  const presetProject = presetToProject(play);
  presetProject.metadata = {
    ...(presetProject.metadata || {}),
    presetId: play.id,
  };
  if (applyBoardData(presetProject, { snapshotBefore })) {
    currentPresetId = play.id;
    updatePresetOptionsUI();
    const defaultGroup = S.groups.find(group => group.id === play.defaultGroupId) || null;
    if (defaultGroup) selectGroup(defaultGroup.id);
    document.getElementById('playName').value = play.name;
    syncPlayMetadataTitle();
    setHint(defaultGroup
      ? `"${play.name}" loaded. Drag the pack to position it, or tap to select then use Edit Individuals.`
      : `Loaded "${play.name}".`);
    refreshInteractionUI();
  }
}

function currentPlayTitle() {
  return document.getElementById('playName').value.trim() || 'Untitled Play';
}

let autosaveTimer = null;
let autosaveState = 'saved';
let autosaveLastFingerprint = '';
let autosaveStartupNotice = '';
let autosavePromptDeferredThisSession = false;
let recoveryPromptContext = null;
let autosaveStatusEls = null;

function getAutosaveStatusElements() {
  if (autosaveStatusEls) return autosaveStatusEls;
  autosaveStatusEls = {
    status: document.getElementById('autosaveStatus'),
    prompt: document.getElementById('recoveryDraftPrompt'),
    promptMessage: document.getElementById('recoveryDraftMessage'),
    restoreBtn: document.getElementById('recoveryDraftRestoreBtn'),
    discardBtn: document.getElementById('recoveryDraftDiscardBtn'),
    laterBtn: document.getElementById('recoveryDraftLaterBtn'),
  };
  return autosaveStatusEls;
}

function setAutosaveStatus(state, label = '') {
  autosaveState = state;
  const el = getAutosaveStatusElements().status;
  if (!el) return;
  const text = label || tr(`autosave.${state}`, {}, state === 'saving'
    ? 'Saving...'
    : state === 'unsaved'
      ? 'Unsaved'
      : state === 'failed'
        ? 'Save failed'
        : 'Saved');
  el.dataset.state = state;
  el.textContent = text;
}

function stripProjectVolatileFields(project) {
  const normalized = cloneData(project);
  delete normalized.id;
  delete normalized.savedAt;
  if (normalized.metadata) {
    delete normalized.metadata.createdAt;
    delete normalized.metadata.updatedAt;
  }
  return normalized;
}

function getCurrentRecoveryFingerprint() {
  return JSON.stringify(stripProjectVolatileFields(makeBoardData()));
}

function buildRecoveryDraftEnvelope() {
  const payload = makeBoardData();
  return {
    recoveryVersion: RECOVERY_DRAFT_VERSION,
    savedAt: nowIso(),
    source: 'autosave',
    appSchemaVersion: PROJECT_SCHEMA_VERSION || null,
    projectId: S.projectId || null,
    projectName: currentPlayTitle() || null,
    payload,
  };
}

function removeRecoveryDraft() {
  try {
    localStorage.removeItem(RECOVERY_DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}

function quarantineRecoveryDraft(message = 'A recovery draft could not be opened.') {
  removeRecoveryDraft();
  autosaveStartupNotice = message;
}

function isMeaningfulRecoveryProject(project) {
  if (!project) return false;
  const activePhase = project.phases?.[project.currentPhase] || project.phases?.[0];
  const activeStep = activePhase?.steps?.[activePhase.currentStep] || activePhase?.steps?.[0] || null;
  const metadata = project.metadata || {};
  const hasBoardContent = (project.phases?.length || 0) > 1
    || (activePhase?.steps?.length || 0) > 1
    || (activeStep?.players?.length || 0) > 0
    || !!activeStep?.ball
    || (activeStep?.paths?.length || 0) > 0
    || (activeStep?.passes?.length || 0) > 0
    || (activeStep?.annotations?.length || 0) > 0;
  const hasMetadataContent = !!String(metadata.purpose || '').trim()
    || (Array.isArray(metadata.coachingPoints) && metadata.coachingPoints.some(Boolean))
    || !!String(metadata.decisionCue || '').trim()
    || (Array.isArray(metadata.commonMistakes) && metadata.commonMistakes.some(Boolean));
  const hasCustomName = !!String(project.name || '').trim() && String(project.name || '').trim() !== 'New Play';
  return hasBoardContent || hasMetadataContent || hasCustomName;
}

function readRecoveryDraftEnvelope() {
  try {
    const raw = localStorage.getItem(RECOVERY_DRAFT_KEY);
    if (!raw) return null;
    const envelope = JSON.parse(raw);
    if (!envelope || typeof envelope !== 'object') {
      quarantineRecoveryDraft();
      return null;
    }
    if (envelope.recoveryVersion !== RECOVERY_DRAFT_VERSION) {
      quarantineRecoveryDraft();
      return null;
    }
    if (envelope.source !== 'autosave' || !envelope.payload) {
      quarantineRecoveryDraft();
      return null;
    }
    const project = normalizeProjectRecord(envelope.payload);
    if (!project) {
      quarantineRecoveryDraft();
      return null;
    }
    return { envelope, project };
  } catch {
    quarantineRecoveryDraft();
    return null;
  }
}

function isAutosaveInteractionBusy() {
  return !!(S.dragging || S.drawing || S.animating || trackDrag);
}

function scheduleAutosave({ immediate = false } = {}) {
  clearTimeout(autosaveTimer);
  autosaveTimer = null;
  if (immediate) {
    writeRecoveryDraftNow({ force: true });
    return;
  }
  setAutosaveStatus('unsaved');
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    writeRecoveryDraftNow();
  }, AUTOSAVE_DEBOUNCE_MS);
}

function writeRecoveryDraftNow({ force = false } = {}) {
  clearTimeout(autosaveTimer);
  autosaveTimer = null;
  if (!force && isAutosaveInteractionBusy()) {
    scheduleAutosave();
    return false;
  }
  try {
    const envelope = buildRecoveryDraftEnvelope();
    const fingerprint = JSON.stringify(stripProjectVolatileFields(envelope.payload));
    if (!force && fingerprint === autosaveLastFingerprint) {
      setAutosaveStatus('saved');
      return true;
    }
    setAutosaveStatus('saving');
    localStorage.setItem(RECOVERY_DRAFT_KEY, JSON.stringify(envelope));
    autosaveLastFingerprint = fingerprint;
    setAutosaveStatus('saved');
    return true;
  } catch {
    setAutosaveStatus('failed');
    return false;
  }
}

function replaceRecoveryDraftWithCurrentBoard() {
  writeRecoveryDraftNow({ force: true });
}

function showRecoveryDraftPrompt(context) {
  if (!context || autosavePromptDeferredThisSession) return;
  recoveryPromptContext = context;
  const els = getAutosaveStatusElements();
  if (!els.prompt || !els.promptMessage) return;
  const savedAtLabel = context.envelope.savedAt
    ? new Date(context.envelope.savedAt).toLocaleString()
    : 'an earlier time';
  els.promptMessage.textContent = `We found an unsaved play from ${savedAtLabel}.`;
  els.prompt.hidden = false;
  els.restoreBtn?.focus();
}

function hideRecoveryDraftPrompt({ deferForSession = false } = {}) {
  const els = getAutosaveStatusElements();
  if (els.prompt) els.prompt.hidden = true;
  if (deferForSession) autosavePromptDeferredThisSession = true;
  recoveryPromptContext = null;
}

function restoreRecoveryDraftFromPrompt() {
  if (!recoveryPromptContext) return;
  try {
    if (applyBoardData(recoveryPromptContext.envelope.payload, { snapshotBefore: false })) {
      S.history = [];
      S.future = [];
      stopPlayback(true);
      replaceRecoveryDraftWithCurrentBoard();
      setHint(`Recovered unsaved play from ${new Date(recoveryPromptContext.envelope.savedAt).toLocaleString()}.`);
    }
  } catch {
    quarantineRecoveryDraft();
  }
  hideRecoveryDraftPrompt();
}

function discardRecoveryDraftFromPrompt() {
  removeRecoveryDraft();
  setAutosaveStatus('saved');
  hideRecoveryDraftPrompt();
}

function maybeOfferRecoveryDraftOnStartup() {
  const recovery = readRecoveryDraftEnvelope();
  if (autosaveStartupNotice) {
    setHint(autosaveStartupNotice);
    autosaveStartupNotice = '';
  }
  if (!recovery || !isMeaningfulRecoveryProject(recovery.project)) {
    autosaveLastFingerprint = getCurrentRecoveryFingerprint();
    setAutosaveStatus('saved');
    return;
  }
  showRecoveryDraftPrompt(recovery);
  autosaveLastFingerprint = JSON.stringify(stripProjectVolatileFields(recovery.project));
  setAutosaveStatus('saved');
}

function flushAutosaveOnPageHide() {
  writeRecoveryDraftNow({ force: true });
}

function serializePlay() {
  const stamp = Date.now();
  return {
    version: SCHEMA_VERSION,
    meta: {
      name: currentPlayTitle(),
      createdAt: stamp,
      modifiedAt: stamp,
    },
    phases: GamePlan.phases.map((phase, index) => serializePhase(phase, index)),
    currentPhase: GamePlan.currentPhase,
  };
}

function migratePlay(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Invalid play JSON: expected an object.');
  }
  if (!Number.isFinite(obj.version)) {
    throw new Error('Invalid play JSON: missing version field.');
  }
  if (obj.version > SCHEMA_VERSION) {
    throw new Error(`Unsupported play version ${obj.version}. This board supports up to version ${SCHEMA_VERSION}.`);
  }
  if (obj.version === 1) {
    return { ...cloneData(obj), version: 2 };
  }
  if (obj.version === 2) {
    return cloneData(obj);
  }
  throw new Error(`Unsupported play version ${obj.version}. No migration path is available.`);
}

function deserializePlay(obj) {
  clearPendingCanonicalPhaseStart();
  const play = migratePlay(obj);
  if (Array.isArray(play.phases) && play.phases.length) {
    const phases = play.phases.map((phase, index) => normalizePhaseState(phase, index));
    GamePlan.name = typeof play.meta?.name === 'string' && play.meta.name.trim()
      ? play.meta.name.trim()
      : 'Untitled Play';
    GamePlan.currentPhase = clamp(Number.isFinite(play.currentPhase) ? Number(play.currentPhase) : 0, 0, phases.length - 1);
    GamePlan.phases = phases;
    const activePhase = GamePlan.phases[GamePlan.currentPhase] || GamePlan.phases[0];
    setLiveBoardFromStep(activePhase.steps[activePhase.currentStep] || emptyStepState());
    S.tool = 'move';
    S.tab = 'atk';
    S.selected = null;
    S.selectedPlayerId = null;
    S.selectedPlayerIds = [];
    S.selectedGroupId = null;
    S.selectedObjectType = null;
    S.selectedAnnotationIdValue = null;
    S.selectedPassIdx = null;
    S.selectedPathPid = null;
    S.dragPlayerId = null;
    S.dragging = null;
    S.dragOff = { x: 0, y: 0 };
    S.drawing = null;
    S.passFrom = null;
    S.activePasserId = null;
    S.activeKickerId = null;
    S.activeRunSourceId = null;
    S.highlightedPlayerIds = [];
    S.pendingGroupPlacement = null;
    S.annotationDraft = null;
    S.ballAssignCandidate = null;
    S.pointerTap = null;
    S.animT = 0;
    S.animating = false;
    S.playAll = false;
    canonicalPlaybackBoundaryIndex = null;
    canonicalPlaybackMode = 'idle';
    S.raf = null;
    S.lastTs = null;
    S.history = [];
    S.future = [];
    document.getElementById('playName').value = GamePlan.name;
    clearSelectedObject();
    clearPassKickState();
    syncPlayMetadataTitle();
    setPlayBtnState();
    rebuildPalette();
    refreshInteractionUI();
    updateTL();
    render();
    replaceRecoveryDraftWithCurrentBoard();
    return;
  }
  const players = Array.isArray(play.players) ? cloneData(play.players) : [];
  const ball = play.ball ? cloneData(play.ball) : null;
  const paths = Array.isArray(play.paths) ? cloneData(play.paths) : [];
  const passes = Array.isArray(play.passes) ? cloneData(play.passes) : [];
  const maxId = players.reduce((max, player) => {
    const id = Number(player?.id);
    return Number.isFinite(id) ? Math.max(max, id) : max;
  }, 0);
  const carrier = players.find(player => player?.isBC) || null;
  const ballOwner = carrier ? playerRef(carrier) : null;
  const ballAttached = !!(carrier && ball);
  const title = typeof play.meta?.name === 'string' && play.meta.name.trim()
    ? play.meta.name.trim()
    : 'Untitled Play';
  const phaseState = normalizePhaseState({
    label: 'Phase 1',
    players,
    ball,
    ballOwner,
    ballAttached,
    paths,
    passes,
    groups: [],
    annotations: [],
    currentStep: 0,
    steps: [
      {
        players,
        ball,
        ballOwner,
        ballAttached,
        paths,
        passes,
        annotations: [],
      }
    ],
  }, 0);

  GamePlan.name = title;
  GamePlan.currentPhase = 0;
  GamePlan.phases = [phaseState];

  S.players = players;
  S.ball = ball;
  S.ballOwner = ballOwner;
  S.ballAttached = ballAttached;
  S.paths = paths;
  S.passes = passes;
  S.groups = [];
  S.annotations = [];
  S.steps = cloneData(phaseState.steps);
  S.currentStep = 0;
  S.atkUsed = new Set(S.players.filter(player => player.team === 'A').map(player => player.num));
  S.defUsed = new Set(S.players.filter(player => player.team === 'D').map(player => player.num));

  S.tool = 'move';
  S.tab = 'atk';
  S.selected = null;
  S.selectedPlayerId = null;
  S.selectedPlayerIds = [];
  S.selectedGroupId = null;
  S.selectedObjectType = null;
  S.selectedAnnotationIdValue = null;
  S.selectedPassIdx = null;
  S.selectedPathPid = null;
  S.dragPlayerId = null;
  S.dragging = null;
  S.dragOff = { x: 0, y: 0 };
  S.drawing = null;
  S.passFrom = null;
  S.activePasserId = null;
  S.activeKickerId = null;
  S.activeRunSourceId = null;
  S.highlightedPlayerIds = [];
  S.pendingGroupPlacement = null;
  S.annotationDraft = null;
  S.ballAssignCandidate = null;
  S.pointerTap = null;
  S.animT = 0;
  S.animating = false;
  S.playAll = false;
  canonicalPlaybackBoundaryIndex = null;
  canonicalPlaybackMode = 'idle';
  S.animSpd = 1;
  S.raf = null;
  S.lastTs = null;
  S.nextId = maxId + 1;
  S.history = [];
  S.future = [];
  S.projectId = null;
  S.projectMeta = null;
  S.projectPlayback = null;
  S.playMetadata = emptyPlayMetadata(title);
  spdIdx = Math.max(0, SPEEDS.indexOf(S.animSpd));

  palTab = S.tab;
  document.getElementById('playName').value = title;
  clearSelectedObject();
  clearPassKickState();
  closeRadialMenu();
  applyBallOwnershipVisualState();
  syncPlayMetadataTitle();
  setPlayBtnState();
  document.getElementById('spdLabel').textContent = fmtSpd(S.animSpd);
  updatePhaseUI();
  updatePresetOptionsUI();
  rebuildPalette();
  refreshInteractionUI();
  updateTL();
  setTab('atk');
  setTool('move');
  replaceRecoveryDraftWithCurrentBoard();
}

function buildPlayMetadata() {
  const current = normalizeProjectMetadata({ name: currentPlayTitle() }, S.playMetadata || {});
  return {
    ...current,
    title: currentPlayTitle(),
  };
}

function syncPlayMetadataTitle() {
  GamePlan.name = currentPlayTitle();
  if (!S.playMetadata) {
    S.playMetadata = emptyPlayMetadata(currentPlayTitle());
  }
  S.playMetadata.title = currentPlayTitle();
  updatePlayMetadataPanel();
}

function updateBallOwnerFromPosition() {
  if (!S.ball) {
    S.ballOwner = null;
    S.ballAttached = false;
    applyBallOwnershipVisualState();
    return;
  }
  if (syncAttachedBallToOwner()) return;
  let best = null;
  let bestDist = Infinity;
  S.players.forEach(pl => {
    const dist = d2(S.ball, { x: pl.x, y: pl.y });
    if (dist < bestDist) {
      bestDist = dist;
      best = pl;
    }
  });
  S.ballOwner = best && bestDist <= 3.5 ? playerRef(best) : null;
  S.ballAttached = false;
  applyBallOwnershipVisualState();
}

function makeProjectRecord(nameOverride, metadataOverrides = {}) {
  persistCurrentPhase();
  const prevMeta = S.projectMeta || {};
  const stamp = nowIso();
  const title = nameOverride || currentPlayTitle();
  const playMetadata = {
    ...buildPlayMetadata(),
    ...metadataOverrides,
    title,
  };
  const meta = {
    ...playMetadata,
    createdAt: prevMeta.createdAt || stamp,
    updatedAt: stamp,
    source: prevMeta.source || 'animator',
  };
  const playback = normalizePlaybackSettings(S.projectPlayback || {});
  const gamePlan = serializeGamePlan(title);
  const currentPhase = gamePlan.phases[gamePlan.currentPhase] || gamePlan.phases[0];
  const currentStepData = cloneStepState(currentPhase.steps[currentPhase.currentStep] || emptyStepState());

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectType: PROJECT_TYPE,
    id: S.projectId || mkProjectId(),
    name: title,
    currentPhase: gamePlan.currentPhase,
    phases: gamePlan.phases,
    cat: 'Saved Board',
    metadata: meta,
    playback,
    currentStepIndex: currentPhase.currentStep,
    steps: currentPhase.steps,
    annotations: cloneData(currentStepData.annotations),
    players: cloneData(currentStepData.players),
    ball: currentStepData.ball ? { ...currentStepData.ball } : null,
    ballOwner: normalizePlayerRef(currentStepData.ballOwner),
    ballAttached: !!currentStepData.ballAttached,
    paths: cloneData(currentStepData.paths),
    passes: cloneData(currentStepData.passes),
  };
}

function normalizeProjectRecord(input) {
  const project = input?.project || input?.play || input;
  if (!project) return null;
  if (Array.isArray(project.phases) && project.phases.length) {
    const phases = project.phases.map((phase, index) => normalizePhaseState(phase, index));
    const currentPhase = clamp(Number.isFinite(project.currentPhase) ? Number(project.currentPhase) : 0, 0, phases.length - 1);
    const activePhase = phases[currentPhase] || phases[0];
    const activeStep = activePhase.steps[activePhase.currentStep] || emptyStepState();
    const normalizedGamePlan = {
      schemaVersion: Number.isFinite(project.schemaVersion) ? project.schemaVersion : 0,
      projectType: project.projectType || PROJECT_TYPE,
      id: project.id || mkProjectId(),
      name: project.name || 'Untitled Play',
      currentPhase,
      phases: phases.map((phase, index) => serializePhase(phase, index)),
      cat: project.cat || 'Saved Board',
      metadata: normalizeProjectMetadata(project, project.metadata),
      playback: normalizePlaybackSettings(project.playback),
      currentStepIndex: activePhase.currentStep,
      steps: activePhase.steps.map(step => cloneStepState(step)),
      annotations: cloneData(activeStep.annotations),
      players: cloneData(activeStep.players),
      ball: activeStep.ball ? cloneData(activeStep.ball) : null,
      ballOwner: normalizePlayerRef(activeStep.ballOwner),
      ballAttached: !!activeStep.ballAttached,
      paths: cloneData(activeStep.paths),
      passes: cloneData(activeStep.passes),
    };
    normalizedGamePlan.metadata.title = normalizedGamePlan.name || normalizedGamePlan.metadata.title || '';
    if (project.savedAt) normalizedGamePlan.savedAt = project.savedAt;
    return normalizedGamePlan;
  }
  const hasPlayers = Array.isArray(project.players);
  const hasSteps = Array.isArray(project.steps) && project.steps.length;
  if (!hasPlayers && !hasSteps) return null;

  const fallbackStep = normalizeStepState({
    players: cloneData(project.players || []),
    ball: project.ball ? cloneData(project.ball) : null,
    ballOwner: normalizePlayerRef(project.ballOwner || project.ball?.owner),
    ballAttached: !!project.ballAttached,
    paths: cloneData(project.paths || []),
    passes: cloneData(project.passes || []),
    annotations: Array.isArray(project.annotations) ? project.annotations : [],
  });
  const normalizedSteps = Array.isArray(project.steps) && project.steps.length
    ? project.steps.map(step => normalizeStepState(step, fallbackStep.players))
    : [fallbackStep];
  const safeSteps = normalizedSteps.length ? normalizedSteps : [fallbackStep];
  const currentStepIndex = clamp(Number.isFinite(project.currentStepIndex) ? Number(project.currentStepIndex) : 0, 0, safeSteps.length - 1);
  const currentStep = safeSteps[currentStepIndex] || safeSteps[0];

  const normalized = {
    schemaVersion: Number.isFinite(project.schemaVersion) ? project.schemaVersion : 0,
    projectType: project.projectType || PROJECT_TYPE,
    id: project.id || mkProjectId(),
    name: project.name || 'Untitled Play',
    currentPhase: 0,
    phases: [serializePhase(normalizePhaseState({
      label: project.phaseLabel || 'Phase 1',
      players: cloneData(currentStep.players),
      ball: currentStep.ball ? cloneData(currentStep.ball) : null,
      ballOwner: normalizePlayerRef(currentStep.ballOwner),
      ballAttached: !!currentStep.ballAttached,
      paths: cloneData(currentStep.paths),
      passes: cloneData(currentStep.passes),
      annotations: cloneData(currentStep.annotations),
      currentStep: currentStepIndex,
      steps: safeSteps,
    }, 0), 0)],
    cat: project.cat || 'Saved Board',
    metadata: normalizeProjectMetadata(project, project.metadata),
    playback: normalizePlaybackSettings(project.playback),
    currentStepIndex,
    steps: safeSteps,
    annotations: cloneData(currentStep.annotations),
    players: cloneData(currentStep.players),
    ball: currentStep.ball ? cloneData(currentStep.ball) : null,
    ballOwner: normalizePlayerRef(currentStep.ballOwner),
    ballAttached: !!currentStep.ballAttached,
    paths: cloneData(currentStep.paths),
    passes: cloneData(currentStep.passes),
  };

  normalized.metadata.title = normalized.name || normalized.metadata.title || '';

  if (project.savedAt) normalized.savedAt = project.savedAt;
  return normalized;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const FORBIDDEN_IMPORT_KEYS = ['__proto__', 'prototype', 'constructor'];

// Scans the RAW parsed JSON tree (before sanitizeImportedValue's strip-and-
// continue pass) for an exact forbidden key anywhere in the object/array
// tree, so a file containing one can be rejected outright instead of
// silently sanitized. JSON.parse always assigns parsed keys - including
// "__proto__" - as genuine OWN data properties (never through the special
// object-literal accessor), so Object.getOwnPropertyNames + reading via the
// property descriptor (never `value[key]`, which could invoke a getter on
// non-JSON-parse input) is both sufficient and safe here; inherited
// properties are never visited since getOwnPropertyNames only ever returns
// a value's own keys.
function findForbiddenImportKey(value, path = 'root') {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findForbiddenImportKey(value[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const keys = Object.getOwnPropertyNames(value);
  for (const key of keys) {
    if (FORBIDDEN_IMPORT_KEYS.includes(key)) {
      return { key, path: `${path}.${key}` };
    }
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    const found = findForbiddenImportKey(descriptor?.value, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

function sanitizeImportedValue(value, repairNotes, path = 'root') {
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeImportedValue(item, repairNotes, `${path}[${index}]`));
  }
  if (typeof value === 'string') {
    return value.length > IMPORT_MAX_STRING_LENGTH ? value.slice(0, IMPORT_MAX_STRING_LENGTH) : value;
  }
  if (!value || typeof value !== 'object') return value;
  if (!isPlainObject(value)) {
    repairNotes.push(`Unsupported value at ${path} was ignored.`);
    return {};
  }
  const clean = {};
  Object.keys(value).forEach((key) => {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      repairNotes.push(`Unsafe field "${key}" was ignored.`);
      return;
    }
    clean[key] = sanitizeImportedValue(value[key], repairNotes, `${path}.${key}`);
  });
  return clean;
}

function boundImportedString(value, maxLength = IMPORT_MAX_STRING_LENGTH, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function sanitizeImportedText(value, maxLength = IMPORT_MAX_STRING_LENGTH, fallback = '') {
  const bounded = boundImportedString(value, maxLength, fallback);
  return bounded
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim() || fallback;
}

function isFiniteCoordinate(value) {
  const n = Number(value);
  return Number.isFinite(n);
}

function countInvalidPlayers(players) {
  if (!Array.isArray(players)) return 0;
  return players.reduce((count, player) => {
    const team = player?.team === 'A' || player?.team === 'D';
    return count + (team && isFiniteCoordinate(player?.num) && isFiniteCoordinate(player?.x) && isFiniteCoordinate(player?.y) ? 0 : 1);
  }, 0);
}

function countInvalidPaths(paths) {
  if (!Array.isArray(paths)) return 0;
  return paths.reduce((count, path) => count + (normalizeStepPath(path) ? 0 : 1), 0);
}

function countInvalidPasses(passes) {
  if (!Array.isArray(passes)) return 0;
  return passes.reduce((count, pass) => count + (normalizeStepPass(pass) ? 0 : 1), 0);
}

function countInvalidAnnotations(annotations) {
  if (!Array.isArray(annotations)) return 0;
  return annotations.reduce((count, annotation) => count + (normalizeAnnotation(annotation) ? 0 : 1), 0);
}

function addRepairCount(repairCounts, key, amount = 1) {
  if (!amount) return;
  repairCounts[key] = (repairCounts[key] || 0) + amount;
}

function summarizeRepairCounts(repairCounts) {
  const labels = {
    metadataDefaults: 'metadata defaults applied',
    notesDefaults: 'missing notes defaulted',
    ballDefaults: 'ball state defaulted',
    currentPhaseClamped: 'current phase clamped',
    currentStepClamped: 'current move clamped',
    emptyPhaseRepaired: 'empty phase repaired',
    invalidPlayers: 'invalid player entries skipped',
    invalidPaths: 'invalid paths skipped',
    invalidPasses: 'invalid passes skipped',
    invalidAnnotations: 'invalid annotations skipped',
    legacyMigrated: 'legacy file migrated',
    unsafeFields: 'unsafe fields ignored',
  };
  return Object.entries(repairCounts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${count} ${labels[key] || key}`);
}

function analyzeImportedProjectRepairs(sourceInput, normalizedProject, repairCounts, repairNotes) {
  const sourceProject = sourceInput?.project || sourceInput?.play || sourceInput;
  if (!sourceProject || typeof sourceProject !== 'object') return;
  const sourcePhases = Array.isArray(sourceProject.phases) && sourceProject.phases.length
    ? sourceProject.phases
    : [sourceProject];
  const normalizedPhases = normalizedProject.phases || [];

  if (!isPlainObject(sourceProject.metadata)) addRepairCount(repairCounts, 'metadataDefaults');
  if (Number.isFinite(sourceProject.currentPhase) && normalizedProject.currentPhase !== Number(sourceProject.currentPhase)) {
    addRepairCount(repairCounts, 'currentPhaseClamped');
  }

  sourcePhases.forEach((phase, phaseIndex) => {
    const normalizedPhase = normalizedPhases[phaseIndex] || normalizedPhases[0];
    if (!isPlainObject(phase)) {
      addRepairCount(repairCounts, 'emptyPhaseRepaired');
      return;
    }
    if (typeof phase.notes !== 'string') addRepairCount(repairCounts, 'notesDefaults');
    if (phase.ball === undefined || phase.ball === null || normalizeBallPosition(phase.ball) === null) {
      if (phase.ball !== undefined) addRepairCount(repairCounts, 'ballDefaults');
    }
    const sourceSteps = Array.isArray(phase.steps) && phase.steps.length ? phase.steps : [phase];
    if (!Array.isArray(phase.steps) || !phase.steps.length) addRepairCount(repairCounts, 'emptyPhaseRepaired');
    if (Number.isFinite(phase.currentStep) && normalizedPhase && normalizedPhase.currentStep !== Number(phase.currentStep)) {
      addRepairCount(repairCounts, 'currentStepClamped');
    }
    sourceSteps.forEach((step) => {
      addRepairCount(repairCounts, 'invalidPlayers', countInvalidPlayers(step?.players));
      addRepairCount(repairCounts, 'invalidPaths', countInvalidPaths(step?.paths));
      addRepairCount(repairCounts, 'invalidPasses', countInvalidPasses(step?.passes));
      addRepairCount(repairCounts, 'invalidAnnotations', countInvalidAnnotations(step?.annotations));
    });
  });

  const unsafeCount = repairNotes.filter(note => note.startsWith('Unsafe field')).length;
  if (unsafeCount) addRepairCount(repairCounts, 'unsafeFields', unsafeCount);
}

function buildCanonicalPlayEnvelope(project) {
  return {
    fileType: PLAY_FILE_TYPE,
    fileVersion: PLAY_FILE_VERSION,
    appSchemaVersion: PROJECT_SCHEMA_VERSION,
    exportedAt: nowIso(),
    generator: PLAY_FILE_GENERATOR,
    payload: project,
  };
}

function sanitizeExportFilename(name) {
  let safe = typeof name === 'string' ? name : '';
  if (safe.normalize) safe = safe.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  safe = safe
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .replace(/\.json$/i, '')
    .slice(0, 80);
  return safe || 'rugby-gameplan-play';
}

function buildExportDownload(filename, jsonValue) {
  const blob = new Blob([JSON.stringify(jsonValue, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeExportFilename(filename)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function validateExportProject(project) {
  const normalized = normalizeProjectRecord(project);
  if (!normalized || !Array.isArray(normalized.phases) || !normalized.phases.length) {
    throw new Error('Export validation failed.');
  }
  normalized.name = sanitizeImportedText(normalized.name, IMPORT_MAX_NAME_LENGTH, 'Untitled Play');
  normalized.id = sanitizeImportedText(normalized.id, IMPORT_MAX_ID_LENGTH, mkProjectId());
  return normalized;
}

function sanitizeNormalizedProjectTextFields(project) {
  project.name = sanitizeImportedText(project.name, IMPORT_MAX_NAME_LENGTH, 'Untitled Play');
  project.id = sanitizeImportedText(project.id, IMPORT_MAX_ID_LENGTH, mkProjectId());
  project.cat = sanitizeImportedText(project.cat, 80, 'Saved Board');
  if (project.metadata && typeof project.metadata === 'object') {
    project.metadata.title = sanitizeImportedText(project.metadata.title, IMPORT_MAX_NAME_LENGTH, project.name);
    project.metadata.purpose = sanitizeImportedText(project.metadata.purpose, 600, '');
    project.metadata.decisionCue = sanitizeImportedText(project.metadata.decisionCue, 600, '');
    project.metadata.source = sanitizeImportedText(project.metadata.source, 80, 'animator');
    project.metadata.coachingPoints = Array.isArray(project.metadata.coachingPoints)
      ? project.metadata.coachingPoints.map(item => sanitizeImportedText(item, 240, '')).filter(Boolean).slice(0, 3)
      : [];
    project.metadata.commonMistakes = Array.isArray(project.metadata.commonMistakes)
      ? project.metadata.commonMistakes.map(item => sanitizeImportedText(item, 240, '')).filter(Boolean).slice(0, 3)
      : [];
  }
  if (Array.isArray(project.phases)) {
    project.phases = project.phases.map((phase, phaseIndex) => ({
      ...phase,
      id: sanitizeImportedText(phase.id, IMPORT_MAX_ID_LENGTH, `phase_${phaseIndex + 1}`),
      label: sanitizeImportedText(phase.label, 120, `Phase ${phaseIndex + 1}`),
      notes: sanitizeImportedText(phase.notes, 1000, ''),
      annotations: Array.isArray(phase.annotations)
        ? phase.annotations.map((annotation) => annotation?.type === 'note'
          ? { ...annotation, text: sanitizeImportedText(annotation.text, 240, ANNOTATION_NOTE_DEFAULT) }
          : annotation)
        : [],
      steps: Array.isArray(phase.steps)
        ? phase.steps.map((step) => ({
          ...step,
          annotations: Array.isArray(step.annotations)
            ? step.annotations.map((annotation) => annotation?.type === 'note'
              ? { ...annotation, text: sanitizeImportedText(annotation.text, 240, ANNOTATION_NOTE_DEFAULT) }
              : annotation)
            : [],
        }))
        : phase.steps,
    }));
  }
  return project;
}

function detectImportedPlayFormat(value) {
  if (!isPlainObject(value)) {
    throw new Error('This file is not a valid Rugby GamePlan play.');
  }
  if ('fileType' in value || 'fileVersion' in value || 'payload' in value) return 'envelope';
  if (Number.isFinite(value.version)) return 'legacy-play';
  if ('project' in value || 'play' in value || 'schemaVersion' in value || 'projectType' in value || Array.isArray(value.phases) || Array.isArray(value.players) || Array.isArray(value.steps)) {
    return 'project';
  }
  throw new Error('This file is not a valid Rugby GamePlan play.');
}

function isMeaningfulBoardProject(project) {
  return isMeaningfulRecoveryProject(project);
}

function buildImportSuccessMessage(importResult) {
  if (importResult.repairSummary.length) {
    return `Play imported with ${importResult.repairSummary.length} repair${importResult.repairSummary.length === 1 ? '' : 's'}.`;
  }
  return 'Play imported.';
}

function prepareImportedProject(rawValue) {
  // Reject a file containing a forbidden key OUTRIGHT, before any migration,
  // normalization, or sanitization runs - not silently stripped and allowed
  // to continue. This must run first: sanitizeImportedValue() below already
  // strips these same keys as a defense-in-depth fallback, but by the time
  // it would run, the "strip and continue" behavior is exactly what this
  // check exists to replace.
  const forbidden = findForbiddenImportKey(rawValue);
  if (forbidden) {
    console.error(`Import rejected: forbidden key "${forbidden.key}" found at ${forbidden.path}`);
    throw new Error('This file contains unsafe object keys and cannot be imported.');
  }

  const repairNotes = [];
  const repairCounts = {};
  const sanitizedRoot = sanitizeImportedValue(rawValue, repairNotes);
  const format = detectImportedPlayFormat(sanitizedRoot);
  let sourceValue = sanitizedRoot;
  let importCategory = 'current';

  if (format === 'envelope') {
    if (sanitizedRoot.fileType !== PLAY_FILE_TYPE) {
      throw new Error('This file is not a valid Rugby GamePlan play.');
    }
    const fileVersion = Number(sanitizedRoot.fileVersion);
    if (!Number.isFinite(fileVersion) || fileVersion < 1) {
      throw new Error('This play could not be imported. Your current board was not changed.');
    }
    if (fileVersion > PLAY_FILE_VERSION) {
      throw new Error('This play was created by a newer version of Rugby GamePlan and cannot be opened here yet.');
    }
    const appSchemaVersion = Number(sanitizedRoot.appSchemaVersion);
    if (Number.isFinite(appSchemaVersion) && appSchemaVersion > PROJECT_SCHEMA_VERSION) {
      throw new Error('This play was created by a newer version of Rugby GamePlan and cannot be opened here yet.');
    }
    if (!sanitizedRoot.payload || typeof sanitizedRoot.payload !== 'object') {
      throw new Error('This play could not be imported. Your current board was not changed.');
    }
    sourceValue = sanitizedRoot.payload;
  } else if (format === 'legacy-play') {
    let migrated;
    try {
      migrated = migratePlay(sanitizedRoot);
    } catch (err) {
      const message = String(err?.message || '');
      if (message.startsWith('Unsupported play version')) {
        throw new Error('This play was created by a newer version of Rugby GamePlan and cannot be opened here yet.');
      }
      if (message.startsWith('Invalid play JSON')) {
        throw new Error('This file is not a valid Rugby GamePlan play.');
      }
      throw err;
    }
    if (sanitizedRoot.version !== migrated.version) addRepairCount(repairCounts, 'legacyMigrated');
    importCategory = sanitizedRoot.version === migrated.version ? 'current' : 'legacy';
    sourceValue = migrated;
  }

  const rawProject = sourceValue?.project || sourceValue?.play || sourceValue;
  if (Number.isFinite(rawProject?.schemaVersion) && rawProject.schemaVersion > PROJECT_SCHEMA_VERSION) {
    throw new Error('This play was created by a newer version of Rugby GamePlan and cannot be opened here yet.');
  }

  const normalizedProject = normalizeProjectRecord(sourceValue);
  if (!normalizedProject) {
    throw new Error('This play could not be imported. Your current board was not changed.');
  }

  sanitizeNormalizedProjectTextFields(normalizedProject);
  normalizedProject.currentPhase = clamp(Number(normalizedProject.currentPhase) || 0, 0, Math.max(0, (normalizedProject.phases?.length || 1) - 1));
  normalizedProject.metadata = normalizeProjectMetadata(normalizedProject, normalizedProject.metadata);

  analyzeImportedProjectRepairs(sourceValue, normalizedProject, repairCounts, repairNotes);
  const repairSummary = summarizeRepairCounts(repairCounts);
  if (repairSummary.length) importCategory = importCategory === 'current' ? 'repairable' : importCategory;

  return {
    category: importCategory,
    format,
    project: normalizedProject,
    repairSummary,
    repairNotes,
    displayName: normalizedProject.name || 'Untitled Play',
  };
}

function applyImportedProject(importResult) {
  stopPlayback(true);
  if (!applyBoardData(importResult.project, { snapshotBefore: false })) {
    throw new Error('This play could not be imported. Your current board was not changed.');
  }
  S.history = [];
  S.future = [];
  sequenceDockView = 'primary';
  setTool('move');
  setHint(buildImportSuccessMessage(importResult));
  refreshInteractionUI();
}

function snapshot() {
  ensureWholeGamePlanHistoryStacks();
  S.history.push(captureWholeGamePlanHistoryEntry());
  if (S.history.length > 30) S.history.shift();
  S.future = [];
  scheduleAutosave();
}

function isWholeGamePlanHistoryEntry(entry) {
  return !!entry
    && typeof entry === 'object'
    && entry.historyVersion === 2
    && Array.isArray(entry.phases)
    && Number.isFinite(entry.currentPhase);
}

function ensureWholeGamePlanHistoryStacks() {
  const hasLegacyHistory = S.history.some(entry => !isWholeGamePlanHistoryEntry(entry))
    || S.future.some(entry => !isWholeGamePlanHistoryEntry(entry));
  if (!hasLegacyHistory) return false;
  S.history = [];
  S.future = [];
  return true;
}

function captureWholeGamePlanHistoryEntry() {
  const title = currentPlayTitle() || GamePlan.name || 'Untitled Play';
  const gamePlan = serializeGamePlan(title);
  return cloneData({
    historyVersion: 2,
    gamePlanName: gamePlan.name || title,
    currentPhase: gamePlan.currentPhase,
    phases: gamePlan.phases,
    playMetadata: S.playMetadata,
    projectId: S.projectId,
    projectMeta: S.projectMeta,
    projectPlayback: S.projectPlayback,
  });
}

function restoreWholeGamePlanHistoryEntry(entry) {
  if (!isWholeGamePlanHistoryEntry(entry)) return false;

  clearPendingCanonicalPhaseStart();
  stopPlayback(true);
  S.playAll = false;
  S.lastTs = null;
  S.animT = 0;

  const title = typeof entry.gamePlanName === 'string' && entry.gamePlanName.trim()
    ? entry.gamePlanName.trim()
    : 'Untitled Play';
  const restoredPhases = Array.isArray(entry.phases) && entry.phases.length
    ? entry.phases.map((phase, index) => normalizePhaseState(phase, index))
    : [normalizePhaseState({ label: 'Phase 1' }, 0)];

  GamePlan.name = title;
  GamePlan.phases = restoredPhases;
  GamePlan.currentPhase = clamp(Number(entry.currentPhase), 0, restoredPhases.length - 1);

  const activePhaseIndex = GamePlan.currentPhase;
  const activePhase = normalizePhaseState(GamePlan.phases[activePhaseIndex], activePhaseIndex);
  GamePlan.phases[activePhaseIndex] = activePhase;

  clearSelectedObject();
  S.selectedPlayerIds = [];
  S.selectedGroupId = null;
  S.selectedObjectType = null;
  S.selectedAnnotationIdValue = null;
  S.dragPlayerId = null;
  S.dragging = null;
  S.dragOff = { x: 0, y: 0 };
  S.drawing = null;
  S.passFrom = null;
  S.activePasserId = null;
  S.activeKickerId = null;
  S.activeRunSourceId = null;
  S.highlightedPlayerIds = [];
  S.pendingGroupPlacement = null;
  S.annotationDraft = null;
  S.ballAssignCandidate = null;
  S.pointerTap = null;
  S.moveGuideOrigins = {};
  clearPassKickState();

  setLiveBoardFromStep(activePhase.steps[activePhase.currentStep] || emptyStepState());
  S.projectId = entry.projectId || null;
  S.projectMeta = entry.projectMeta || null;
  S.playMetadata = entry.playMetadata ? cloneData(entry.playMetadata) : null;
  S.projectPlayback = entry.projectPlayback ? normalizePlaybackSettings(entry.projectPlayback) : null;
  currentPresetId = entry.projectMeta?.source === 'preset' && typeof entry.projectMeta?.presetId === 'string'
    ? entry.projectMeta.presetId
    : null;
  S.animSpd = S.projectPlayback?.currentSpeed || 1;
  spdIdx = Math.max(0, SPEEDS.indexOf(S.animSpd));

  document.getElementById('playName').value = title;
  document.getElementById('spdLabel').textContent = fmtSpd(S.animSpd);
  setPlayBtnState();
  updatePresetOptionsUI();
  updatePhaseUI();
  rebuildPalette();
  refreshInteractionUI();
  updateTL();
  render();
  return true;
}

function undo() {
  clearPendingCanonicalPhaseStart();
  ensureWholeGamePlanHistoryStacks();
  if (!S.history.length) return;
  S.future.push(captureWholeGamePlanHistoryEntry());
  if (S.future.length > 30) S.future.shift();
  const h = S.history.pop();
  restoreWholeGamePlanHistoryEntry(h);
  scheduleAutosave();
}
window.undo = undo;
function redo() {
  clearPendingCanonicalPhaseStart();
  if (!claimPhoneDataAction('more:redo')) return;
  ensureWholeGamePlanHistoryStacks();
  if (!S.future.length) return;
  S.history.push(captureWholeGamePlanHistoryEntry());
  if (S.history.length > 30) S.history.shift();
  const h = S.future.pop();
  restoreWholeGamePlanHistoryEntry(h);
  scheduleAutosave();
}
window.redo = redo;

function syncHistoryControls() {
  const editingLocked = !!S.animating;
  const undoDisabled = editingLocked || !(S.history && S.history.length);
  const redoDisabled = editingLocked || !(S.future && S.future.length);
  const bindings = [
    { id: 'topbarUndoBtn', disabled: undoDisabled, title: undoDisabled ? tr('dock.undo.none') : tr('dock.undo.ready') },
    { id: 'topbarRedoBtn', disabled: redoDisabled, title: redoDisabled ? tr('dock.redo.none') : tr('dock.redo.ready') },
    { id: 'mobileUndoBtn', disabled: undoDisabled, title: undoDisabled ? tr('dock.undo.none') : tr('dock.undo.ready') },
    { id: 'mobileRedoBtn', disabled: redoDisabled, title: redoDisabled ? tr('dock.redo.none') : tr('dock.redo.ready') },
    { id: 'mobileRailUndoBtn', disabled: undoDisabled, title: undoDisabled ? tr('dock.undo.none') : tr('dock.undo.ready') },
    { id: 'mobileMoreRedoBtn', disabled: redoDisabled, title: redoDisabled ? tr('dock.redo.none') : tr('dock.redo.ready') },
  ];
  bindings.forEach(({ id, disabled, title }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = disabled;
    el.title = title;
    el.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  });
}

//  FIELD RENDERING
function drawField() {
  const cacheKey = getStaticFieldCacheKey();
  if (!showGainline && staticFieldCanvas && staticFieldCacheKey === cacheKey) {
    ctx.clearRect(0, 0, cvW, cvH);
    ctx.drawImage(staticFieldCanvas, 0, 0, staticFieldCanvas.width / renderDpr, staticFieldCanvas.height / renderDpr);
    return;
  }
  ctx.clearRect(0, 0, cvW, cvH);

  // ── 1. Background ────────────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, 0, cvH);
  bgGrad.addColorStop(0, '#060d16');
  bgGrad.addColorStop(1, '#091420');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, cvW, cvH);

  const fieldStart = toC(0, F.YMIN);
  const fieldEnd = toC(F.W, F.YMAX);
  const fieldLeft = Math.min(fieldStart.x, fieldEnd.x);
  const fieldRight = Math.max(fieldStart.x, fieldEnd.x);
  const fieldTop = Math.min(fieldStart.y, fieldEnd.y);
  const fieldBottom = Math.max(fieldStart.y, fieldEnd.y);
  const FW = fieldRight - fieldLeft;
  const FH = fieldBottom - fieldTop;
  const goalTopY = Math.min(toC(0, 0).y, toC(F.W, 0).y);
  const goalBottomY = Math.max(toC(0, 100).y, toC(F.W, 100).y);

  // ── 2. Field drop shadow ─────────────────────────────────────────────────
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 28;
  ctx.fillStyle = 'rgba(0,0,0,0.01)';
  ctx.fillRect(fieldLeft, fieldTop, FW, FH);
  ctx.restore();

  // ── 3. Base grass — radial centre-bright ─────────────────────────────────
  const grassGrad = ctx.createRadialGradient(
    fieldLeft + FW * 0.5, fieldTop + FH * 0.5, Math.max(FW, FH) * 0.05,
    fieldLeft + FW * 0.5, fieldTop + FH * 0.5, Math.max(FW, FH) * 1.05
  );
  grassGrad.addColorStop(0,    '#2a7d36');
  grassGrad.addColorStop(0.55, '#236b2f');
  grassGrad.addColorStop(1,    '#1c5828');
  ctx.fillStyle = grassGrad;
  ctx.fillRect(fieldLeft, fieldTop, FW, FH);

  // ── 4. Mow stripes — field-axis bands so every orientation keeps the same grass texture ──
  const N_STRIPES = Math.max(8, S.stripeCount || 9);
  const stripeFieldLen = (F.YMAX - F.YMIN) / N_STRIPES;
  ctx.save();
  ctx.beginPath(); ctx.rect(fieldLeft, fieldTop, FW, FH); ctx.clip();
  for (let si = 0; si < N_STRIPES; si++) {
    const y0 = F.YMIN + si * stripeFieldLen;
    const y1 = Math.min(F.YMAX, y0 + stripeFieldLen);
    const p0 = toC(0, y0);
    const p1 = toC(F.W, y0);
    const p2 = toC(F.W, y1);
    const p3 = toC(0, y1);
    ctx.fillStyle = (si % 2 === 0) ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.11)';
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // ── 5. Noise texture ─────────────────────────────────────────────────────
  const tile = getGrassTile();
  if (tile) {
    const pat = ctx.createPattern(tile, 'repeat');
    if (pat) {
      ctx.save();
      ctx.globalAlpha = Math.max(0.04, S.textureStrength || 0.05);
      ctx.beginPath(); ctx.rect(fieldLeft, fieldTop, FW, FH); ctx.clip();
      ctx.fillStyle = pat;
      ctx.fillRect(fieldLeft, fieldTop, FW, FH);
      ctx.restore();
    }
  }

  // ── 6. In-goal areas — FIELD-SPACE quads (only the real in-goals in ANY orientation).
  //    The old screen-axis version filled ~the whole pitch in portrait (flipped Y), which
  //    flattened the mowing stripes. Draw the two in-goal zones as field polygons instead.
  [[F.YMIN, 0], [100, F.YMAX]].forEach(function (seg) {
    const q0 = toC(0, seg[0]), q1 = toC(F.W, seg[0]), q2 = toC(F.W, seg[1]), q3 = toC(0, seg[1]);
    ctx.fillStyle = 'rgba(22,60,32,0.55)';
    ctx.beginPath();
    ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.lineTo(q3.x, q3.y);
    ctx.closePath(); ctx.fill();
  });

  // ── 7. Vignette ──────────────────────────────────────────────────────────
  const vig = ctx.createRadialGradient(
    fieldLeft + FW * 0.5, fieldTop + FH * 0.5, Math.min(FW, FH) * 0.26,
    fieldLeft + FW * 0.5, fieldTop + FH * 0.5, Math.max(FW, FH) * 0.78
  );
  vig.addColorStop(0, 'rgba(0,0,0,0.00)');
  vig.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = vig;
  ctx.fillRect(fieldLeft, fieldTop, FW, FH);

  // ── 8. Line helpers — pixel-aligned for crisp rendering ──────────────────
  function hline(fy, color, lw, dash = [], x0 = 0, x1 = F.W, glow = 0) {
    const p = toC(x0, fy), q = toC(x1, fy);
    ctx.save();
    if (glow > 0) { ctx.shadowColor = `rgba(255,255,255,${glow})`; ctx.shadowBlur = 5; }
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    if (dash.length) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function vline(fx, color, lw, fy0 = F.YMIN, fy1 = F.YMAX, dash = [], glow = 0) {
    const p = toC(fx, fy0), q = toC(fx, fy1);
    ctx.save();
    if (glow > 0) { ctx.shadowColor = `rgba(255,255,255,${glow})`; ctx.shadowBlur = 5; }
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    if (dash.length) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Dash sizes — fixed pixel values for crisp broadcast-quality rendering
  const D_10M = [8, 6];   // tight professional dashes for 10m lines
  const D_5M  = [5, 5];   // subtle technical dashes for 5m guides

  // Line weight tiers
  const T1_C = 'rgba(255,255,255,0.97)', T1_W = Math.max(2.0, sc * 0.20);  // boundary + halfway
  const T2_C = 'rgba(255,255,255,0.88)', T2_W = Math.max(1.6, sc * 0.16);  // 22m
  const T3_C = 'rgba(255,255,255,0.75)', T3_W = Math.max(1.3, sc * 0.13);  // 10m dashed
  const T4_C = 'rgba(255,255,255,0.44)', T4_W = Math.max(1.0, sc * 0.10);  // 5m / technical

  // ── 9. Tier 1: Boundary, goal lines, halfway — with subtle painted glow ───
  hline(F.YMIN, T1_C, T1_W, [], 0, F.W, 0.22);
  hline(F.YMAX, T1_C, T1_W, [], 0, F.W, 0.22);
  hline(0,   T1_C, T1_W, [], 0, F.W, 0.28);
  hline(100, T1_C, T1_W, [], 0, F.W, 0.28);
  hline(50,  T1_C, T1_W, [], 0, F.W, 0.28);
  if (showGainline) {
    const p0 = toC(0, GAINLINE_Y), p1 = toC(68, GAINLINE_Y);
    const gainLeft = Math.min(p0.x, p1.x);
    const gainWidth = Math.abs(p1.x - p0.x);
    const gainY = p0.y;
    ctx.fillStyle = 'rgba(34,197,94,0.07)';
    ctx.fillRect(gainLeft, fieldTop, gainWidth, Math.abs(gainY - fieldTop));
    ctx.fillStyle = 'rgba(239,68,68,0.07)';
    ctx.fillRect(gainLeft, Math.min(gainY, fieldBottom), gainWidth, Math.abs(fieldBottom - gainY));

    ctx.save();
    ctx.strokeStyle = 'rgba(251,191,36,0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([sc * 1.2, sc * 0.6]);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
    ctx.stroke(); ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(251,191,36,0.8)';
    ctx.font = `bold ${Math.max(9, sc * 0.75)}px "Barlow Condensed"`;
    ctx.textAlign = 'right';
    const gainLabelY = clamp(gainY + (isPhoneViewport ? 14 : -4), fieldTop + 12, fieldBottom - 6);
    ctx.fillText('GAINLINE', toC(67, GAINLINE_Y).x, gainLabelY);
    ctx.restore();
  }
  vline(0,  T1_C, T1_W, F.YMIN, F.YMAX, [], 0.22);
  vline(68, T1_C, T1_W, F.YMIN, F.YMAX, [], 0.22);

  // ── 10. Tier 2: 22m lines ────────────────────────────────────────────────
  hline(22, T2_C, T2_W, [], 0, F.W, 0.18);
  hline(78, T2_C, T2_W, [], 0, F.W, 0.18);

  // ── 11. 10m lines — bold painted blocks matching vertical dash scale ───────
  {
    const d10Px  = Math.max(22, sx * 5);   // ~5m in x-direction
    const g10Px  = Math.max(13, sx * 3);   // ~3m gap
    const lw10   = T2_W * 1.2;
    const col10  = 'rgba(255,255,255,0.88)';
    hline(40, col10, lw10, [d10Px, g10Px]);
    hline(60, col10, lw10, [d10Px, g10Px]);
  }

  // ── 12. 5m and 15m: large field-scaled dashes, anchor-synced alignment ───
  {
    // Dash = 5 field-units (~5m), gap = 3 field-units (~3m)
    const dashPx = Math.max(22, sy * 5);
    const gapPx  = Math.max(13, sy * 3);
    // 20% thicker than 22m lines, butt caps for painted-on look
    const vLW15 = T2_W * 1.2;
    const vLW5  = T2_W * 1.2;

    // Anchor rows — draw each segment independently with dashOffset = -dashPx/2
    // so every major horizontal intersection is guaranteed a centered dash
    const ANCHORS = [0, 22, 40, 50, 60, 78, 100];

    function syncedDashV(fx, color, lw) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth   = lw;
      ctx.lineCap     = 'butt';
      ctx.setLineDash([dashPx, gapPx]);
      for (let i = 0; i < ANCHORS.length - 1; i++) {
        const p0 = toC(fx, ANCHORS[i]);
        const p1 = toC(fx, ANCHORS[i + 1]);
        // Center a dash exactly at y0 (the anchor intersection)
        ctx.lineDashOffset = -dashPx / 2;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.restore();
    }

    // Dashes are anchor-synced — no separate T-marks needed
    syncedDashV(15, 'rgba(255,255,255,0.90)', vLW15);
    syncedDashV(53, 'rgba(255,255,255,0.90)', vLW15);
    syncedDashV(5,  'rgba(255,255,255,0.82)', vLW5);
    syncedDashV(63, 'rgba(255,255,255,0.82)', vLW5);
  }

  // ── 14. Center mark ───────────────────────────────────────────────────────
  const cm = toC(34, 50);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.90)';
  ctx.beginPath();
  ctx.arc(cm.x, cm.y, Math.max(2.6, sc * 0.25), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 15. Field labels — bold Montserrat, near sidelines ──────────────────
  function fieldLabel(fx, fy, text, alpha = 0.30) {
    const p  = toC(fx, fy);
    const fs = Math.max(10, sc * 1.05);
    ctx.save();
    ctx.font = `700 ${fs}px "Montserrat","Barlow Condensed","Arial Narrow",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillText(text, p.x, p.y);
    ctx.restore();
  }

  fieldLabel(34, 47.5, '50', 0.48);
  fieldLabel(4.2, 20.6, '22', 0.48); fieldLabel(63.8, 20.6, '22', 0.48);
  fieldLabel(4.2, 79.4, '22', 0.48); fieldLabel(63.8, 79.4, '22', 0.48);
  fieldLabel(4.2, 38.6, '10', 0.48); fieldLabel(63.8, 38.6, '10', 0.48);
  fieldLabel(4.2, 61.4, '10', 0.48); fieldLabel(63.8, 61.4, '10', 0.48);
  fieldLabel(34, -5,  'IN-GOAL', 0.56);
  fieldLabel(34, 105, 'IN-GOAL', 0.56);

  // ── 16. Goal posts ────────────────────────────────────────────────────────
  isPhoneViewport ? drawTopViewPosts(34, 0) : drawPosts(34, 0, 'top');
  isPhoneViewport ? drawTopViewPosts(34, 100) : drawPosts(34, 100, 'bottom');
  if (!showGainline) {
    ensureStaticFieldSnapshotBuffer();
    staticFieldCtx.setTransform(1, 0, 0, 1, 0, 0);
    staticFieldCtx.clearRect(0, 0, staticFieldCanvas.width, staticFieldCanvas.height);
    staticFieldCtx.drawImage(cv, 0, 0);
    staticFieldCtx.setTransform(renderDpr, 0, 0, renderDpr, 0, 0);
    staticFieldCacheKey = cacheKey;
  }
}

function drawPosts(fx, fy, side) {
  const base = toC(fx, fy);
  const dir  = side === 'top' ? -1 : 1;

  // Geometry — proportional to field scale, real-world basis
  // Uprights: 5.6m apart, centred on goal line
  // Crossbar: 3.0m from goal line into in-goal
  // Uprights extend 12m above crossbar (long for visibility)
  const halfW       = (5.6 / 2) * sx;          // half-gap between posts
  const crossDist   = 3.2 * sy;                 // crossbar distance from goal line
  const postLen     = 10.5 * sy;                // upright length beyond crossbar
  const postW       = Math.max(2.6, sc * 0.26); // post stroke width
  const baseW       = Math.max(1.8, sc * 0.17); // base stem width

  const tryLineY  = base.y;
  const crossbarY = tryLineY + dir * crossDist;
  const postTopY  = crossbarY + dir * postLen;
  const leftX     = base.x - halfW;
  const rightX    = base.x + halfW;

  ctx.save();

  // ── Pass 1: deep drop shadow (offset toward field) ───────────────────────
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = postW + 3.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const sdx = 1.5, sdy = dir * 1.5;
  ctx.beginPath();
  ctx.moveTo(leftX  + sdx, tryLineY + sdy); ctx.lineTo(leftX  + sdx, crossbarY + sdy);
  ctx.moveTo(rightX + sdx, tryLineY + sdy); ctx.lineTo(rightX + sdx, crossbarY + sdy);
  ctx.moveTo(leftX  + sdx, crossbarY + sdy); ctx.lineTo(rightX + sdx, crossbarY + sdy);
  ctx.moveTo(leftX  + sdx, crossbarY + sdy); ctx.lineTo(leftX  + sdx, postTopY + sdy);
  ctx.moveTo(rightX + sdx, crossbarY + sdy); ctx.lineTo(rightX + sdx, postTopY + sdy);
  ctx.stroke();

  // ── Pass 2: glow halo around full H ──────────────────────────────────────
  ctx.strokeStyle = 'rgba(255,252,220,0.12)';
  ctx.lineWidth = postW + 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(leftX,  crossbarY); ctx.lineTo(rightX, crossbarY);
  ctx.moveTo(leftX,  crossbarY); ctx.lineTo(leftX,  postTopY);
  ctx.moveTo(rightX, crossbarY); ctx.lineTo(rightX, postTopY);
  ctx.stroke();

  // ── Pass 3: base stems (goal line → crossbar) — ghost/translucent ────────
  ctx.strokeStyle = 'rgba(240,240,220,0.38)';
  ctx.lineWidth = baseW;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(leftX,  tryLineY); ctx.lineTo(leftX,  crossbarY);
  ctx.moveTo(rightX, tryLineY); ctx.lineTo(rightX, crossbarY);
  ctx.stroke();

  // ── Pass 4: main H — warm metallic white + 3D drop shadow ───────────────
  ctx.strokeStyle   = 'rgba(255,253,235,0.96)';
  ctx.lineWidth     = postW;
  ctx.lineCap       = 'square';
  ctx.lineJoin      = 'miter';
  ctx.shadowColor   = 'rgba(0,0,0,0.50)';
  ctx.shadowBlur    = 5;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = dir * 3;
  ctx.beginPath();
  ctx.moveTo(leftX,  crossbarY); ctx.lineTo(rightX, crossbarY);
  ctx.moveTo(leftX,  crossbarY); ctx.lineTo(leftX,  postTopY);
  ctx.moveTo(rightX, crossbarY); ctx.lineTo(rightX, postTopY);
  ctx.stroke();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

  // ── Pass 5: highlight edge (left side of each upright) ───────────────────
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(1, postW * 0.35);
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(leftX  - 0.8, crossbarY); ctx.lineTo(leftX  - 0.8, postTopY);
  ctx.moveTo(rightX - 0.8, crossbarY); ctx.lineTo(rightX - 0.8, postTopY);
  ctx.stroke();

  // ── Pass 6: base anchor dots ─────────────────────────────────────────────
  const dotR = Math.max(2.4, sc * 0.24);
  ctx.fillStyle = 'rgba(255,253,220,0.92)';
  ctx.shadowColor = 'rgba(0,0,0,0.40)'; ctx.shadowBlur = 3;
  ctx.beginPath(); ctx.arc(leftX,  tryLineY, dotR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(rightX, tryLineY, dotR, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawTopViewPosts(fx, fy) {
  const dir = fy <= 50 ? -1 : 1;
  const halfSpan = 2.8;
  const uprightDepth = isPhoneViewport ? 2.35 : 2.9;
  const baseDepth = isPhoneViewport ? 0.6 : 0.78;
  const leftBase = toC(fx - halfSpan, fy);
  const rightBase = toC(fx + halfSpan, fy);
  const leftBack = toC(fx - halfSpan, fy + dir * uprightDepth);
  const rightBack = toC(fx + halfSpan, fy + dir * uprightDepth);
  const leftStem = toC(fx - halfSpan, fy + dir * baseDepth);
  const rightStem = toC(fx + halfSpan, fy + dir * baseDepth);
  const postW = Math.max(isPhoneViewport ? 1.9 : 2.4, sc * (isPhoneViewport ? 0.18 : 0.22));
  const highlightW = Math.max(1, postW * 0.34);
  const baseW = Math.max(isPhoneViewport ? 5.5 : 7.2, sc * (isPhoneViewport ? 0.68 : 0.84));
  const baseH = Math.max(isPhoneViewport ? 2.2 : 2.8, sc * (isPhoneViewport ? 0.28 : 0.34));
  const baseOffset = dir * (baseH * 0.25);
  const gold = 'rgba(227,178,60,0.9)';

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.34)';
  ctx.lineWidth = postW + 2.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(leftBase.x + 1.1, leftBase.y + 1.1); ctx.lineTo(rightBase.x + 1.1, rightBase.y + 1.1);
  ctx.moveTo(leftBase.x + 1.1, leftBase.y + 1.1); ctx.lineTo(leftBack.x + 1.1, leftBack.y + 1.1);
  ctx.moveTo(rightBase.x + 1.1, rightBase.y + 1.1); ctx.lineTo(rightBack.x + 1.1, rightBack.y + 1.1);
  ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.fillRect(leftBase.x - (baseW / 2) + 0.9, leftBase.y - (baseH / 2) + baseOffset + 1.1, baseW, baseH);
  ctx.fillRect(rightBase.x - (baseW / 2) + 0.9, rightBase.y - (baseH / 2) + baseOffset + 1.1, baseW, baseH);

  ctx.fillStyle = 'rgba(255,250,232,0.95)';
  ctx.fillRect(leftBase.x - (baseW / 2), leftBase.y - (baseH / 2) + baseOffset, baseW, baseH);
  ctx.fillRect(rightBase.x - (baseW / 2), rightBase.y - (baseH / 2) + baseOffset, baseW, baseH);

  ctx.strokeStyle = 'rgba(255,249,220,0.96)';
  ctx.lineWidth = postW;
  ctx.beginPath();
  ctx.moveTo(leftBase.x, leftBase.y); ctx.lineTo(rightBase.x, rightBase.y);
  ctx.moveTo(leftStem.x, leftStem.y); ctx.lineTo(leftBack.x, leftBack.y);
  ctx.moveTo(rightStem.x, rightStem.y); ctx.lineTo(rightBack.x, rightBack.y);
  ctx.stroke();

  ctx.strokeStyle = gold;
  ctx.lineWidth = highlightW;
  ctx.beginPath();
  ctx.moveTo(leftBase.x, leftBase.y - 0.7); ctx.lineTo(rightBase.x, rightBase.y - 0.7);
  ctx.moveTo(leftStem.x - 0.7, leftStem.y); ctx.lineTo(leftBack.x - 0.7, leftBack.y);
  ctx.moveTo(rightStem.x - 0.7, rightStem.y); ctx.lineTo(rightBack.x - 0.7, rightBack.y);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.44)';
  ctx.lineWidth = Math.max(0.9, highlightW * 0.7);
  ctx.beginPath();
  ctx.moveTo(leftStem.x + 0.7, leftStem.y); ctx.lineTo(leftBack.x + 0.7, leftBack.y);
  ctx.moveTo(rightStem.x + 0.7, rightStem.y); ctx.lineTo(rightBack.x + 0.7, rightBack.y);
  ctx.stroke();
  ctx.restore();
}

function drawFieldLabel(fx, fy, text, wide = false) {
  const p = toC(fx, fy);
  const fontSize = Math.max(8, sc * (wide ? 0.95 : 0.86));
  ctx.save();
  ctx.font = `700 ${fontSize}px "Barlow Condensed"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const padX = wide ? 10 : 7;
  const padY = 4;
  const w = ctx.measureText(text).width + padX * 2;
  const h = fontSize + padY * 2;
  roundRect(ctx, p.x - w / 2, p.y - h / 2, w, h, 999);
  ctx.fillStyle = 'rgba(6,17,26,0.42)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = wide ? 'rgba(255,255,255,0.44)' : 'rgba(255,255,255,0.58)';
  ctx.fillText(text, p.x, p.y + 0.5);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

//  PLAYER RENDERING
function playerColorPalette(player) {
  const baseGroup = activeGroupForPlayer(player) || groupForPlayer(player);
  const color = player?.colorOverride || baseGroup?.color || '';
  if (!color) {
    return player?.team === 'A'
      ? { fill: '#2563eb', border: '#93c5fd', glow: '#3b82f6' }
      : { fill: '#dc2626', border: '#fca5a5', glow: '#ef4444' };
  }
  return {
    fill: color,
    border: lightenHex(color, 72),
    glow: lightenHex(color, 26),
  };
}

function drawPlayer(fx, fy, num, team, selected, isBallCarrier, palette = null) {
  const p = toC(fx, fy);
  const r = isMobileBoardViewport() ? Math.max(R(), 16) : R();
  const fill = palette?.fill || (team === 'A' ? '#2563eb' : '#dc2626');
  const border = palette?.border || (team === 'A' ? '#93c5fd' : '#fca5a5');
  const glow = palette?.glow || (team === 'A' ? '#3b82f6' : '#ef4444');

  ctx.save();

  // Contrast halo
  ctx.beginPath();
  ctx.arc(p.x, p.y, r + 2.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(7,16,24,0.45)';
  ctx.fill();

  // Selection ring
  if (selected) {
    ctx.beginPath(); ctx.arc(p.x, p.y, r + (isMobileBoardViewport() ? 3 : 4), 0, Math.PI * 2);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = isMobileBoardViewport() ? 2 : 2.5;
    ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
  }
  // Drop shadow
  ctx.beginPath(); ctx.arc(p.x + 1.5, p.y + 2, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();

  // Body gradient
  const g = ctx.createRadialGradient(p.x - r * 0.25, p.y - r * 0.25, r * 0.1, p.x, p.y, r);
  g.addColorStop(0, lighten(fill, 35));
  g.addColorStop(1, fill);
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();

  // Border
  ctx.strokeStyle = selected ? '#fbbf24' : border;
  ctx.lineWidth   = selected ? (isMobileBoardViewport() ? 2 : 2.5) : (isMobileBoardViewport() ? 1.5 : 1.8);
  ctx.stroke();

  // Number
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${Math.max(10, r * (isMobileBoardViewport() ? 0.98 : 0.94))}px "Barlow Condensed"`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 4;
  ctx.fillText(String(num), p.x, p.y + 0.5);
  ctx.shadowBlur = 0;

  ctx.restore();
}

function drawBall(fx, fy, selected) {
  const p = toC(fx, fy);
  const rx = Math.max(isMobileBoardViewport() ? 7.6 : 8.5, sc * (isMobileBoardViewport() ? 0.76 : 0.84));
  const ry = Math.max(isMobileBoardViewport() ? 5 : 5.5, sc * (isMobileBoardViewport() ? 0.48 : 0.54));
  ctx.save();
  if (selected) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = isMobileBoardViewport() ? 10 : 14; }

  if (boardBallAssetReady) {
    const w = rx * 3.25;
    const h = ry * 3.45;
    ctx.shadowColor = selected ? '#fbbf24' : 'rgba(4,10,8,0.42)';
    ctx.shadowBlur = selected ? (isMobileBoardViewport() ? 10 : 14) : (isMobileBoardViewport() ? 5 : 8);
    ctx.drawImage(boardBallAsset, p.x - w * 0.52, p.y - h * 0.5, w, h);

    if (selected) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(251,191,36,0.9)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx + 2, ry + 2, 0.22, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
    return;
  }

  ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0.35, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(p.x - rx, p.y, p.x + rx, p.y);
  g.addColorStop(0, '#d4a853'); g.addColorStop(0.4, '#e8c07a'); g.addColorStop(1, '#b8894a');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();

  // Seam line
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(p.x - rx * 0.5, p.y); ctx.lineTo(p.x + rx * 0.5, p.y); ctx.stroke();
  // Lace marks
  [-rx*0.2, 0, rx*0.2].forEach(dx => {
    ctx.beginPath(); ctx.moveTo(p.x+dx, p.y-ry*0.35); ctx.lineTo(p.x+dx, p.y+ry*0.35); ctx.stroke();
  });
  ctx.restore();
}

function drawBallCarrierHighlight(fx, fy) {
  const p = toC(fx, fy);
  const r = R();
  ctx.save();
  const bx = p.x + r * 0.68;
  const by = p.y - r * 0.7;
  ctx.beginPath();
  ctx.arc(bx, by, r * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = '#fbbf24';
  ctx.fill();
  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawPathOriginMarker(fx, fy, palette = null) {
  const p = toC(fx, fy);
  const r = isPhoneViewport ? Math.max(5.5, R() * 0.52) : Math.max(7, R() * 0.6);
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = palette?.border || 'rgba(255,255,255,0.7)';
  ctx.lineWidth = isPhoneViewport ? 1.6 : 2;
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function renderPathOriginMarkers(players = S.players, paths = S.paths) {
  if (!S.showGhostPrevious) return;
  if (isPhoneViewport) return;
  paths.forEach((path) => {
    if (!Array.isArray(path?.pts) || path.pts.length < 2) return;
    const pl = players.find((player) => player.id === path.pid);
    if (!pl) return;
    const origin = path.pts[0];
    if (d2(origin, { x: pl.x, y: pl.y }) < 0.75) return;
    drawPathOriginMarker(origin.x, origin.y, playerColorPalette(pl));
  });
}

function drawMovementGuideLine(start, end, color) {
  const a = toC(start.x, start.y);
  const b = toC(end.x, end.y);
  ctx.save();
  ctx.strokeStyle = 'rgba(7,16,24,0.38)';
  ctx.lineWidth = isPhoneViewport ? 4.2 : 4.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = isPhoneViewport ? 2.3 : 2.6;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function renderPhoneEditMovementGuides() {
  // Ghost Preview has no visible effect on phone: its control is not shown
  // there, and this overlay (the only ghost-related renderer that ever ran
  // on phone) must stay suppressed even if the underlying desktop preference
  // (S.showGhostPrevious) is left on from a previous desktop session.
  if (isPhoneViewport) return;
  if (!S.showGhostPrevious) return;
  if (S.animating) return;
  const baseStep = S.currentStepBaseline || S.steps?.[S.currentStep];
  const baseLookup = baseStep?.players?.length ? buildStepLookup(baseStep.players) : new Map();
  S.players.forEach((player) => {
    const start = S.moveGuideOrigins?.[player.id] || baseLookup.get(playerKey(player));
    if (!start) return;
    const end = { x: player.x, y: player.y };
    if (d2(start, end) < 0.75) return;
    const palette = playerColorPalette(player);
    drawMovementGuideLine(start, end, palette.fill);
    drawPathOriginMarker(start.x, start.y, palette);
  });
}

function lighten(hex, amt) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, ((n>>16)&0xff) + amt);
  const g = Math.min(255, ((n>>8)&0xff) + amt);
  const b = Math.min(255, (n&0xff) + amt);
  return `rgb(${r},${g},${b})`;
}

function lightenHex(hex, amt) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `rgb(${r},${g},${b})`;
}

//  PATH RENDERING
function drawRunPath(pts, color, lw, progress = 1, dashed = false, selected = false) {
  if (!pts || pts.length < 2) return;
  ctx.save();

  const STEPS = Math.max(40, pts.length * 12);
  const drawSteps = Math.floor(progress * STEPS);

  if (selected) {
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.lineWidth = lw + 10;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= drawSteps; i++) {
      const pos = catmullRom(pts, i / STEPS);
      const p = toC(pos.x, pos.y);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(7,16,24,0.45)';
  ctx.lineWidth   = lw + 3.6;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  for (let i = 0; i <= drawSteps; i++) {
    const t = i / STEPS;
    const pos = catmullRom(pts, t);
    const p   = toC(pos.x, pos.y);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth   = lw;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  if (dashed) ctx.setLineDash([sc * 0.7, sc * 0.4]);

  // Sample Catmull-Rom spline
  ctx.beginPath();
  for (let i = 0; i <= drawSteps; i++) {
    const t = i / STEPS;
    const pos = catmullRom(pts, t);
    const p   = toC(pos.x, pos.y);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead at current end
  if (progress > 0.05) {
    const t1 = Math.max(0, progress - 0.04);
    const t2 = progress;
    const a  = catmullRom(pts, t1);
    const b  = catmullRom(pts, t2);
    const ep = toC(b.x, b.y);
    const ang = Math.atan2((b.y - a.y) * sc, (b.x - a.x) * sc);
    const as  = Math.max(7, lw * 3.5);
    ctx.beginPath();
    ctx.moveTo(ep.x, ep.y);
    ctx.lineTo(ep.x - as * Math.cos(ang - 0.4), ep.y - as * Math.sin(ang - 0.4));
    ctx.lineTo(ep.x - as * Math.cos(ang + 0.4), ep.y - as * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
  }
  ctx.restore();
}

// Catmull-Rom spline interpolation
function catmullRom(pts, t) {
  if (pts.length === 0) return {x:0,y:0};
  if (pts.length === 1) return pts[0];
  if (pts.length === 2) {
    return { x: pts[0].x + (pts[1].x-pts[0].x)*t, y: pts[0].y + (pts[1].y-pts[0].y)*t };
  }
  const n   = pts.length - 1;
  const seg = Math.min(Math.floor(t * n), n - 1);
  const u   = t * n - seg;
  const p0  = pts[Math.max(0, seg-1)];
  const p1  = pts[seg];
  const p2  = pts[Math.min(n, seg+1)];
  const p3  = pts[Math.min(n, seg+2)];
  const cu  = u * u, cu3 = u * cu;
  return {
    x: 0.5*((2*p1.x)+(-p0.x+p2.x)*u+(2*p0.x-5*p1.x+4*p2.x-p3.x)*cu+(-p0.x+3*p1.x-3*p2.x+p3.x)*cu3),
    y: 0.5*((2*p1.y)+(-p0.y+p2.y)*u+(2*p0.y-5*p1.y+4*p2.y-p3.y)*cu+(-p0.y+3*p1.y-3*p2.y+p3.y)*cu3),
  };
}

function distPointToSegmentPx(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function hitKickPath(fp) {
  const HIT_DIST = 14;
  const cp = toC(fp.x, fp.y);
  for (let i = S.passes.length - 1; i >= 0; i--) {
    const pass = S.passes[i];
    if (pass.style !== 'kick') continue;
    const fromPl = S.players.find(p => p.id === pass.from);
    if (!fromPl) continue;
    const p1 = toC(fromPl.x, fromPl.y);
    let p2;
    if (pass.to === null && pass.targetX !== undefined) {
      p2 = toC(pass.targetX, pass.targetY);
    } else if (pass.to) {
      const toPl = S.players.find(p => p.id === pass.to);
      if (!toPl) continue;
      p2 = toC(toPl.x, toPl.y);
    } else continue;
    if (distPointToSegmentPx(cp, p1, p2) <= HIT_DIST) return i;
  }
  return -1;
}

function hitRunPath(fp) {
  const HIT_DIST = 16;
  const cp = toC(fp.x, fp.y);
  for (let i = S.paths.length - 1; i >= 0; i--) {
    const path = S.paths[i];
    if (!path.pts || path.pts.length < 2) continue;
    const STEPS = Math.max(20, path.pts.length * 8);
    for (let s = 0; s < STEPS - 1; s++) {
      const a = toC(catmullRom(path.pts, s / STEPS).x, catmullRom(path.pts, s / STEPS).y);
      const b = toC(catmullRom(path.pts, (s + 1) / STEPS).x, catmullRom(path.pts, (s + 1) / STEPS).y);
      if (distPointToSegmentPx(cp, a, b) <= HIT_DIST) return path.pid;
    }
  }
  return null;
}

function hitPassLine(fp) {
  const HIT_DIST = 14;
  const cp = toC(fp.x, fp.y);
  for (let i = S.passes.length - 1; i >= 0; i--) {
    const pass = S.passes[i];
    if (pass.style !== 'pass') continue;
    const fromPl = S.players.find(p => p.id === pass.from);
    const toPl = S.players.find(p => p.id === pass.to);
    if (!fromPl || !toPl) continue;
    const p1 = toC(fromPl.x, fromPl.y);
    const p2 = toC(toPl.x, toPl.y);
    if (distPointToSegmentPx(cp, p1, p2) <= HIT_DIST) return i;
  }
  return -1;
}

function drawKickLine(x1, y1, x2, y2, progress = 1, selected = false) {
  const p1 = toC(x1, y1), p2 = toC(x2, y2);
  const ex = p1.x + (p2.x - p1.x) * progress;
  const ey = p1.y + (p2.y - p1.y) * progress;
  const color = selected ? '#fbbf24' : '#f59e0b';
  const lineW = selected ? 3.0 : 2.2;

  ctx.save();
  if (selected) {
    ctx.strokeStyle = 'rgba(251,191,36,0.25)';
    ctx.lineWidth = lineW + 8;
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(ex, ey); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(7,16,24,0.42)';
  ctx.lineWidth = lineW + 2.6;
  ctx.setLineDash([sc * 0.6, sc * 0.35]);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.setLineDash([sc * 0.6, sc * 0.35]);
  ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.setLineDash([]);
  if (progress > 0.85) {
    const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const as = 8;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - as * Math.cos(ang - 0.38), ey - as * Math.sin(ang - 0.38));
    ctx.lineTo(ex - as * Math.cos(ang + 0.38), ey - as * Math.sin(ang + 0.38));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  ctx.restore();
}

function drawKickToTarget(x1, y1, x2, y2, progress = 1, selected = false) {
  drawKickLine(x1, y1, x2, y2, progress, selected);
  if (progress > 0.5) {
    const tp = toC(x2, y2);
    const alpha = Math.min(1, (progress - 0.5) * 2) * 0.82;
    const landColor = selected ? '#fbbf24' : '#f59e0b';
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = landColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(tp.x, tp.y, 8 * Math.min(1, sc / 8), 0, Math.PI * 2);
    ctx.stroke();
    const cross = 5 * Math.min(1, sc / 8);
    ctx.beginPath();
    ctx.moveTo(tp.x - cross, tp.y - cross); ctx.lineTo(tp.x + cross, tp.y + cross);
    ctx.moveTo(tp.x + cross, tp.y - cross); ctx.lineTo(tp.x - cross, tp.y + cross);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function drawArc(x1, y1, x2, y2, color, progress = 1, thick = false, selected = false) {
  const p1 = toC(x1, y1), p2 = toC(x2, y2);
  const dist = Math.hypot(p2.x-p1.x, p2.y-p1.y);
  const cpx  = (p1.x+p2.x)/2 + (p2.y-p1.y)*0.28;
  const cpy  = (p1.y+p2.y)/2 - (p2.x-p1.x)*0.28;
  const STEPS = 30;

  ctx.save();
  if (selected) {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y);
    for (let i = 1; i <= Math.round(progress * STEPS); i++) {
      const t = i / STEPS;
      ctx.lineTo((1-t)*(1-t)*p1.x + 2*(1-t)*t*cpx + t*t*p2.x, (1-t)*(1-t)*p1.y + 2*(1-t)*t*cpy + t*t*p2.y);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(7,16,24,0.42)';
  ctx.lineWidth   = (thick ? 2.2 : 1.8) + 2.6;
  ctx.setLineDash([sc*0.6, sc*0.35]);
  ctx.lineCap = 'round';

  ctx.beginPath(); ctx.moveTo(p1.x, p1.y);
  for (let i = 1; i <= Math.round(progress * STEPS); i++) {
    const t  = i / STEPS;
    const bx = (1-t)*(1-t)*p1.x + 2*(1-t)*t*cpx + t*t*p2.x;
    const by = (1-t)*(1-t)*p1.y + 2*(1-t)*t*cpy + t*t*p2.y;
    ctx.lineTo(bx, by);
  }
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth   = thick ? 2.2 : 1.8;
  ctx.setLineDash([sc*0.6, sc*0.35]);
  ctx.lineCap = 'round';

  ctx.beginPath(); ctx.moveTo(p1.x, p1.y);
  for (let i = 1; i <= Math.round(progress * STEPS); i++) {
    const t  = i / STEPS;
    const bx = (1-t)*(1-t)*p1.x + 2*(1-t)*t*cpx + t*t*p2.x;
    const by = (1-t)*(1-t)*p1.y + 2*(1-t)*t*cpy + t*t*p2.y;
    ctx.lineTo(bx, by);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead at end
  if (progress > 0.85) {
    const t2 = 0.95, t1 = 0.90;
    const ax1 = (1-t1)*(1-t1)*p1.x + 2*(1-t1)*t1*cpx + t1*t1*p2.x;
    const ay1 = (1-t1)*(1-t1)*p1.y + 2*(1-t1)*t1*cpy + t1*t1*p2.y;
    const ax2 = (1-t2)*(1-t2)*p1.x + 2*(1-t2)*t2*cpx + t2*t2*p2.x;
    const ay2 = (1-t2)*(1-t2)*p1.y + 2*(1-t2)*t2*cpy + t2*t2*p2.y;
    const ang  = Math.atan2(ay2-ay1, ax2-ax1);
    const as   = 8;
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x - as*Math.cos(ang-0.38), p2.y - as*Math.sin(ang-0.38));
    ctx.lineTo(p2.x - as*Math.cos(ang+0.38), p2.y - as*Math.sin(ang+0.38));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  ctx.restore();
}

function noteMetrics(note) {
  const { width: widthField, height: heightField } = noteDimensions(note);
  const width = widthField * sc;
  const height = heightField * sc;
  const align = noteAlignValue(note);
  const paddingX = Math.max(1, Math.min(NOTE_PADDING_X * sc, width * 0.12));
  const paddingY = Math.max(1, Math.min(NOTE_PADDING_Y * sc, height * 0.12));
  const minFontSize = Math.max(0.9, sc * 0.08);
  const maxFontSize = Math.max(42, sc * 14);
  const preferredFontSize = clamp(height * 0.72, minFontSize, maxFontSize);
  const innerWidth = Math.max(2, width - (paddingX * 2));
  const innerHeight = Math.max(2, height - (paddingY * 2));
  const cornerRadius = Math.max(9, Math.min(18, Math.min(width, height) * 0.18));
  const measure = (value, fontSize) => {
    ctx.save();
    ctx.font = `700 ${fontSize}px ${NOTE_FONT}`;
    const size = ctx.measureText(value).width;
    ctx.restore();
    return size;
  };
  const wrapText = (value, fontSize) => {
    const source = String(value ?? ANNOTATION_NOTE_DEFAULT).replace(/\r\n?/g, '\n');
    const rawLines = source.split('\n');
    const wrapped = [];
    rawLines.forEach((rawLine, rawIndex) => {
      if (!rawLine.length) {
        wrapped.push('');
      } else {
        let remaining = rawLine;
        while (remaining.length) {
          let fitIndex = 0;
          let lastWhitespaceFit = -1;
          for (let idx = 1; idx <= remaining.length; idx++) {
            const segment = remaining.slice(0, idx);
            if (measure(segment, fontSize) <= innerWidth + 0.01) {
              fitIndex = idx;
              if (/\s/.test(remaining[idx - 1])) lastWhitespaceFit = idx;
            } else {
              break;
            }
          }
          if (!fitIndex) {
            wrapped.push(remaining[0]);
            remaining = remaining.slice(1);
            continue;
          }
          const breakIndex = fitIndex < remaining.length && lastWhitespaceFit > 0
            ? lastWhitespaceFit
            : fitIndex;
          wrapped.push(remaining.slice(0, breakIndex));
          remaining = remaining.slice(breakIndex);
        }
      }
      if (rawIndex < rawLines.length - 1 && !rawLine.length) {
        return;
      }
    });
    return wrapped.length ? wrapped : [ANNOTATION_NOTE_DEFAULT];
  };

  let fontSize = preferredFontSize;
  let lines = wrapText(note.text ?? ANNOTATION_NOTE_DEFAULT, fontSize);
  let lineHeight = Math.max(fontSize + 0.3, fontSize * 1.04);
  while (fontSize > minFontSize) {
    const totalTextHeight = lines.length * lineHeight;
    const fitsWidth = lines.every((line) => measure(line || '', fontSize) <= innerWidth + 0.01);
    if (fitsWidth && totalTextHeight <= innerHeight + 0.01) {
      break;
    }
    fontSize = Math.max(minFontSize, fontSize - 0.25);
    lines = wrapText(note.text ?? ANNOTATION_NOTE_DEFAULT, fontSize);
    lineHeight = Math.max(fontSize + 0.3, fontSize * 1.04);
  }
  const visibleLines = lines;
  const clipped = false;
  const lineWidths = visibleLines.map((line) => measure(line || '', fontSize));

  return {
    width,
    height,
    widthField,
    heightField,
    paddingX,
    paddingY,
    innerWidth,
    innerHeight,
    fontSize,
    lineHeight,
    cornerRadius,
    align,
    lines,
    visibleLines,
    lineWidths,
    clipped,
  };
}
window.__noteBox = noteMetrics;

function noteAnnotationBounds(note) {
  const box = noteMetrics(note);
  const halfW = box.widthField / 2;
  const halfH = box.heightField / 2;
  return {
    left: note.x - halfW,
    right: note.x + halfW,
    top: note.y - halfH,
    bottom: note.y + halfH,
    width: halfW * 2,
    height: halfH * 2,
  };
}

function noteAnnotationCorners(note) {
  const bounds = noteAnnotationBounds(note);
  return {
    nw: { x: bounds.left, y: bounds.top },
    ne: { x: bounds.right, y: bounds.top },
    sw: { x: bounds.left, y: bounds.bottom },
    se: { x: bounds.right, y: bounds.bottom },
  };
}

function drawAnnotationHandleAtFieldPoint(point, size = 6.2) {
  const handle = toC(point.x, point.y);
  const half = size / 2;
  const corner = Math.max(2, size * 0.22);
  ctx.beginPath();
  roundRect(ctx, handle.x - half, handle.y - half, size, size, corner);
  ctx.fill();
  ctx.stroke();
}

function noteHandleSizePx() {
  const dpr = window.devicePixelRatio || 1;
  return Math.max(6, Math.min(8, 6 * dpr));
}

function noteHandleHitRadiusField(note) {
  const handleSize = noteHandleSizePx();
  const generousRadiusPx = Math.max(handleSize * 1.7, 11);
  const baseRadius = (generousRadiusPx / Math.max(sc, 0.001)) + NOTE_HANDLE_HIT_PADDING;
  const bounds = noteAnnotationBounds(note);
  const minDimension = Math.min(bounds.width, bounds.height);
  const centerToCorner = Math.hypot(bounds.width / 2, bounds.height / 2);
  const cappedRadius = Math.max(0.55, Math.min(minDimension * 0.45, centerToCorner * 0.7));
  return Math.min(baseRadius, cappedRadius);
}

function clearPendingNoteSelectionClear({ resetTap = false } = {}) {
  if (noteSelectionClearTimer) {
    clearTimeout(noteSelectionClearTimer);
    noteSelectionClearTimer = null;
  }
  if (resetTap) lastNoteSelectionTap = { id: null, at: 0 };
}

function isInlineNoteEditing(noteId = null) {
  return !!noteInlineEditorState && (!noteId || noteInlineEditorState.id === noteId);
}

function hideNoteInlineEditor() {
  const editor = document.getElementById('noteInlineEditor');
  if (!editor) return;
  editor.hidden = true;
  editor.style.left = '';
  editor.style.top = '';
  editor.style.width = '';
  editor.style.height = '';
}

function endNoteInlineEdit({ keepSelection = true } = {}) {
  const wasEditing = !!noteInlineEditorState;
  noteInlineEditorState = null;
  hideNoteInlineEditor();
  clearPendingNoteSelectionClear({ resetTap: true });
  if (!keepSelection && wasEditing) clearSelectedObject();
}

function syncNoteInlineEditor() {
  const editor = document.getElementById('noteInlineEditor');
  const wrap = document.getElementById('canvasWrap');
  if (!editor || !wrap) return;
  const note = noteInlineEditorState ? findAnnotationById(noteInlineEditorState.id) : null;
  if (!note || note.type !== 'note' || selectedAnnotationId() !== note.id) {
    if (noteInlineEditorState) noteInlineEditorState = null;
    hideNoteInlineEditor();
    return;
  }

  const box = noteMetrics(note);
  const center = toC(note.x, note.y);
  const left = center.x - (box.width / 2);
  const top = center.y - (box.height / 2);
  const opacity = clamp(Number(note.opacity) || 1, 0.2, 1);
  const value = String(note.text ?? '');
  if (editor.value !== value) editor.value = value;

  editor.hidden = false;
  editor.style.left = `${left}px`;
  editor.style.top = `${top}px`;
  editor.style.width = `${box.width}px`;
  editor.style.height = `${box.height}px`;
  editor.style.padding = `${box.paddingY}px ${box.paddingX}px`;
  editor.style.fontSize = `${box.fontSize}px`;
  editor.style.lineHeight = `${box.lineHeight}px`;
  editor.style.textAlign = noteAlignValue(note);
  editor.style.opacity = `${opacity}`;
}

function beginNoteInlineEdit(noteId, { selectAll = false } = {}) {
  const note = findAnnotationById(noteId);
  const editor = document.getElementById('noteInlineEditor');
  if (!note || note.type !== 'note' || !editor) return false;
  clearPendingNoteSelectionClear({ resetTap: true });
  if (!isInlineNoteEditing(noteId)) snapshot();
  noteInlineEditorState = { id: noteId };
  selectAnnotationById(noteId);
  closeFloatingToolbarFlyout();
  refreshInteractionUI();
  render();
  requestAnimationFrame(() => {
    syncNoteInlineEditor();
    editor.focus();
    if (selectAll) editor.select();
    else {
      const end = editor.value.length;
      editor.setSelectionRange(end, end);
    }
  });
  return true;
}

function beginSelectedNoteInlineEdit(options = {}) {
  const note = selectedAnnotation();
  if (!note || note.type !== 'note') return false;
  return beginNoteInlineEdit(note.id, options);
}
window.beginSelectedNoteInlineEdit = beginSelectedNoteInlineEdit;

function handleSelectedNoteTapForEditing(noteId) {
  const note = findAnnotationById(noteId);
  if (!note || note.type !== 'note') return false;
  const now = Date.now();
  if (lastNoteSelectionTap.id === noteId && (now - lastNoteSelectionTap.at) <= NOTE_INLINE_EDIT_DOUBLE_TAP_MS) {
    beginNoteInlineEdit(noteId);
    return true;
  }
  clearPendingNoteSelectionClear();
  lastNoteSelectionTap = { id: noteId, at: now };
  noteSelectionClearTimer = setTimeout(() => {
    noteSelectionClearTimer = null;
    if (!isInlineNoteEditing(noteId) && selectedAnnotationId() === noteId && lastNoteSelectionTap.id === noteId) {
      clearSelection();
    }
    lastNoteSelectionTap = { id: null, at: 0 };
  }, NOTE_INLINE_EDIT_DOUBLE_TAP_MS + 30);
  return true;
}

function setNoteFromBounds(note, left, top, right, bottom) {
  const clampedLeft = Math.min(left, right);
  const clampedRight = Math.max(left, right);
  const clampedTop = Math.min(top, bottom);
  const clampedBottom = Math.max(top, bottom);
  note.width = clamp(clampedRight - clampedLeft, NOTE_MIN_WIDTH, NOTE_MAX_WIDTH);
  note.height = clamp(clampedBottom - clampedTop, NOTE_MIN_HEIGHT, NOTE_MAX_HEIGHT);
  note.x = clampedLeft + (note.width / 2);
  note.y = clampedTop + (note.height / 2);
  return note;
}

function drawAnnotationSelectionRing(x, y, r) {
  const p = toC(x, y);
  ctx.save();
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function boxAnnotationBounds(box) {
  return rotatedShapeAnnotationBounds(box);
}

function ellipseAnnotationBounds(ellipse) {
  return rotatedShapeAnnotationBounds(ellipse);
}

function setEllipseFromBounds(ellipse, left, top, right, bottom) {
  setBoxFromBounds(ellipse, left, top, right, bottom);
}

function setBoxFromBounds(box, left, top, right, bottom) {
  box.x = Math.min(left, right);
  box.y = Math.min(top, bottom);
  box.w = Math.max(1.5, Math.abs(right - left));
  box.h = Math.max(1.5, Math.abs(bottom - top));
}

function clampZoneAnnotation(zone) {
  zone.r = Math.max(1.5, zone.r);
  const maxRadius = Math.max(
    1.5,
    Math.min(zone.x - F.XMIN, F.XMAX - zone.x, zone.y - F.YMIN, F.YMAX - zone.y)
  );
  zone.r = Math.min(zone.r, maxRadius);
  zone.x = clamp(zone.x, F.XMIN + zone.r, F.XMAX - zone.r);
  zone.y = clamp(zone.y, F.YMIN + zone.r, F.YMAX - zone.r);
  return zone;
}

function clampBoxAnnotation(box) {
  return clampRotatedShapeAnnotation(box);
}

function clampEllipseAnnotation(ellipse) {
  return clampRotatedShapeAnnotation(ellipse);
}

function zoneAnnotationBounds(zone) {
  return {
    left: zone.x - zone.r,
    right: zone.x + zone.r,
    top: zone.y - zone.r,
    bottom: zone.y + zone.r,
    width: zone.r * 2,
    height: zone.r * 2,
  };
}

function annotationFieldBounds(annotation) {
  if (!annotation) return null;
  if (annotation.type === 'note') return noteAnnotationBounds(annotation);
  if (annotation.type === 'zone') return zoneAnnotationBounds(annotation);
  if (annotation.type === 'box') return boxAnnotationBounds(annotation);
  if (annotation.type === 'ellipse') return ellipseAnnotationBounds(annotation);
  if (annotation.type === 'arrow') {
    const pad = Math.max(2.4, arrowStrokeWidthPx(annotation.thickness) * 0.26);
    return {
      left: Math.min(annotation.start.x, annotation.end.x) - pad,
      right: Math.max(annotation.start.x, annotation.end.x) + pad,
      top: Math.min(annotation.start.y, annotation.end.y) - pad,
      bottom: Math.max(annotation.start.y, annotation.end.y) + pad,
      width: Math.abs(annotation.end.x - annotation.start.x) + (pad * 2),
      height: Math.abs(annotation.end.y - annotation.start.y) + (pad * 2),
    };
  }
  return null;
}

function annotationScreenBounds(annotation) {
  const bounds = annotationFieldBounds(annotation);
  if (!bounds) return null;
  const topLeft = toC(bounds.left, bounds.top);
  const bottomRight = toC(bounds.right, bounds.bottom);
  return {
    left: Math.min(topLeft.x, bottomRight.x),
    right: Math.max(topLeft.x, bottomRight.x),
    top: Math.min(topLeft.y, bottomRight.y),
    bottom: Math.max(topLeft.y, bottomRight.y),
    width: Math.abs(bottomRight.x - topLeft.x),
    height: Math.abs(bottomRight.y - topLeft.y),
  };
}

function annotationToolbarTitle(annotation) {
  if (!annotation) return '';
  if (annotation.type === 'note') return 'Note';
  if (annotation.type === 'arrow') return 'Arrow';
  if (annotation.type === 'box') return 'Box';
  return 'Circle';
}

function floatingToolbarVisibleBounds(wrapRect, hostRect, edgeMargin = 8) {
  return {
    left: Math.max(
      edgeMargin,
      Math.round(Math.max(0, hostRect.left - wrapRect.left, -wrapRect.left))
    ),
    top: Math.max(
      edgeMargin,
      Math.round(Math.max(0, hostRect.top - wrapRect.top, -wrapRect.top))
    ),
    right: Math.min(
      wrapRect.width - edgeMargin,
      Math.round(Math.min(wrapRect.width, hostRect.right - wrapRect.left, window.innerWidth - wrapRect.left))
    ),
    bottom: Math.min(
      wrapRect.height - edgeMargin,
      Math.round(Math.min(wrapRect.height, hostRect.bottom - wrapRect.top, window.innerHeight - wrapRect.top))
    ),
  };
}

function positionOpenFloatingToolbarFlyout() {
  if (!floatingToolbarOpenFlyout) return;
  const toolbar = document.getElementById('floatingSelectionToolbar');
  const wrap = document.getElementById('canvasWrap');
  if (!toolbar || toolbar.hidden || !wrap) return;
  const flyout = toolbar.querySelector(`.floating-selection-toolbar-flyout[data-flyout="${floatingToolbarOpenFlyout}"]`);
  const trigger = toolbar.querySelector(`[data-flyout-target="${floatingToolbarOpenFlyout}"]`);
  if (!flyout || !trigger || trigger.hidden || trigger.closest('[hidden]')) {
    closeFloatingToolbarFlyout();
    return;
  }

  const wrapRect = wrap.getBoundingClientRect();
  const host = document.getElementById('canvasHost');
  const hostRect = host ? host.getBoundingClientRect() : wrapRect;
  const visible = floatingToolbarVisibleBounds(wrapRect, hostRect, 8);
  const toolbarRect = toolbar.getBoundingClientRect();
  const triggerRect = trigger.getBoundingClientRect();
  const flyoutWidth = flyout.offsetWidth || 0;
  const flyoutHeight = flyout.offsetHeight || 0;
  const gap = 8;
  const minLeft = visible.left - toolbarRect.left;
  const maxLeft = Math.max(minLeft, visible.right - toolbarRect.left - flyoutWidth);
  const desiredLeft = (triggerRect.left + (triggerRect.width / 2)) - toolbarRect.left - (flyoutWidth / 2);
  const left = clamp(desiredLeft, minLeft, maxLeft);
  const spaceBelow = visible.bottom - toolbarRect.bottom - gap;
  const spaceAbove = toolbarRect.top - visible.top - gap;
  const placeAbove = spaceBelow < flyoutHeight && spaceAbove > spaceBelow;
  const minTop = visible.top - toolbarRect.top;
  const maxTop = visible.bottom - toolbarRect.top - flyoutHeight;
  const desiredTop = placeAbove ? -(flyoutHeight + gap) : (toolbar.offsetHeight + gap);
  const top = clamp(desiredTop, minTop, Math.max(minTop, maxTop));

  flyout.dataset.placement = placeAbove ? 'top' : 'bottom';
  flyout.style.left = `${left}px`;
  flyout.style.top = `${top}px`;
  flyout.style.bottom = '';
}

function positionFloatingSelectionToolbar() {
  const toolbar = document.getElementById('floatingSelectionToolbar');
  const wrap = document.getElementById('canvasWrap');
  const annotation = selectedAnnotation();
  if (!toolbar || !wrap || !annotation) return;
  const bounds = annotationScreenBounds(annotation);
  if (!bounds) return;

  const wrapRect = wrap.getBoundingClientRect();
  const host = document.getElementById('canvasHost');
  const hostRect = host ? host.getBoundingClientRect() : wrapRect;
  const edgeMargin = 8;
  const gap = 14 + (isShapeAnnotationType(annotation.type) ? 34 : 0);
  const toolbarWidth = toolbar.offsetWidth || 0;
  const toolbarHeight = toolbar.offsetHeight || 0;
  const visible = floatingToolbarVisibleBounds(wrapRect, hostRect, edgeMargin);
  const visibleLeft = visible.left;
  const visibleTop = visible.top;
  const visibleRight = visible.right;
  const visibleBottom = visible.bottom;
  const minLeft = visibleLeft;
  const maxLeft = Math.max(minLeft, visibleRight - toolbarWidth);
  const minTop = visibleTop;
  const maxTop = Math.max(minTop, visibleBottom - toolbarHeight);
  const anchorX = clamp(bounds.left + (bounds.width / 2), visibleLeft + 10, visibleRight - 10);
  const anchorTop = clamp(bounds.top, visibleTop, visibleBottom);
  const anchorBottom = clamp(bounds.bottom, visibleTop, visibleBottom);
  const preferredTop = bounds.top - toolbarHeight - gap;
  const preferredBottom = bounds.bottom + gap;
  const fitsAbove = preferredTop >= minTop;
  const fitsBelow = preferredBottom + toolbarHeight <= visibleBottom;
  const placeBelow = !fitsAbove && fitsBelow;
  const top = placeBelow
    ? clamp(preferredBottom, minTop, maxTop)
    : clamp(preferredTop, minTop, maxTop);
  const left = clamp(anchorX - (toolbarWidth / 2), minLeft, maxLeft);
  const caretLeft = clamp(anchorX - left, 18, Math.max(18, toolbarWidth - 18));

  toolbar.dataset.placement = placeBelow ? 'bottom' : 'top';
  toolbar.style.right = 'auto';
  toolbar.style.bottom = 'auto';
  toolbar.style.left = `${left}px`;
  toolbar.style.top = `${top}px`;
  toolbar.style.setProperty('--fst-caret-left', `${caretLeft}px`);
  positionOpenFloatingToolbarFlyout();
}

function scheduleFloatingSelectionToolbarUpdate() {
  if (floatingSelectionToolbarRaf) cancelAnimationFrame(floatingSelectionToolbarRaf);
  floatingSelectionToolbarRaf = requestAnimationFrame(() => {
    floatingSelectionToolbarRaf = 0;
    positionFloatingSelectionToolbar();
  });
}

function toggleFloatingToolbarFlyout(name, event = null) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const toolbar = document.getElementById('floatingSelectionToolbar');
  if (!toolbar || toolbar.hidden) return;
  const targetBtn = toolbar.querySelector(`[data-flyout-target="${name}"]`);
  const targetFlyout = toolbar.querySelector(`.floating-selection-toolbar-flyout[data-flyout="${name}"]`);
  if (!targetBtn || !targetFlyout || targetBtn.hidden || targetBtn.closest('[hidden]')) return;
  const willOpen = floatingToolbarOpenFlyout !== name;
  closeFloatingToolbarFlyout();
  if (!willOpen) return;
  floatingToolbarOpenFlyout = name;
  targetBtn.setAttribute('aria-expanded', 'true');
  targetFlyout.hidden = false;
  positionOpenFloatingToolbarFlyout();
}
window.toggleFloatingToolbarFlyout = toggleFloatingToolbarFlyout;

function clampNoteAnnotation(note) {
  note.width = noteWidthValue(note);
  note.height = noteHeightValue(note);
  const bounds = noteAnnotationBounds(note);
  const halfW = bounds.width / 2;
  const halfH = bounds.height / 2;
  note.x = clamp(note.x, F.XMIN + halfW, F.XMAX - halfW);
  note.y = clamp(note.y, F.YMIN + halfH, F.YMAX - halfH);
  return note;
}

function drawNoteAnnotation(note, selected = false) {
  const p = toC(note.x, note.y);
  const box = noteMetrics(note);
  const width = box.width;
  const height = box.height;
  const opacity = clamp(Number(note.opacity) || 1, 0.2, 1);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = 'rgba(3,8,14,0.82)';
  roundRect(ctx, p.x - width / 2, p.y - height / 2, width, height, box.cornerRadius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = opacity;
  if (selected) {
    ctx.shadowColor = 'rgba(251,191,36,0.22)';
    ctx.shadowBlur = 18;
  }
  ctx.strokeStyle = selected ? '#fbbf24' : (note.color || 'rgba(217,180,108,0.68)');
  ctx.lineWidth = selected ? 2 : 1.2;
  roundRect(ctx, p.x - width / 2, p.y - height / 2, width, height, box.cornerRadius);
  ctx.stroke();
  ctx.beginPath();
  roundRect(ctx, p.x - width / 2, p.y - height / 2, width, height, box.cornerRadius);
  ctx.clip();
  ctx.fillStyle = '#f7fafc';
  ctx.font = `700 ${box.fontSize}px ${NOTE_FONT}`;
  ctx.textAlign = box.align;
  ctx.textBaseline = 'top';
  const textLeft = p.x - (width / 2) + box.paddingX;
  const textRight = p.x + (width / 2) - box.paddingX;
  const textCenter = textLeft + (box.innerWidth / 2);
  const textTop = p.y - (height / 2) + box.paddingY;
  const totalTextHeight = box.visibleLines.length * box.lineHeight;
  const textY = textTop + Math.max(0, (box.innerHeight - totalTextHeight) / 2);
  if (!isInlineNoteEditing(note.id)) {
    box.visibleLines.forEach((line, index) => {
      const textX = box.align === 'center'
        ? textCenter
        : box.align === 'right'
          ? textRight
          : textLeft;
      ctx.fillText(line || '', textX, textY + (index * box.lineHeight));
    });
  }
  ctx.restore();

  if (selected) {
    const corners = noteAnnotationCorners(note);
    ctx.save();
    ctx.globalAlpha = Math.max(0.42, opacity);
    const handleSize = noteHandleSizePx();
    ctx.fillStyle = '#E3B23C';
    ctx.strokeStyle = 'rgba(7,16,24,0.95)';
    ctx.lineWidth = Math.max(1.4, (window.devicePixelRatio || 1) * 1.2);
    drawAnnotationHandleAtFieldPoint(corners.nw, handleSize);
    drawAnnotationHandleAtFieldPoint(corners.ne, handleSize);
    drawAnnotationHandleAtFieldPoint(corners.sw, handleSize);
    drawAnnotationHandleAtFieldPoint(corners.se, handleSize);
    ctx.restore();
  }
}

function noteResizeCursorForHandle(handle) {
  if (handle === 'nw' || handle === 'se') return 'nwse-resize';
  if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
  return 'default';
}

function normalizeShapeRotation(rotation) {
  const raw = Number(rotation);
  if (!Number.isFinite(raw)) return 0;
  let normalized = raw % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

function shapeFrameBounds(shape) {
  const width = Math.max(1.5, Math.abs(Number(shape?.w) || 0));
  const height = Math.max(1.5, Math.abs(Number(shape?.h) || 0));
  return {
    left: Number(shape?.x) || 0,
    top: Number(shape?.y) || 0,
    right: (Number(shape?.x) || 0) + width,
    bottom: (Number(shape?.y) || 0) + height,
    width,
    height,
  };
}

function shapeAnnotationCenter(shape) {
  const frame = shapeFrameBounds(shape);
  return {
    x: frame.left + (frame.width / 2),
    y: frame.top + (frame.height / 2),
  };
}

function fieldUnitsForPixels(px) {
  return px / Math.max(sc || 1, 0.0001);
}

function rotateOffset(x, y, radians) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: (x * cos) - (y * sin),
    y: (x * sin) + (y * cos),
  };
}

function shapeWorldPointFromLocal(shape, localX, localY) {
  const center = shapeAnnotationCenter(shape);
  const offset = rotateOffset(localX, localY, normalizeShapeRotation(shape.rotation) * (Math.PI / 180));
  return {
    x: center.x + offset.x,
    y: center.y + offset.y,
  };
}

function shapeLocalPointFromWorld(shape, worldPoint, rotationOverride = null) {
  const center = shapeAnnotationCenter(shape);
  const radians = (rotationOverride === null ? normalizeShapeRotation(shape.rotation) : normalizeShapeRotation(rotationOverride)) * (Math.PI / 180);
  return rotateOffset(worldPoint.x - center.x, worldPoint.y - center.y, -radians);
}

function boxAnnotationCorners(box) {
  const frame = shapeFrameBounds(box);
  const halfW = frame.width / 2;
  const halfH = frame.height / 2;
  return {
    nw: shapeWorldPointFromLocal(box, -halfW, -halfH),
    ne: shapeWorldPointFromLocal(box, halfW, -halfH),
    sw: shapeWorldPointFromLocal(box, -halfW, halfH),
    se: shapeWorldPointFromLocal(box, halfW, halfH),
  };
}

function ellipseAnnotationCorners(ellipse) {
  return boxAnnotationCorners(ellipse);
}

function rotatedShapeAnnotationBounds(shape) {
  const corners = Object.values(boxAnnotationCorners(shape));
  const xs = corners.map(point => point.x);
  const ys = corners.map(point => point.y);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
    width: Math.max(1.5, Math.max(...xs) - Math.min(...xs)),
    height: Math.max(1.5, Math.max(...ys) - Math.min(...ys)),
  };
}

function shapeRotateStemLengthField() {
  return fieldUnitsForPixels(18);
}

function shapeRotateHandleFieldPoint(shape) {
  const frame = shapeFrameBounds(shape);
  return shapeWorldPointFromLocal(shape, 0, -(frame.height / 2) - shapeRotateStemLengthField());
}

function shapeRotateStemFieldPoint(shape) {
  const frame = shapeFrameBounds(shape);
  return shapeWorldPointFromLocal(shape, 0, -(frame.height / 2));
}

function shapeHandleHitRadiusField() {
  return Math.max(1.35, fieldUnitsForPixels(11));
}

function setShapeFrameFromCenter(shape, center, width, height) {
  const nextWidth = Math.max(1.5, width);
  const nextHeight = Math.max(1.5, height);
  shape.x = center.x - (nextWidth / 2);
  shape.y = center.y - (nextHeight / 2);
  shape.w = nextWidth;
  shape.h = nextHeight;
}

function clampRotatedShapeAnnotation(shape) {
  const frame = shapeFrameBounds(shape);
  shape.w = Math.min(frame.width, F.XMAX - F.XMIN);
  shape.h = Math.min(frame.height, F.YMAX - F.YMIN);
  const bounds = rotatedShapeAnnotationBounds(shape);
  let dx = 0;
  let dy = 0;
  if (bounds.left < F.XMIN) dx = F.XMIN - bounds.left;
  else if (bounds.right > F.XMAX) dx = F.XMAX - bounds.right;
  if (bounds.top < F.YMIN) dy = F.YMIN - bounds.top;
  else if (bounds.bottom > F.YMAX) dy = F.YMAX - bounds.bottom;
  shape.x += dx;
  shape.y += dy;
  return shape;
}

function constrainEllipseSize(width, height) {
  const size = Math.max(1.5, Math.max(width, height));
  return { width: size, height: size };
}

function resizeRotatedShapeAnnotation(shape, base, handle, point, constrainCircle = false) {
  const rotation = normalizeShapeRotation(base.rotation);
  const frame = shapeFrameBounds(base);
  const halfW = frame.width / 2;
  const halfH = frame.height / 2;
  const signs = handle === 'nw'
    ? { x: -1, y: -1 }
    : handle === 'ne'
      ? { x: 1, y: -1 }
      : handle === 'sw'
        ? { x: -1, y: 1 }
        : { x: 1, y: 1 };
  const anchorWorld = shapeWorldPointFromLocal(base, -signs.x * halfW, -signs.y * halfH);
  const localDelta = rotateOffset(point.x - anchorWorld.x, point.y - anchorWorld.y, -(rotation * (Math.PI / 180)));
  let width = Math.max(1.5, Math.abs(localDelta.x));
  let height = Math.max(1.5, Math.abs(localDelta.y));
  if (constrainCircle) {
    const constrained = constrainEllipseSize(width, height);
    width = constrained.width;
    height = constrained.height;
  }
  const draggedLocal = {
    x: signs.x * width,
    y: signs.y * height,
  };
  const centerOffset = rotateOffset(draggedLocal.x / 2, draggedLocal.y / 2, rotation * (Math.PI / 180));
  const center = {
    x: anchorWorld.x + centerOffset.x,
    y: anchorWorld.y + centerOffset.y,
  };
  setShapeFrameFromCenter(shape, center, width, height);
  shape.rotation = rotation;
  return clampRotatedShapeAnnotation(shape);
}

function shapeResizeCursorForHandle(handle) {
  if (handle === 'rotate') return 'grab';
  if (handle === 'nw' || handle === 'se') return 'nwse-resize';
  if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
  return 'grab';
}

function drawShapeRotationHandle(shape, opacity = 1) {
  const stemStart = toC(shapeRotateStemFieldPoint(shape).x, shapeRotateStemFieldPoint(shape).y);
  const handleCenterField = shapeRotateHandleFieldPoint(shape);
  const handleCenter = toC(handleCenterField.x, handleCenterField.y);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = 'rgba(251,191,36,0.42)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(stemStart.x, stemStart.y);
  ctx.lineTo(handleCenter.x, handleCenter.y);
  ctx.stroke();
  ctx.fillStyle = '#fbbf24';
  ctx.strokeStyle = '#0b1420';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(handleCenter.x, handleCenter.y, 6.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawArrowAnnotation(arrow, selected = false, preview = false) {
  const color = arrow.color || annotationColor('arrow');
  const opacity = preview ? 0.82 : (Number(arrow.opacity) || 1);
  const thicknessKey = arrowThicknessValue(arrow.thickness);
  const strokeWidth = preview ? Math.max(2, arrowStrokeWidthPx(thicknessKey) - 0.3) : arrowStrokeWidthPx(thicknessKey);
  const shaftDash = arrowDashValue(arrow.dash) === 'dashed'
    ? [Math.max(8, strokeWidth * 2.8), Math.max(6, strokeWidth * 1.9)]
    : [];
  const start = toC(arrow.start.x, arrow.start.y);
  const end = toC(arrow.end.x, arrow.end.y);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const head = Math.max(11, strokeWidth * 3.8, sc * 1.6);
  const shaftEnd = len > 0.001
    ? {
        x: end.x - Math.cos(ang) * Math.min(head * 0.78, Math.max(0, len - 1)),
        y: end.y - Math.sin(ang) * Math.min(head * 0.78, Math.max(0, len - 1)),
      }
    : { ...end };
  const underlayWidth = strokeWidth + (selected ? 3.2 : 2.2);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = 'rgba(7,16,24,0.46)';
  ctx.lineWidth = underlayWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (shaftDash.length) ctx.setLineDash(shaftDash);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(shaftEnd.x, shaftEnd.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  if (selected) {
    ctx.save();
    ctx.strokeStyle = 'rgba(251,191,36,0.42)';
    ctx.lineWidth = underlayWidth + 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(shaftEnd.x, shaftEnd.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (shaftDash.length) ctx.setLineDash(shaftDash);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(shaftEnd.x, shaftEnd.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - head * Math.cos(ang - 0.42), end.y - head * Math.sin(ang - 0.42));
  ctx.lineTo(end.x - head * Math.cos(ang + 0.42), end.y - head * Math.sin(ang + 0.42));
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (selected) {
    [arrow.start, arrow.end].forEach(pt => {
      const hp = toC(pt.x, pt.y);
      ctx.save();
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#0b1420';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }
}

function drawZoneAnnotation(zone, selected = false, preview = false) {
  const p = toC(zone.x, zone.y);
  const radius = Math.max(zone.r * sc, sc * 1.5);
  const opacity = preview ? 1 : (Number(zone.opacity) || 1);
  const strokeWidth = preview ? Math.max(1.8, arrowStrokeWidthPx(zone.thickness) - 0.3) : arrowStrokeWidthPx(zone.thickness);
  const dash = shapeDashPattern(zone.dash, strokeWidth);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = hexToRgba(zone.color || annotationColor('zone'), preview ? 0.08 : 0.12);
  ctx.strokeStyle = selected ? '#fbbf24' : (zone.color || annotationColor('zone'));
  ctx.lineWidth = selected ? strokeWidth + 0.35 : strokeWidth;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  if (selected) {
    ctx.save();
    ctx.strokeStyle = 'rgba(251,191,36,0.28)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    const handleGuide = toC(zone.x + zone.r, zone.y);
    ctx.lineTo(handleGuide.x, handleGuide.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#0b1420';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const handle = toC(zone.x + zone.r, zone.y);
    ctx.save();
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#0b1420';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawBoxAnnotation(box, selected = false, preview = false) {
  const opacity = preview ? 1 : (Number(box.opacity) || 1);
  const frame = shapeFrameBounds(box);
  const center = shapeAnnotationCenter(box);
  const centerPx = toC(center.x, center.y);
  const width = frame.width * sc;
  const height = frame.height * sc;
  const strokeWidth = preview ? Math.max(1.8, arrowStrokeWidthPx(box.thickness) - 0.3) : arrowStrokeWidthPx(box.thickness);
  const dash = shapeDashPattern(box.dash, strokeWidth);
  const rotation = normalizeShapeRotation(box.rotation) * (Math.PI / 180);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(centerPx.x, centerPx.y);
  ctx.rotate(rotation);
  ctx.fillStyle = hexToRgba(box.color || annotationColor('box'), preview ? 0.09 : 0.13);
  ctx.strokeStyle = selected ? '#fbbf24' : (box.color || annotationColor('box'));
  ctx.lineWidth = selected ? Math.max(2.4, strokeWidth) : strokeWidth;
  if (dash.length) ctx.setLineDash(dash);
  roundRect(ctx, -(width / 2), -(height / 2), width, height, 14);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  if (selected) {
    const corners = boxAnnotationCorners(box);
    ctx.save();
    ctx.translate(centerPx.x, centerPx.y);
    ctx.rotate(rotation);
    ctx.strokeStyle = 'rgba(251,191,36,0.24)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    roundRect(ctx, -(width / 2) - 4, -(height / 2) - 4, width + 8, height + 8, 16);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    Object.values(corners).forEach(corner => {
      const handle = toC(corner.x, corner.y);
      ctx.save();
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#0b1420';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
    drawShapeRotationHandle(box, opacity);
  }
}

function drawEllipseAnnotation(ellipse, selected = false, preview = false) {
  const opacity = preview ? 1 : (Number(ellipse.opacity) || 1);
  const frame = shapeFrameBounds(ellipse);
  const center = shapeAnnotationCenter(ellipse);
  const centerPx = toC(center.x, center.y);
  const width = Math.max(1, frame.width * sc);
  const height = Math.max(1, frame.height * sc);
  const radiusX = width / 2;
  const radiusY = height / 2;
  const strokeWidth = preview ? Math.max(1.8, arrowStrokeWidthPx(ellipse.thickness) - 0.3) : arrowStrokeWidthPx(ellipse.thickness);
  const dash = shapeDashPattern(ellipse.dash, strokeWidth);
  const rotation = normalizeShapeRotation(ellipse.rotation) * (Math.PI / 180);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(centerPx.x, centerPx.y);
  ctx.rotate(rotation);
  ctx.fillStyle = hexToRgba(ellipse.color || annotationColor('ellipse'), preview ? 0.08 : 0.12);
  ctx.strokeStyle = selected ? '#fbbf24' : (ellipse.color || annotationColor('ellipse'));
  ctx.lineWidth = selected ? Math.max(2.4, strokeWidth) : strokeWidth;
  if (dash.length) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  if (selected) {
    const corners = ellipseAnnotationCorners(ellipse);
    ctx.save();
    ctx.translate(centerPx.x, centerPx.y);
    ctx.rotate(rotation);
    ctx.strokeStyle = 'rgba(251,191,36,0.24)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX + 4, radiusY + 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    Object.values(corners).forEach(corner => {
      const handle = toC(corner.x, corner.y);
      ctx.save();
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#0b1420';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
    drawShapeRotationHandle(ellipse, opacity);
  }
}

function renderAnnotations(layer, annotations = S.annotations) {
  annotations.forEach(annotation => {
    const selected = annotations === S.annotations && selectedAnnotationId() === annotation.id;
    if (layer === 'zones' && annotation.type === 'zone') drawZoneAnnotation(annotation, selected);
    if (layer === 'zones' && annotation.type === 'box') drawBoxAnnotation(annotation, selected);
    if (layer === 'zones' && annotation.type === 'ellipse') drawEllipseAnnotation(annotation, selected);
    if (layer === 'lines' && annotation.type === 'arrow') drawArrowAnnotation(annotation, selected);
    if (layer === 'notes' && annotation.type === 'note') drawNoteAnnotation(annotation, selected);
  });
}

function renderAnnotationDraft() {
  if (!S.annotationDraft) return;
  if (S.annotationDraft.type === 'arrow' && S.annotationDraft.end) {
    drawArrowAnnotation(S.annotationDraft, false, true);
  }
  if (S.annotationDraft.type === 'zone' && Number.isFinite(S.annotationDraft.r)) {
    drawZoneAnnotation(S.annotationDraft, false, true);
  }
  if (S.annotationDraft.type === 'box' && Number.isFinite(S.annotationDraft.w) && Number.isFinite(S.annotationDraft.h)) {
    drawBoxAnnotation(S.annotationDraft, false, true);
  }
  if (S.annotationDraft.type === 'ellipse' && Number.isFinite(S.annotationDraft.w) && Number.isFinite(S.annotationDraft.h)) {
    drawEllipseAnnotation(S.annotationDraft, false, true);
  }
}

//  MAIN RENDER
let _rafPending = false;
function scheduleRender() {
  if (_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(() => { _rafPending = false; render(); });
}

function render() {
  drawField();

  if (shouldRenderSequencePreview()) {
    const frame = buildSequenceFrame(S.animT);
    const playerLookup = new Map(frame.players.map(pl => [playerKey(pl), pl]));
    const animatedKickBall = resolveAnimatedKickBall(frame, playerLookup);
    renderAnnotations('zones', frame.annotations);
    frame.passes.forEach(pass => {
      const from = playerLookup.get(playerKey({ num: pass.fromNum, team: pass.fromT }));
      if (!from) return;
      if (pass.style === 'kick' && pass.targetX !== undefined) {
        drawKickToTarget(from.x, from.y, pass.targetX, pass.targetY, 1);
        return;
      }
      const to = playerLookup.get(playerKey({ num: pass.toNum, team: pass.toT }));
      if (!to) return;
      const col = pass.style === 'kick' ? '#f59e0b' : 'rgba(255,255,255,0.75)';
      drawArc(from.x, from.y, to.x, to.y, col, 1, pass.style === 'kick');
    });
    frame.paths.forEach(path => {
      if (path.pts.length < 2) return;
      drawRunPath(path.pts, path.team === 'A' ? '#60a5fa' : '#f87171', 2.8, 1);
    });
    renderAnnotations('lines', frame.annotations);
    renderPathOriginMarkers(frame.players, frame.paths);
    frame.players.forEach(pl => drawPlayer(pl.x, pl.y, pl.num, pl.team, false, samePlayerRef(playerRef(pl), frame.ballOwner), playerColorPalette(pl)));
    const frameBall = animatedKickBall || frame.ball;
    if (frameBall) drawBall(frameBall.x, frameBall.y, false);
    frame.players.forEach(pl => {
      if (samePlayerRef(playerRef(pl), frame.ballOwner)) drawBallCarrierHighlight(pl.x, pl.y);
    });
    renderAnnotations('notes', frame.annotations);
    closeRadialMenu();
    scheduleFloatingSelectionToolbarUpdate();
    return;
  }

  const t = S.animating ? S.animT : 0;
  const animatedKickBall = resolveLiveAnimatedKickBall(t);
  renderAnnotations('zones');

  S.passes.forEach((pass, passIdx) => {
    const fp = S.players.find(p => p.id === pass.from);
    if (!fp) return;
    const fa = animPos(fp, t);
    const isSelected = S.selectedPassIdx === passIdx;
    if (pass.style === 'kick' && pass.to === null && pass.targetX !== undefined) {
      drawKickToTarget(fa.x, fa.y, pass.targetX, pass.targetY, 1, isSelected);
      return;
    }
    const tp = S.players.find(p => p.id === pass.to);
    if (!tp) return;
    const ta = animPos(tp, t);
    if (pass.style === 'kick') {
      drawKickLine(fa.x, fa.y, ta.x, ta.y, 1, isSelected);
    } else {
      drawArc(fa.x, fa.y, ta.x, ta.y, 'rgba(255,255,255,0.75)', 1, false, isSelected);
    }
  });

  S.paths.forEach(path => {
    if (path.pts.length < 2) return;
    const isSelected = S.selectedPathPid === path.pid;
    drawRunPath(path.pts, path.color, 2.8, t > 0 ? t : 1, false, isSelected);
  });

  if (S.dragging?.type === 'player') {
    const pl = S.players.find(p => p.id === S.dragPlayerId);
    const path = pl && S.paths.find(p => p.pid === pl.id);

    if (path && path.pts.length >= 2) {
      const dx = pl.x - path.pts[0].x;
      const dy = pl.y - path.pts[0].y;
      const ghostPts = path.pts.map(pt => ({
        x: pt.x + dx,
        y: pt.y + dy
      }));

      ctx.save();
      ctx.globalAlpha = 0.3;
      drawRunPath(ghostPts, path.color, 2, 1, true);
      ctx.restore();
    }
  }
  renderAnnotations('lines');
  renderPhoneEditMovementGuides();
  renderPathOriginMarkers();

  if (S.drawing && S.drawing.pts.length >= 2) {
    const pl  = S.players.find(p => p.id === S.drawing.pid);
    const col = pl?.team === 'A' ? 'rgba(96,165,250,0.7)' : 'rgba(248,113,113,0.7)';
    drawRunPath(S.drawing.pts, col, 2.2, 1, true);
  }
  renderAnnotationDraft();

  if (S.dragging?.type === 'ball' && S.ball) {
    const near = findBallSnapTarget(S.ball);
    if (near) {
      const pt = toC(near.x, near.y);
      ctx.save();
      ctx.strokeStyle = 'rgba(251,191,36,0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, R() + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  const livePlayers = uniquePlayersByRef(S.players);
  livePlayers.forEach(pl => {
    const pos = S.animating ? animPos(pl, t) : pl;
    const sel = isPlayerSelected(pl.id);
    drawPlayer(pos.x, pos.y, pl.num, pl.team, sel, pl.isBC, playerColorPalette(pl));
  });
  const liveBall = animatedKickBall || S.ball;
  if (liveBall) {
    drawBall(liveBall.x, liveBall.y, isBallSelected());
  }
  livePlayers.forEach(pl => {
    if (pl.isBC) drawBallCarrierHighlight(pl.x, pl.y);
  });
  renderAnnotations('notes');
  const now = Date.now();
  [...teleStrokes, ...(teleDrawing ? [teleDrawing] : [])].forEach(s => {
    if (s.pts.length < 2) return;
    const age = now - s.born;
    const alpha = Math.max(0, 1 - age / TELE_DURATION);
    ctx.save();
    ctx.strokeStyle = s.color.replace(')', `, ${alpha})`)
      .replace('#facc15', `rgba(250,204,21,${alpha})`);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    s.pts.forEach((pt, i) => {
      const p = toC(pt.x, pt.y);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.restore();
  });
  renderRadialMenu();
  scheduleFloatingSelectionToolbarUpdate();
}

function animPos(pl, t) {
  const path = S.paths.find(p => p.pid === pl.id);
  if (!path || path.pts.length < 2 || t === 0) return { x:pl.x, y:pl.y };
  return catmullRom(path.pts, t);
}

//  MOUSE HANDLING
function getF(e)  { const r=cv.getBoundingClientRect(); return frC(e.clientX-r.left, e.clientY-r.top); }
function getPx(e) { const r=cv.getBoundingClientRect(); return {x:e.clientX-r.left, y:e.clientY-r.top}; }
const PRT = () => (R() + 1) / sc; // player hit radius in field units

function getPointerSamples(e) {
  if (typeof e?.getCoalescedEvents === 'function') {
    const samples = e.getCoalescedEvents();
    if (Array.isArray(samples) && samples.length) return samples;
  }
  return [e];
}

function hitPlayer(fp) {
  let nearest = null;
  let nearestDist = Infinity;
  S.players.forEach((player) => {
    const dist = d2(fp, { x: player.x, y: player.y });
    if (dist < PRT() && dist < nearestDist) {
      nearest = player;
      nearestDist = dist;
    }
  });
  return nearest;
}
function hitBall(fp) {
  if (!S.ball) return false;
  return d2(fp, S.ball) < PRT();
}

function pointSegDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (!dx && !dy) return d2(p, a);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const tc = clamp(t, 0, 1);
  return d2(p, { x: a.x + tc * dx, y: a.y + tc * dy });
}

function hitAnnotation(fp) {
  for (let i = S.annotations.length - 1; i >= 0; i--) {
    const ann = S.annotations[i];
    if (ann.type === 'note') {
      const bounds = noteAnnotationBounds(ann);
      const corners = noteAnnotationCorners(ann);
      const isSelected = selectedAnnotationId() === ann.id;
      if (isSelected) {
        const handleTolerance = noteHandleHitRadiusField(ann);
        if (d2(fp, corners.nw) <= handleTolerance) return { id: ann.id, part: 'resize', handle: 'nw' };
        if (d2(fp, corners.ne) <= handleTolerance) return { id: ann.id, part: 'resize', handle: 'ne' };
        if (d2(fp, corners.sw) <= handleTolerance) return { id: ann.id, part: 'resize', handle: 'sw' };
        if (d2(fp, corners.se) <= handleTolerance) return { id: ann.id, part: 'resize', handle: 'se' };
      }
      if (
        fp.x >= bounds.left - 0.8 && fp.x <= bounds.right + 0.8 &&
        fp.y >= bounds.top - 0.8 && fp.y <= bounds.bottom + 0.8
      ) {
        return { id: ann.id, part: 'move' };
      }
    }
    if (ann.type === 'arrow') {
      const handleRadius = arrowThicknessValue(ann.thickness) === 'thick' ? 3.2 : 2.8;
      const shaftTolerance = 2.4 + (arrowStrokeWidthPx(ann.thickness) * 0.25);
      if (d2(fp, ann.start) <= handleRadius) return { id: ann.id, part: 'start' };
      if (d2(fp, ann.end) <= handleRadius) return { id: ann.id, part: 'end' };
      if (pointSegDist(fp, ann.start, ann.end) <= shaftTolerance) return { id: ann.id, part: 'move' };
    }
    if (ann.type === 'zone') {
      const handle = { x: ann.x + ann.r, y: ann.y };
      const center = { x: ann.x, y: ann.y };
      if (d2(fp, handle) <= 2.8) return { id: ann.id, part: 'radius' };
      if (d2(fp, center) <= ann.r + 1.1) return { id: ann.id, part: 'move' };
    }
    if (ann.type === 'box') {
      const corners = boxAnnotationCorners(ann);
      const handleRadius = shapeHandleHitRadiusField();
      if (selectedAnnotationId() === ann.id && d2(fp, shapeRotateHandleFieldPoint(ann)) <= handleRadius) return { id: ann.id, part: 'rotate' };
      if (d2(fp, corners.nw) <= handleRadius) return { id: ann.id, part: 'nw' };
      if (d2(fp, corners.ne) <= handleRadius) return { id: ann.id, part: 'ne' };
      if (d2(fp, corners.sw) <= handleRadius) return { id: ann.id, part: 'sw' };
      if (d2(fp, corners.se) <= handleRadius) return { id: ann.id, part: 'se' };
      const local = shapeLocalPointFromWorld(ann, fp);
      const frame = shapeFrameBounds(ann);
      if (Math.abs(local.x) <= (frame.width / 2) + 0.8 && Math.abs(local.y) <= (frame.height / 2) + 0.8) {
        return { id: ann.id, part: 'move' };
      }
    }
    if (ann.type === 'ellipse') {
      const corners = ellipseAnnotationCorners(ann);
      const handleRadius = shapeHandleHitRadiusField();
      if (selectedAnnotationId() === ann.id && d2(fp, shapeRotateHandleFieldPoint(ann)) <= handleRadius) return { id: ann.id, part: 'rotate' };
      if (d2(fp, corners.nw) <= handleRadius) return { id: ann.id, part: 'nw' };
      if (d2(fp, corners.ne) <= handleRadius) return { id: ann.id, part: 'ne' };
      if (d2(fp, corners.sw) <= handleRadius) return { id: ann.id, part: 'sw' };
      if (d2(fp, corners.se) <= handleRadius) return { id: ann.id, part: 'se' };
      const local = shapeLocalPointFromWorld(ann, fp);
      const frame = shapeFrameBounds(ann);
      const rx = Math.max(0.75, frame.width / 2);
      const ry = Math.max(0.75, frame.height / 2);
      const norm = ((local.x ** 2) / (rx ** 2)) + ((local.y ** 2) / (ry ** 2));
      if (norm <= 1.15) {
        return { id: ann.id, part: 'move' };
      }
    }
  }
  return null;
}

function removeAnnotation(id) {
  const ann = findAnnotationById(id);
  if (!ann) return;
  S.annotations = S.annotations.filter(item => item.id !== id);
  if (selectedAnnotationId() === id) clearSelectedObject();
  setHint(`${MODE_LABELS[ann.type] || 'Annotation'} removed.`);
}

function beginPointerTap(pointerId, payload, point) {
  S.pointerTap = {
    pointerId,
    payload,
    startClientX: point.clientX,
    startClientY: point.clientY,
    moved: false,
  };
}

function updatePointerTapMovement(point) {
  if (!S.pointerTap) return;
  const dx = point.clientX - S.pointerTap.startClientX;
  const dy = point.clientY - S.pointerTap.startClientY;
  if (Math.hypot(dx, dy) > MOBILE_TAP_TOGGLE_PX) {
    S.pointerTap.moved = true;
  }
}

function consumePointerTap(pointerId) {
  if (!S.pointerTap || S.pointerTap.pointerId !== pointerId) return null;
  const tap = S.pointerTap;
  S.pointerTap = null;
  return tap;
}

function startPortraitPan(pointerId, point, payload = { type: 'portrait-pan' }) {
  if (!isPhoneViewport || phoneVerticalOverflowPx <= 0 || !point) return false;
  const host = document.getElementById('canvasHost');
  closeRadialMenu();
  S.dragging = {
    type: 'portrait-pan',
    startClientY: point.clientY,
    startScrollTop: host ? host.scrollTop : 0,
  };
  beginPointerTap(pointerId, payload, point);
  try { cv.setPointerCapture(pointerId); } catch(_) {}
  setHint('Drag empty grass to pan the full field.');
  return true;
}

function addKickToFieldTarget(fieldPoint) {
  if (S.tool !== 'kick' || !activeWorkflowPlayerId() || !fieldPoint) return false;
  S.passes.push({
    from: activeWorkflowPlayerId(),
    to: null,
    targetX: fieldPoint.x,
    targetY: fieldPoint.y,
    style: 'kick',
  });
  S.ball = { x: fieldPoint.x, y: fieldPoint.y };
  S.ballOwner = null;
  S.ballAttached = false;
  applyBallOwnershipVisualState();
  clearPassKickState();
  clearSelectedObject();
  clearDragPlayer();
  // A completed field-target Kick is a one-shot action: auto-return to Move.
  returnInteractionToMoveTool();
  refreshInteractionUI();
  render();
  return true;
}

function syncSpeedButtonsUI() {
  document.querySelectorAll('.speed-btn[data-speed]').forEach((btn) => {
    const btnSpeed = Number(btn.getAttribute('data-speed'));
    btn.classList.toggle('active', btnSpeed === S.animSpd);
  });
  const speedLabel = document.getElementById('spdLabel');
  if (speedLabel) speedLabel.textContent = fmtSpd(S.animSpd);
}

function updateMobilePhaseCounterLabel() {
  const mobilePhaseCounterLabel = document.getElementById('mobilePhaseCounterLabel');
  if (!mobilePhaseCounterLabel) return;
  const mobilePhaseCounter = mobilePhaseCounterLabel;
  mobilePhaseCounter.textContent = `PHASE ${GamePlan.currentPhase + 1}/${GamePlan.phases.length} · MOVE ${S.currentStep + 1}/${sequenceStepCount()}`;
}

function flashMobilePhaseCounter() {
  const mobilePhaseCounter = document.getElementById('mobilePhasePill');
  if (!mobilePhaseCounter) return;
  mobilePhaseCounter.classList.remove('is-flashing');
  void mobilePhaseCounter.offsetWidth;
  mobilePhaseCounter.classList.add('is-flashing');
  setTimeout(() => mobilePhaseCounter.classList.remove('is-flashing'), 420);
}

function finishEraseInteraction(message = 'Object erased. Back in Move mode.') {
  returnInteractionToMoveTool();
  setHint(message);
  refreshInteractionUI();
  render();
}

function showPhoneMoveToast() {
  if (!isPhoneViewport || phoneMoveToastShown) return;
  const toast = document.getElementById('mobileCoachToast');
  if (!toast) return;
  phoneMoveToastShown = true;
  toast.textContent = 'Each MOVE is a moment inside this phase - PLAY runs them in order.';
  toast.classList.add('is-visible');
  toast.setAttribute('aria-hidden', 'false');
  if (phoneMoveToastTimer) clearTimeout(phoneMoveToastTimer);
  phoneMoveToastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
    toast.setAttribute('aria-hidden', 'true');
    phoneMoveToastTimer = null;
  }, 2000);
}

function handlePointerDown(e) {
  clearPendingNoteSelectionClear();
  const fp = getF(e);
  const clampedFieldPoint = clampFieldPoint(fp);
  const canvasPoint = getPx(e);

  // Canonical radial-menu dismissal: a radial menu can only be open while
  // S.tool === 'move' (choosing any action closes it and arms a tool via
  // activateRadialAction()), so any pointerdown reaching the canvas while one
  // is still open is - by definition - a tap outside the menu itself
  // (composedPath already ruled that case out via radialEventTargetsMenu in
  // the separate document-level listener; that listener only ever sees this
  // same event AFTER this handler, since it bubbles from the canvas up to
  // document). Handling the close here, before the normal 'move' tool logic
  // below runs for the same event, is what prevents two known-broken
  // outcomes: (1) tapping the same still-selected player instantly reopening
  // the menu on this same gesture's pointerup (the previous bug - closing
  // only in the document-level listener left wasSelected/isPlayerSelected
  // both true for that tap, so onPointerUp's "tap an already-selected player"
  // branch fired again), and (2) an empty-pitch tap meant only to dismiss the
  // menu instead falling through into starting an unrelated board
  // interaction underneath it.
  if (radialMenu) {
    const priorPlayerId = radialMenu.playerId;
    closeRadialMenu();
    const tappedPlayer = hitPlayer(fp);
    if (!tappedPlayer) {
      // Tapped empty pitch (or anything else non-player): full dismiss -
      // clear the selection and return to Move, swallowing this gesture so
      // it can't also start a drag/annotation/etc. underneath the menu.
      clearSelectedObject();
      returnInteractionToMoveTool();
      refreshInteractionUI();
      render();
      return;
    }
    if (tappedPlayer.id === priorPlayerId) {
      // Tapped the same player the menu was open for: close without
      // reopening from this same gesture.
      refreshInteractionUI();
      render();
      return;
    }
    // Tapped a different player: let the normal 'move' tool selection logic
    // below run for this same event, selecting the new player normally.
  }

  if (S.tool === 'move') {
    const pl = hitPlayer(fp);
    const ballHit = !pl && hitBall(fp);
    const annHit = !pl && !ballHit ? hitAnnotation(fp) : null;
    const clickedPendingMember = pl && S.pendingGroupPlacement
      ? S.pendingGroupPlacement.startPositions?.some(member => member.id === pl.id)
      : false;
    if (S.pendingGroupPlacement && !clickedPendingMember && !annHit) {
      S.draggingPendingGroup = false;
      S.pendingGroupPlacement.anchorStart = { x: clampedFieldPoint.x, y: clampedFieldPoint.y };
      S.pendingGroupPlacement.lastFp = { x: clampedFieldPoint.x, y: clampedFieldPoint.y };
      beginPointerTap(e.pointerId, { type:'pending-group-place' }, e);
      try { cv.setPointerCapture(e.pointerId); } catch(_) {}
      setHint('Drag to place the pack, or tap to drop it on that spot.');
      refreshInteractionUI();
      render();
      return;
    }
    if (showGainline && Math.abs(fp.y - GAINLINE_Y) <= 2) {
      closeRadialMenu();
      snapshot();
      S.dragging = { type:'gainline' };
      clearDragPlayer();
      clearSelectedObject();
      clearPassKickState();
      S.ballAssignCandidate = null;
      beginPointerTap(e.pointerId, { type:'gainline' }, e);
      try { cv.setPointerCapture(e.pointerId); } catch(_) {}
      setHint('Drag the gainline to match the current phase picture.');
      refreshInteractionUI();
      render();
      return;
    }
    const previousSelectedPlayer = S.selectedObjectType === 'player' && S.selectedPlayerId !== null
      ? S.players.find(p => p.id === S.selectedPlayerId)
      : null;
    if (pl) {
      const activeGroup = activeGroupForPlayer(pl);
      const wasSelected = activeGroup ? playerUsesSelectedGroup(pl) : isPlayerSelected(pl.id);
      const isMultiSelect = !activeGroup && (e.ctrlKey || e.metaKey);
      clearPassKickState();
      clearDragPlayer();
      if (activeGroup) {
        selectGroup(activeGroup.id);
        S.dragging = null;
        S.pendingGroupPlacement = buildGroupPlacementState(activeGroup, pl.id);
        beginPointerTap(e.pointerId, { type:'group', id: activeGroup.id }, e);
      } else if (isMultiSelect) {
        togglePlayerSelection(pl.id);
        S.dragging = null;
        S.pointerTap = null;
        S.ballAssignCandidate = selectedPlayers().length === 1 ? pl.id : null;
        closeRadialMenu();
      } else {
        selectPlayer(pl.id);
        setDragPlayer(pl.id);
        S.ballAssignCandidate = pl.id;
        if (!S.moveGuideOrigins[pl.id]) {
          S.moveGuideOrigins[pl.id] = { x: pl.x, y: pl.y };
        }
        S.dragging  = { type:'player', id:pl.id, snapshotDone: false };
        S.dragOff   = { x:fp.x - pl.x, y:fp.y - pl.y };
        beginPointerTap(e.pointerId, { type:'player', id:pl.id, wasSelected, canvasX: canvasPoint.x, canvasY: canvasPoint.y }, e);
      }
      closeRadialMenu();
      try { cv.setPointerCapture(e.pointerId); } catch(_) {}
    } else if (ballHit) {
      const wasSelected = isBallSelected();
      snapshot();
      clearDragPlayer();
      clearPassKickState();
      selectBall(previousSelectedPlayer ? previousSelectedPlayer.id : null);
      S.dragging  = { type:'ball' };
      S.dragOff   = { x:fp.x - S.ball.x, y:fp.y - S.ball.y };
      if (S.ballAttached) S.ballAttached = false;
      beginPointerTap(e.pointerId, { type:'ball', wasSelected }, e);
      closeRadialMenu();
      try { cv.setPointerCapture(e.pointerId); } catch(_) {}
    } else if (annHit) {
      const wasSelected = selectedAnnotationId() === annHit.id;
      clearDragPlayer();
      clearPassKickState();
      selectAnnotationById(annHit.id);
      S.ballAssignCandidate = null;
      const ann = findAnnotationById(annHit.id);
      const isNoteResize = ann?.type === 'note' && annHit.part === 'resize';
      if (!isNoteResize) snapshot();
      const dragOff = ann && (ann.type === 'note' || ann.type === 'zone' || ann.type === 'box' || ann.type === 'ellipse')
        ? { x: fp.x - ann.x, y: fp.y - ann.y }
        : { x: 0, y: 0 };
      const noteResize = isNoteResize
        ? (() => {
            const bounds = noteAnnotationBounds(ann);
            const handle = annHit.handle || 'se';
            return {
              handle,
              anchor: handle === 'nw'
                ? { x: bounds.right, y: bounds.bottom }
                : handle === 'ne'
                  ? { x: bounds.left, y: bounds.bottom }
                  : handle === 'sw'
                    ? { x: bounds.right, y: bounds.top }
                    : { x: bounds.left, y: bounds.top },
              startSnapshot: ann ? cloneData(ann) : null,
              snapshotDone: false,
            };
          })()
        : null;
      const shapeRotate = !isNoteResize && isShapeAnnotationType(ann?.type) && annHit.part === 'rotate'
        ? (() => {
            const center = shapeAnnotationCenter(ann);
            return {
              center,
              startPointerAngle: Math.atan2(fp.y - center.y, fp.x - center.x),
              baseRotation: normalizeShapeRotation(ann.rotation),
            };
          })()
        : null;
      S.dragging = {
        type:'annotation',
        id:annHit.id,
        part:isNoteResize ? 'resize' : annHit.part,
        anchor:{ x:fp.x, y:fp.y },
        dragOff,
        startSnapshot: ann ? cloneData(ann) : null,
        noteResize,
        shapeRotate,
      };
      beginPointerTap(e.pointerId, { type:'annotation', id:annHit.id, wasSelected }, e);
      closeRadialMenu();
      try { cv.setPointerCapture(e.pointerId); } catch(_) {}
    } else {
      closeRadialMenu();
      const kickIdx = hitKickPath(fp);
      const passIdx = hitPassLine(fp);
      const runPid  = hitRunPath(fp);
      if (kickIdx !== -1) {
        clearDragPlayer();
        clearSelectedObject();
        clearPassKickState();
        S.selectedPassIdx = kickIdx;
        S.selectedPathPid = null;
        S.ballAssignCandidate = null;
        S.pointerTap = null;
      } else if (passIdx !== -1) {
        clearDragPlayer();
        clearSelectedObject();
        clearPassKickState();
        S.selectedPassIdx = passIdx;
        S.selectedPathPid = null;
        S.ballAssignCandidate = null;
        S.pointerTap = null;
      } else if (runPid !== null) {
        clearDragPlayer();
        clearSelectedObject();
        clearPassKickState();
        S.selectedPathPid = runPid;
        S.selectedPassIdx = null;
        S.ballAssignCandidate = null;
        S.pointerTap = null;
      } else if (startPortraitPan(e.pointerId, e)) {
        refreshInteractionUI();
        render();
        return;
      } else {
        clearDragPlayer();
        clearSelectedObject();
        clearPassKickState();
        S.selectedPassIdx = null;
        S.selectedPathPid = null;
        S.ballAssignCandidate = null;
        S.pointerTap = null;
      }
    }
    refreshInteractionUI(); render();
  }

  else if (S.tool === 'run') {
    const pl = hitPlayer(fp);
    if (S.activeRunSourceId) {
      if (pl && pl.id === S.activeRunSourceId) {
        cancelArmedRun();
      } else {
        const source = S.players.find(player => player.id === S.activeRunSourceId);
        if (!source) {
          cancelArmedRun();
        } else {
          clearDragPlayer();
          clearPassKickState();
          selectPlayer(source.id, { highlightedIds: [source.id] });
          S.drawing = {
            pid: source.id,
            pts: [{ x: source.x, y: source.y }, { x: fp.x, y: fp.y }],
            last: { x: fp.x, y: fp.y },
          };
          try { cv.setPointerCapture(e.pointerId); } catch(_) {}
          setHint('Draw the run path, then release to finish.');
          refreshInteractionUI();
        }
      }
    } else if (pl) {
      clearDragPlayer();
      clearPassKickState();
      setArmedRunSource(pl.id);
      selectPlayer(pl.id, { highlightedIds: [pl.id] });
      const teamLabel = pl.team === 'A' ? 'Attack' : 'Defence';
      setHint(`Run from ${teamLabel} #${pl.num}. Drag on the pitch to draw the path, or tap the same player again to cancel.`);
      refreshInteractionUI();
    } else {
      setHint('Click a player first to start their run path.');
      refreshInteractionUI();
    }
    render();
  }

  else if (S.tool === 'note') {
    const selectedId = selectedAnnotationId();
    const selectedNote = selectedId ? findAnnotationById(selectedId) : null;
    if (selectedNote?.type === 'note') {
      const selectedHit = hitAnnotation(fp);
      if (selectedHit?.id === selectedNote.id) {
        clearDragPlayer();
        clearPassKickState();
        S.selectedPassIdx = null;
        S.selectedPathPid = null;
        S.ballAssignCandidate = null;
        selectAnnotationById(selectedNote.id);
        const isNoteResize = selectedHit.part === 'resize';
        if (!isNoteResize) snapshot();
        const noteResize = isNoteResize
          ? (() => {
              const bounds = noteAnnotationBounds(selectedNote);
              const handle = selectedHit.handle || 'se';
              return {
                handle,
                anchor: handle === 'nw'
                  ? { x: bounds.right, y: bounds.bottom }
                  : handle === 'ne'
                    ? { x: bounds.left, y: bounds.bottom }
                    : handle === 'sw'
                      ? { x: bounds.right, y: bounds.top }
                      : { x: bounds.left, y: bounds.top },
                startSnapshot: cloneData(selectedNote),
                snapshotDone: false,
              };
            })()
          : null;
        const shapeRotate = !isNoteResize && isShapeAnnotationType(selectedNote?.type) && selectedHit.part === 'rotate'
          ? (() => {
              const center = shapeAnnotationCenter(selectedNote);
              return {
                center,
                startPointerAngle: Math.atan2(fp.y - center.y, fp.x - center.x),
                baseRotation: normalizeShapeRotation(selectedNote.rotation),
              };
            })()
          : null;
        S.dragging = {
          type:'annotation',
          id:selectedNote.id,
          part:isNoteResize ? 'resize' : selectedHit.part,
          anchor:{ x:fp.x, y:fp.y },
          dragOff:{ x: fp.x - selectedNote.x, y: fp.y - selectedNote.y },
          startSnapshot: cloneData(selectedNote),
          noteResize,
          shapeRotate,
        };
        beginPointerTap(e.pointerId, { type:'annotation', id:selectedNote.id, wasSelected: true }, e);
        closeRadialMenu();
        try { cv.setPointerCapture(e.pointerId); } catch(_) {}
        refreshInteractionUI();
        render();
        return;
      }
    }
    const annHit = hitAnnotation(fp);
    if (annHit) {
      const ann = findAnnotationById(annHit.id);
      if (ann?.type === 'note') {
        clearDragPlayer();
        clearPassKickState();
        S.selectedPassIdx = null;
        S.selectedPathPid = null;
        S.ballAssignCandidate = null;
        S.pointerTap = null;
        selectAnnotationById(ann.id);
        setHint('Note selected. Drag it in Move, use the corner handles to resize it, or update the text from Selection.');
        refreshInteractionUI();
        render();
        return;
      }
    }
    snapshot();
    const annotation = normalizeAnnotation({
      id: mkAnnotationId(),
      type: 'note',
      x: fp.x,
      y: fp.y,
      text: defaultAnnotationText(),
      color: annotationColor('note'),
    });
    if (annotation) {
      clampNoteAnnotation(annotation);
      S.annotations.push(annotation);
      selectAnnotationById(annotation.id);
      setHint('Note placed. Drag it in Move, use the corner handles to resize it, or update the text from Selection.');
      refreshInteractionUI();
      render();
    }
  }

  else if (S.tool === 'arrow') {
    // A radial one-shot Arrow is anchored to the source player: the drag only
    // controls the end point, same field-unit coordinates (pl.x/pl.y) used
    // for Pass/Kick lines - no canvas/pixel conversion or hard-coded offset
    // needed since annotations already store field-unit start/end points.
    const radialSource = S.radialArrowSourcePlayerId !== null && S.radialArrowSourcePlayerId !== undefined
      ? S.players.find(player => player.id === S.radialArrowSourcePlayerId) || null
      : null;
    const start = radialSource ? { x: radialSource.x, y: radialSource.y } : { x: fp.x, y: fp.y };
    S.annotationDraft = normalizeAnnotation({
      id: mkAnnotationId(),
      type: 'arrow',
      start,
      end: { x: fp.x, y: fp.y },
      color: currentArrowStyleSelection().color,
      thickness: currentArrowStyleSelection().thickness,
      dash: currentArrowStyleSelection().dash,
    });
    try { cv.setPointerCapture(e.pointerId); } catch(_) {}
    setHint('Drag out the tactical arrow, then release to place it.');
    refreshInteractionUI();
  }

  else if (S.tool === 'zone') {
    if (!isInsidePitch(fp)) {
      setHint('Start the circle highlight inside the pitch. Switch to MOVE to edit existing highlights.');
      refreshInteractionUI();
      render();
      return;
    }
    const shapeStyle = currentShapeStyleSelection('zone');
    S.annotationDraft = normalizeAnnotation({
      id: mkAnnotationId(),
      type: 'ellipse',
      x: clampedFieldPoint.x,
      y: clampedFieldPoint.y,
      w: 1.5,
      h: 1.5,
      color: shapeStyle.color,
      thickness: shapeStyle.thickness,
      dash: shapeStyle.dash,
    });
    S.annotationDraft.anchor = { x: clampedFieldPoint.x, y: clampedFieldPoint.y };
    try { cv.setPointerCapture(e.pointerId); } catch(_) {}
    setHint('Drag outward to size the circle or oval highlight. Hold Shift for a perfect circle.');
    refreshInteractionUI();
  }

  else if (S.tool === 'box') {
    if (!isInsidePitch(fp)) {
      setHint('Start the box highlight inside the pitch. Switch to MOVE to edit existing highlights.');
      refreshInteractionUI();
      render();
      return;
    }
    const shapeStyle = currentShapeStyleSelection('box');
    S.annotationDraft = normalizeAnnotation({
      id: mkAnnotationId(),
      type: 'box',
      x: clampedFieldPoint.x,
      y: clampedFieldPoint.y,
      w: 1.5,
      h: 1.5,
      color: shapeStyle.color,
      thickness: shapeStyle.thickness,
      dash: shapeStyle.dash,
    });
    S.annotationDraft.anchor = { x: clampedFieldPoint.x, y: clampedFieldPoint.y };
    try { cv.setPointerCapture(e.pointerId); } catch(_) {}
    setHint('Drag outward to size the box highlight.');
    refreshInteractionUI();
  }

  else if (S.tool === 'ellipse') {
    if (!isInsidePitch(fp)) {
      setHint('Start the ellipse highlight inside the pitch. Switch to MOVE to edit existing highlights.');
      refreshInteractionUI();
      render();
      return;
    }
    const shapeStyle = currentShapeStyleSelection('ellipse');
    S.annotationDraft = normalizeAnnotation({
      id: mkAnnotationId(),
      type: 'ellipse',
      x: clampedFieldPoint.x,
      y: clampedFieldPoint.y,
      w: 1.5,
      h: 1.5,
      color: shapeStyle.color,
      thickness: shapeStyle.thickness,
      dash: shapeStyle.dash,
    });
    S.annotationDraft.anchor = { x: clampedFieldPoint.x, y: clampedFieldPoint.y };
    try { cv.setPointerCapture(e.pointerId); } catch(_) {}
    setHint('Drag outward to size the ellipse highlight.');
    refreshInteractionUI();
  }

  else if (S.tool === 'pass' || S.tool === 'kick') {
    const pl = hitPlayer(fp);
    if (pl) {
      clearDragPlayer();
      const activeSourceId = activeWorkflowPlayerId();
      if (!activeSourceId) {
        // First click: arm passer/kicker and auto-assign ball to them
        snapshot();
        setWorkflowSource(pl.id, S.tool);
        selectPlayer(pl.id, { highlightedIds: [pl.id] });
        S.ballOwner = playerRef(pl);
        S.ballAttached = true;
        if (!S.ball) S.ball = { x: pl.x, y: pl.y };
        syncAttachedBallToOwner();
        applyBallOwnershipVisualState();
        const teamLabel = pl.team === 'A' ? 'Attack' : 'Defence';
        const hint = S.tool === 'kick'
          ? `Kick from ${teamLabel} #${pl.num}. Tap a player or anywhere on the pitch.`
          : `Pass from ${teamLabel} #${pl.num}. Tap the receiver.`;
        setHint(hint);
        refreshInteractionUI();
      } else if (pl.id !== activeSourceId) {
        // Second click: complete the pass/kick
        const dup = S.passes.find(p => p.from === activeSourceId && p.to === pl.id);
        if (!dup) S.passes.push({ from: activeSourceId, to: pl.id, style: S.tool });
        if (S.tool === 'kick') {
          S.ball = { x: pl.x, y: pl.y };
          S.ballOwner = playerRef(pl);
          S.ballAttached = false;
          applyBallOwnershipVisualState();
        } else {
          S.ballOwner = playerRef(pl);
          S.ballAttached = true;
          syncAttachedBallToOwner();
        }
        clearPassKickState();
        clearSelectedObject();
        clearDragPlayer();
        // A completed Pass/Kick is a one-shot action: auto-return to Move so
        // the coach can immediately select another player.
        returnInteractionToMoveTool();
        refreshInteractionUI();
      } else {
        // Clicked same player again: cancel
        if (S.tool === 'kick') {
          cancelArmedKick();
        } else {
          clearPassKickState();
          clearSelectedObject();
          clearDragPlayer();
          S.pointerTap = null;
          returnInteractionToMoveTool();
          refreshInteractionUI();
        }
      }
      render();
    } else if (startPortraitPan(
      e.pointerId,
      e,
      S.tool === 'kick' && activeWorkflowPlayerId() && isInsidePitch(fp)
        ? { type: 'portrait-pan-kick-target', fieldPoint: { x: clampedFieldPoint.x, y: clampedFieldPoint.y } }
        : { type: 'portrait-pan' }
    )) {
      refreshInteractionUI();
      render();
    } else if (S.tool === 'kick' && activeWorkflowPlayerId() && isInsidePitch(fp)) {
      addKickToFieldTarget(clampedFieldPoint);
    }
  }

  else if (S.tool === 'erase') {
    const erasePlayer = hitPlayer(fp);
    const eraseBall = !erasePlayer && hitBall(fp);
    const eraseAnnotation = !erasePlayer && !eraseBall ? hitAnnotation(fp) : null;
    const eraseRun = hitRunPath(fp);
    const erasePass = hitPassLine(fp);
    const eraseKick = hitKickPath(fp);
    if (isPhoneViewport && !erasePlayer && !eraseBall && !eraseAnnotation && eraseRun === null && erasePass === -1 && eraseKick === -1) {
      startPortraitPan(e.pointerId, e);
      refreshInteractionUI();
      render();
      return;
    }
    let removed = false;

    if (eraseRun !== null) {
      snapshot();
      S.paths = S.paths.filter(path => path.pid !== eraseRun);
      S.selectedPathPid = S.selectedPathPid === eraseRun ? null : S.selectedPathPid;
      removed = true;
    } else if (erasePass !== -1 || eraseKick !== -1) {
      const removeIdx = erasePass !== -1 ? erasePass : eraseKick;
      snapshot();
      S.passes.splice(removeIdx, 1);
      if (S.selectedPassIdx === removeIdx) S.selectedPassIdx = null;
      else if (S.selectedPassIdx !== null && S.selectedPassIdx > removeIdx) S.selectedPassIdx -= 1;
      removed = true;
    } else if (eraseAnnotation) {
      snapshot();
      removeAnnotation(eraseAnnotation.id);
      removed = true;
    } else if (erasePlayer) {
      snapshot();
      removePlayer(erasePlayer.id);
      finishEraseInteraction(`${erasePlayer.team === 'A' ? 'Attack' : 'Defence'} #${erasePlayer.num} erased. Back in Move mode.`);
      return;
    } else if (eraseBall) {
      snapshot();
      S.ball = null;
      clearSelectedObject();
      removed = true;
    }

    if (removed) {
      finishEraseInteraction();
      return;
    }

    refreshInteractionUI();
    render();
  }

  else if (S.tool === 'tele') {
    closeRadialMenu();
    teleDrawing = { pts: [fp], born: Date.now(), color: TELE_COLOR };
    try { cv.setPointerCapture(e.pointerId); } catch(_) {}
    setHint('TELESTRATOR live - draw over the phase. Ink fades after 3 seconds.');
    refreshInteractionUI();
    scheduleRender();
  }
}
cv.addEventListener('pointerdown', handlePointerDown);

function handlePointerMove(e) {
  const samples = getPointerSamples(e);
  const latestSample = samples[samples.length - 1] || e;
  const fp = getF(latestSample);
  const fieldPoint = clampFieldPoint(fp);
  updatePointerTapMovement(latestSample);

  if (
    S.pendingGroupPlacement &&
    S.dragging === null &&
    S.pointerTap?.payload?.type === 'pending-group-place' &&
    S.pointerTap.pointerId === latestSample.pointerId
  ) {
    const dx = latestSample.clientX - S.pointerTap.startClientX;
    const dy = latestSample.clientY - S.pointerTap.startClientY;
    if (Math.hypot(dx, dy) > PENDING_GROUP_DRAG_PX) {
      S.draggingPendingGroup = true;
    }
    if (S.draggingPendingGroup) {
      movePendingGroupTo(S.pendingGroupPlacement, fieldPoint);
      render();
      return;
    }
  }

  // Drag
  if (S.dragging) {
    cv.style.cursor = 'grabbing';
    if (S.dragging.type === 'player') {
      const pl = S.players.find(p => p.id === S.dragPlayerId);
      if (pl) {
        if (!S.dragging.snapshotDone) {
          snapshot();
          S.dragging.snapshotDone = true;
        }
        const prevX = pl.x;
        const prevY = pl.y;
        pl.x = clamp(fp.x - S.dragOff.x, -2, 70);
        pl.y = clamp(fp.y - S.dragOff.y, -11, 111);

        // Warn if this player has a pass drawn from them - moving after drawing distorts the arc
        if (!S.dragging._passWarnShown && S.passes.some(p => p.from === pl.id)) {
          S.dragging._passWarnShown = true;
          setHint('Pass already drawn from this player. Hit + STEP before repositioning to keep the arc accurate.');
        }

        const path = S.paths.find(p => p.pid === pl.id);
        if (path && path.pts.length) translatePathPoints(path, pl.x - prevX, pl.y - prevY);
        if (samePlayerRef(playerRef(pl), S.ballOwner) && S.ball) {
          // Ball magnet: this player owns the ball - always drag it along, regardless of ballAttached state
          S.ball = attachedBallPositionForPlayer(pl);
          S.ballAttached = true;
          applyBallOwnershipVisualState();
        } else if (!S.ballOwner && S.ball) {
          // Loose ball snap: ball has no owner - if player drags within SNAP_RADIUS, they pick it up
          const dist = d2({ x: pl.x, y: pl.y }, S.ball);
          if (dist <= SNAP_RADIUS) {
            S.ballOwner = playerRef(pl);
            S.ballAttached = true;
            S.ball = attachedBallPositionForPlayer(pl);
            pl.isBC = true;
            applyBallOwnershipVisualState();
          }
        }
        if (pl.isBC) {
          updateGainDisplayForY(pl.y);
        }
      }
    } else if (S.dragging.type === 'group') {
      const anchor = S.players.find(player => player.id === S.dragging.anchorPlayerId);
      const startAnchor = S.dragging.startPositions?.find(player => player.id === S.dragging.anchorPlayerId);
      if (anchor && startAnchor) {
        if (!S.dragging.snapshotDone) {
          snapshot();
          S.dragging.snapshotDone = true;
        }
        const members = S.dragging.startPositions
          .map(start => {
            const live = S.players.find(player => player.id === start.id);
            return live ? { live, start } : null;
          })
          .filter(Boolean);
        const dxRaw = (fp.x - anchor.x) + (anchor.x - startAnchor.x);
        const dyRaw = (fp.y - anchor.y) + (anchor.y - startAnchor.y);
        const dxMin = Math.max(...members.map(({ start }) => F.XMIN - start.x));
        const dxMax = Math.min(...members.map(({ start }) => F.XMAX - start.x));
        const dyMin = Math.max(...members.map(({ start }) => F.YMIN - start.y));
        const dyMax = Math.min(...members.map(({ start }) => F.YMAX - start.y));
        const dx = clamp(dxRaw, dxMin, dxMax);
        const dy = clamp(dyRaw, dyMin, dyMax);
        members.forEach(({ live, start }) => {
          const prevX = live.x;
          const prevY = live.y;
          live.x = start.x + dx;
          live.y = start.y + dy;
          const path = S.paths.find(pathItem => pathItem.pid === live.id);
          if (path && path.pts.length) translatePathPoints(path, live.x - prevX, live.y - prevY);
          if (live.isBC && S.ball) {
            if (S.ballAttached && samePlayerRef(playerRef(live), S.ballOwner)) {
              S.ball = attachedBallPositionForPlayer(live);
            } else if (S.dragging.startBall) {
              S.ball.x = S.dragging.startBall.x + dx;
              S.ball.y = S.dragging.startBall.y + dy;
            }
            updateGainDisplayForY(live.y);
          }
        });
      }
    } else if (S.dragging.type === 'ball' && S.ball) {
      S.ball.x = clamp(fp.x - S.dragOff.x, -2, 70);
      S.ball.y = clamp(fp.y - S.dragOff.y, -11, 111);
      const nearest = findBallSnapTarget(S.ball);
      if (nearest) {
        S.ball.x = nearest.x;
        S.ball.y = nearest.y;
        S.players.forEach(p => p.isBC = false);
        nearest.isBC = true;
        S.ballOwner = playerRef(nearest);
        S.ballAttached = false;
      } else {
        S.players.forEach(p => p.isBC = false);
        S.ballOwner = null;
        S.ballAttached = false;
      }
    } else if (S.dragging.type === 'gainline') {
      GAINLINE_Y = clamp(fp.y, 5, 95);
      const carrier = S.players.find(p => p.isBC);
      if (carrier) updateGainDisplayForY(carrier.y);
    } else if (S.dragging.type === 'portrait-pan') {
      // Direct-manipulation drag-to-pan: dragging down reveals content above
      // (scrollTop decreases), matching the content following the finger.
      // #canvasHost is a real native scroll container now, so this is the
      // only place panning happens - there is no render-transform pan offset
      // any more (ox/oy stay 0; see resize()).
      const deltaY = latestSample.clientY - S.dragging.startClientY;
      const host = document.getElementById('canvasHost');
      if (host) host.scrollTop = S.dragging.startScrollTop - deltaY;
    } else if (S.dragging.type === 'annotation') {
      const ann = findAnnotationById(S.dragging.id);
      if (ann) {
        if (ann.type === 'note') {
          if (S.dragging.part === 'move') {
            ann.x = fp.x - (S.dragging.dragOff?.x || 0);
            ann.y = fp.y - (S.dragging.dragOff?.y || 0);
          } else if (S.dragging.part === 'resize') {
            const resizeState = S.dragging.noteResize;
            if (!resizeState?.snapshotDone) {
              snapshot();
              resizeState.snapshotDone = true;
            }
            const anchor = resizeState?.anchor || { x: ann.x, y: ann.y };
            const handle = resizeState?.handle || 'se';
            let left = anchor.x;
            let right = anchor.x;
            let top = anchor.y;
            let bottom = anchor.y;
            if (handle === 'se') {
              right = clamp(fieldPoint.x, anchor.x + NOTE_MIN_WIDTH, Math.min(F.XMAX, anchor.x + NOTE_MAX_WIDTH));
              bottom = clamp(fieldPoint.y, anchor.y + NOTE_MIN_HEIGHT, Math.min(F.YMAX, anchor.y + NOTE_MAX_HEIGHT));
            } else if (handle === 'sw') {
              left = clamp(fieldPoint.x, Math.max(F.XMIN, anchor.x - NOTE_MAX_WIDTH), anchor.x - NOTE_MIN_WIDTH);
              bottom = clamp(fieldPoint.y, anchor.y + NOTE_MIN_HEIGHT, Math.min(F.YMAX, anchor.y + NOTE_MAX_HEIGHT));
            } else if (handle === 'ne') {
              right = clamp(fieldPoint.x, anchor.x + NOTE_MIN_WIDTH, Math.min(F.XMAX, anchor.x + NOTE_MAX_WIDTH));
              top = clamp(fieldPoint.y, Math.max(F.YMIN, anchor.y - NOTE_MAX_HEIGHT), anchor.y - NOTE_MIN_HEIGHT);
            } else {
              left = clamp(fieldPoint.x, Math.max(F.XMIN, anchor.x - NOTE_MAX_WIDTH), anchor.x - NOTE_MIN_WIDTH);
              top = clamp(fieldPoint.y, Math.max(F.YMIN, anchor.y - NOTE_MAX_HEIGHT), anchor.y - NOTE_MIN_HEIGHT);
            }
            setNoteFromBounds(ann, left, top, right, bottom);
            clampNoteAnnotation(ann);
            render();
            return;
          }
          clampNoteAnnotation(ann);
        } else if (ann.type === 'arrow') {
          if (S.dragging.part === 'start') {
            ann.start = { x: fp.x, y: fp.y };
          } else if (S.dragging.part === 'end') {
            ann.end = { x: fp.x, y: fp.y };
          } else {
            const dx = fp.x - S.dragging.anchor.x;
            const dy = fp.y - S.dragging.anchor.y;
            ann.start = { x: ann.start.x + dx, y: ann.start.y + dy };
            ann.end = { x: ann.end.x + dx, y: ann.end.y + dy };
            S.dragging.anchor = { x: fp.x, y: fp.y };
          }
        } else if (ann.type === 'zone') {
          if (S.dragging.part === 'radius') {
            ann.r = Math.max(1.5, d2(fieldPoint, { x: ann.x, y: ann.y }));
          } else if (S.dragging.part === 'center') {
            const base = S.dragging.startSnapshot || ann;
            const angle = Math.atan2(fieldPoint.y - base.y, fieldPoint.x - base.x);
            ann.r = Math.max(1.5, d2(fieldPoint, { x: base.x, y: base.y }));
            ann.x = base.x;
            ann.y = base.y;
            S.dragging.lastAngle = angle;
          } else {
            ann.x = fieldPoint.x - (S.dragging.dragOff?.x || 0);
            ann.y = fieldPoint.y - (S.dragging.dragOff?.y || 0);
          }
          clampZoneAnnotation(ann);
        } else if (ann.type === 'box') {
          if (S.dragging.part === 'move') {
            ann.x = fieldPoint.x - (S.dragging.dragOff?.x || 0);
            ann.y = fieldPoint.y - (S.dragging.dragOff?.y || 0);
          } else if (S.dragging.part === 'rotate') {
            const rotateState = S.dragging.shapeRotate;
            if (rotateState) {
              const currentAngle = Math.atan2(fieldPoint.y - rotateState.center.y, fieldPoint.x - rotateState.center.x);
              let nextRotation = rotateState.baseRotation + ((currentAngle - rotateState.startPointerAngle) * (180 / Math.PI));
              if (latestSample.shiftKey) nextRotation = Math.round(nextRotation / 15) * 15;
              ann.rotation = normalizeShapeRotation(nextRotation);
            }
          } else {
            resizeRotatedShapeAnnotation(ann, S.dragging.startSnapshot || ann, S.dragging.part, fieldPoint, false);
          }
          clampBoxAnnotation(ann);
        } else if (ann.type === 'ellipse') {
          if (S.dragging.part === 'move') {
            ann.x = fieldPoint.x - (S.dragging.dragOff?.x || 0);
            ann.y = fieldPoint.y - (S.dragging.dragOff?.y || 0);
          } else if (S.dragging.part === 'rotate') {
            const rotateState = S.dragging.shapeRotate;
            if (rotateState) {
              const currentAngle = Math.atan2(fieldPoint.y - rotateState.center.y, fieldPoint.x - rotateState.center.x);
              let nextRotation = rotateState.baseRotation + ((currentAngle - rotateState.startPointerAngle) * (180 / Math.PI));
              if (latestSample.shiftKey) nextRotation = Math.round(nextRotation / 15) * 15;
              ann.rotation = normalizeShapeRotation(nextRotation);
            }
          } else {
            resizeRotatedShapeAnnotation(ann, S.dragging.startSnapshot || ann, S.dragging.part, fieldPoint, !!latestSample.shiftKey);
          }
          clampEllipseAnnotation(ann);
        }
      }
    }
    scheduleRender(); return;
  }

  // Freehand draw
  if (S.drawing && S.tool === 'run') {
    if (d2(fp, S.drawing.last) > 1.2) {
      S.drawing.pts.push({x:fp.x, y:fp.y});
      S.drawing.last = {x:fp.x, y:fp.y};
      scheduleRender();
    }
    return;
  }

  if (S.annotationDraft && (S.tool === 'arrow' || S.tool === 'zone' || S.tool === 'box' || S.tool === 'ellipse')) {
    if (S.annotationDraft.type === 'arrow') {
      S.annotationDraft.end = { x: fp.x, y: fp.y };
    }
    if (S.annotationDraft.type === 'zone') {
      S.annotationDraft.r = Math.max(1.5, d2(fieldPoint, { x: S.annotationDraft.x, y: S.annotationDraft.y }));
      clampZoneAnnotation(S.annotationDraft);
    }
    if (S.annotationDraft.type === 'box') {
      const start = S.annotationDraft.anchor || { x: S.annotationDraft.x, y: S.annotationDraft.y };
      setBoxFromBounds(S.annotationDraft, start.x, start.y, fieldPoint.x, fieldPoint.y);
      clampBoxAnnotation(S.annotationDraft);
    }
    if (S.annotationDraft.type === 'ellipse') {
      const start = S.annotationDraft.anchor || { x: S.annotationDraft.x, y: S.annotationDraft.y };
      if (latestSample.shiftKey) {
        const constrained = constrainEllipseBounds(start.x, start.y, fieldPoint.x, fieldPoint.y);
        setEllipseFromBounds(S.annotationDraft, constrained.left, constrained.top, constrained.right, constrained.bottom);
      } else {
        setEllipseFromBounds(S.annotationDraft, start.x, start.y, fieldPoint.x, fieldPoint.y);
      }
      clampEllipseAnnotation(S.annotationDraft);
    }
    scheduleRender();
    return;
  }

  if (S.tool === 'tele' && teleDrawing) {
    teleDrawing.pts.push(fp);
    scheduleRender();
    return;
  }

  // Cursor
  const pl = hitPlayer(fp), bl = hitBall(fp), ann = hitAnnotation(fp);
  if (S.tool === 'move') {
    if (ann?.part === 'resize') cv.style.cursor = noteResizeCursorForHandle(ann.handle);
    else if (ann?.part === 'rotate') cv.style.cursor = 'grab';
    else if (ann && isShapeAnnotationType(findAnnotationById(ann.id)?.type) && ['nw', 'ne', 'sw', 'se'].includes(ann.part)) {
      cv.style.cursor = shapeResizeCursorForHandle(ann.part);
    }
    else {
      const onPath = pl || bl || ann || hitRunPath(fp) !== null || hitPassLine(fp) !== -1 || hitKickPath(fp) !== -1;
      cv.style.cursor = onPath ? 'grab' : 'default';
    }
  } else if (S.tool === 'erase') {
    cv.style.cursor = 'crosshair';
  } else if (S.tool === 'tele') {
    cv.style.cursor = 'crosshair';
  } else if (S.tool === 'run') {
    cv.style.cursor = pl ? 'crosshair' : 'default';
  } else {
    cv.style.cursor = pl ? 'pointer' : 'default';
  }
}
cv.addEventListener('pointermove', handlePointerMove);

function onPointerUp(e) {
  const clampedFieldPoint = clampFieldPoint(getF(e));
  const tap = consumePointerTap(e?.pointerId);
  if (tap && !tap.moved && tap.payload?.type === 'portrait-pan-kick-target') {
    S.dragging = null;
    addKickToFieldTarget(tap.payload.fieldPoint || clampedFieldPoint);
    return;
  }
  if (tap?.payload?.type === 'pending-group-place') {
    const group = selectedGroup() || S.groups.find(item => item.id === S.pendingGroupPlacement?.id) || null;
    snapshot();
    placeGroupAtPoint(S.pendingGroupPlacement, clampedFieldPoint);
    clearPendingGroupPlacement();
    updateBallOwnerFromPosition();
    setHint(group ? `${group.label} placed. Click the pack again to reposition it.` : 'Pack placed.');
    refreshInteractionUI();
    render();
    return;
  }
  if (tap && !tap.moved && tap.payload?.type === 'annotation' && tap.payload.wasSelected && selectedAnnotationId() === tap.payload.id) {
    const tappedAnnotation = findAnnotationById(tap.payload.id);
    if (tappedAnnotation?.type === 'note' && handleSelectedNoteTapForEditing(tap.payload.id)) {
      refreshInteractionUI();
      render();
      return;
    }
  }
  if (tap && !tap.moved && S.tool === 'move') {
    if (tap.payload.type === 'player' && tap.payload.wasSelected && isPlayerSelected(tap.payload.id)) {
      S.dragging = null;
      clearDragPlayer();
      const pl = S.players.find(p => p.id === tap.payload.id);
      if (pl) {
        showRadial(pl, tap.payload.canvasX, tap.payload.canvasY);
      } else {
        closeRadialMenu();
      }
      refreshInteractionUI();
      render();
      return;
    }
    if (tap.payload.type === 'ball' && tap.payload.wasSelected && isBallSelected()) {
      clearSelection();
      render();
      return;
    }
    if (tap.payload.type === 'annotation' && tap.payload.wasSelected && selectedAnnotationId() === tap.payload.id) {
      clearSelection();
      render();
      return;
    }
    if (tap.payload.type === 'group') {
      const group = selectedGroup() || S.groups.find(item => item.id === tap.payload.id) || null;
      if (group && S.pendingGroupPlacement?.id === group.id) {
        setHint(`${group.label} selected. Drag on the field to place the pack, or tap to drop it.`);
      }
      refreshInteractionUI();
      render();
      return;
    }
  }

  if (S.dragging) {
    if (S.dragging.type === 'ball' || S.dragging.type === 'player' || S.dragging.type === 'group') updateBallOwnerFromPosition();
    if (S.dragging.type === 'player' || S.dragging.type === 'group' || S.dragging.type === 'ball' || S.dragging.type === 'annotation') {
      commitLiveBoardToCurrentStep();
    }
    S.dragging = null;
    clearDragPlayer();
    refreshInteractionUI();
    render();
  }
  if (S.tool === 'tele') {
    if (teleDrawing && teleDrawing.pts.length > 1) {
      teleStrokes.push({ ...teleDrawing });
      scheduleTeleFade();
    }
    teleDrawing = null;
    scheduleRender();
  }
  if (S.drawing && S.tool === 'run') finishDraw();
  if (S.annotationDraft && (S.tool === 'arrow' || S.tool === 'zone' || S.tool === 'box' || S.tool === 'ellipse')) finishAnnotationDraft();
}
cv.addEventListener('pointerup', onPointerUp);
cv.addEventListener('pointercancel', onPointerUp);
if (!supportsPointerEvents) {
  cv.addEventListener('touchstart',  e => handlePointerDown(normEvent(e)), { passive: false });
  cv.addEventListener('touchmove',   e => handlePointerMove(normEvent(e)), { passive: false });
  cv.addEventListener('touchend',    e => onPointerUp(normEvent(e)),       { passive: false });
  cv.addEventListener('touchcancel', e => onPointerUp(normEvent(e)),       { passive: false });
}

// Canva-style keyboard shortcuts: Delete/Backspace = delete selected, Escape = deselect
document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (e.key === 'Escape') {
    if (floatingToolbarOpenFlyout) {
      closeFloatingToolbarFlyout();
      e.preventDefault();
      return;
    }
    if (S.dragging?.type === 'annotation' && S.dragging.part === 'resize') {
      const ann = findAnnotationById(S.dragging.id);
      const restore = S.dragging.startSnapshot;
      if (ann && restore?.type === 'note') {
        ann.x = restore.x;
        ann.y = restore.y;
        ann.width = noteWidthValue(restore);
        ann.height = noteHeightValue(restore);
        clampNoteAnnotation(ann);
        S.dragging = null;
        refreshInteractionUI();
        render();
        e.preventDefault();
        return;
      }
    }
    if (selectedAnnotationId()) {
      deleteSelected();
      e.preventDefault();
      return;
    }
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) {
      e.preventDefault();
      return;
    }
    clearSelection();
    refreshInteractionUI();
    render();
    e.preventDefault();
    return;
  }
  if (annotationEditableTarget(e.target)) return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const hasSelection = !!S.selectedPlayerId || !!selectedAnnotationId() ||
      isBallSelected() || S.selectedPassIdx !== null || S.selectedPathPid !== null;
    if (hasSelection) {
      deleteSelected();
      e.preventDefault();
    }
  }
});

document.addEventListener('pointerdown', (event) => {
  if (!noteInlineEditorState) return;
  const editor = document.getElementById('noteInlineEditor');
  if (editor?.contains(event.target)) return;
  endNoteInlineEdit();
  refreshInteractionUI();
  render();
}, true);

document.addEventListener('pointerdown', (event) => {
  if (!floatingToolbarOpenFlyout) return;
  const toolbar = document.getElementById('floatingSelectionToolbar');
  if (!toolbar || toolbar.hidden) {
    closeFloatingToolbarFlyout();
    return;
  }
  if (!toolbar.contains(event.target)) closeFloatingToolbarFlyout();
});

function finishDraw() {
  if (!S.drawing) return;
  if (S.drawing.pts.length >= 2) {
    snapshot();
    const simplified = dpSimplify(S.drawing.pts, 0.8);
    const pl  = S.players.find(p => p.id === S.drawing.pid);
    const col = pl?.team === 'A' ? '#60a5fa' : '#f87171';
    S.paths = S.paths.filter(p => p.pid !== S.drawing.pid);
    S.paths.push({ pid:S.drawing.pid, pts:simplified, color:col });
    commitLiveBoardToCurrentStep();
    S.drawing = null;
    clearArmedRunState();
    clearSelectedObject();
    // A successfully completed Run path is a one-shot action: auto-return to
    // Move so the coach can immediately select another player, matching
    // Pass/Kick/Arrow's completion behavior.
    returnInteractionToMoveTool();
    refreshInteractionUI();
    render();
    return;
  }
  S.drawing = null;
  clearArmedRunState();
  clearSelectedObject();
  setHint('Run path saved. Choose the next action.');
  refreshInteractionUI();
  render();
}

function finishAnnotationDraft() {
  if (!S.annotationDraft) return;
  if (S.annotationDraft.type === 'zone') clampZoneAnnotation(S.annotationDraft);
  if (S.annotationDraft.type === 'box') clampBoxAnnotation(S.annotationDraft);
  if (S.annotationDraft.type === 'ellipse') clampEllipseAnnotation(S.annotationDraft);
  const rawDraft = cloneData(S.annotationDraft);
  const draft = normalizeAnnotation(S.annotationDraft);
  S.annotationDraft = null;
  if (!draft) {
    render();
    return;
  }
  if (draft.type === 'arrow' && d2(draft.start, draft.end) < 1.8) {
    setHint('Arrow cancelled. Drag a little farther to place it.');
    refreshInteractionUI();
    render();
    return;
  }
  if (draft.type === 'zone' && Number(rawDraft.r) < 1.5) {
    setHint('Zone cancelled. Drag outward to create a highlight.');
    refreshInteractionUI();
    render();
    return;
  }
  if (draft.type === 'box' && (Math.abs(Number(rawDraft.w)) < 1.5 || Math.abs(Number(rawDraft.h)) < 1.5)) {
    setHint('Box cancelled. Drag farther to create a highlight.');
    refreshInteractionUI();
    render();
    return;
  }
  if (draft.type === 'ellipse' && (Math.abs(Number(rawDraft.w)) < 1.5 || Math.abs(Number(rawDraft.h)) < 1.5)) {
    setHint('Ellipse cancelled. Drag farther to create a highlight.');
    refreshInteractionUI();
    render();
    return;
  }
  snapshot();
  S.annotations.push(draft);
  commitLiveBoardToCurrentStep();
  // Arrow is a one-shot action, rail or radial alike: auto-return to Move
  // instead of staying selected in the Arrow tool. The only difference
  // between the two entry points is the start point (player-anchored for a
  // radial activation, free-start for the rail) - completion behavior is now
  // identical. The arrow itself, its Undo history entry, and the
  // save/restore schema are all untouched above - only the post-commit
  // interaction state differs from zone/box/note's "stay selected, keep
  // drawing" flow.
  if (draft.type === 'arrow') {
    S.radialArrowSourcePlayerId = null;
    clearSelectedObject();
    completeFirstUseTutorial();
    returnInteractionToMoveTool();
    refreshInteractionUI();
    render();
    return;
  }
  selectAnnotationById(draft.id);
  completeFirstUseTutorial();
  setHint(`${MODE_LABELS[draft.type] || 'Annotation'} placed — selected. Press Delete to remove, or click it again to reposition.`);
  refreshInteractionUI();
  render();
}

function scheduleTeleFade() {
  if (teleFadeRaf || !teleStrokes.length) return;
  teleFadeRaf = requestAnimationFrame(() => {
    teleFadeRaf = null;
    const now = Date.now();
    teleStrokes = teleStrokes.filter(s => now - s.born < TELE_DURATION);
    render();
    if (teleStrokes.length) scheduleTeleFade();
  });
}

// Douglas-Peucker path simplification
function dpSimplify(pts, eps) {
  if (pts.length <= 2) return pts;
  let maxD = 0, maxI = 0;
  for (let i=1; i<pts.length-1; i++) {
    const d = ptLineDist(pts[i], pts[0], pts[pts.length-1]);
    if (d > maxD) { maxD=d; maxI=i; }
  }
  if (maxD > eps) {
    const L = dpSimplify(pts.slice(0, maxI+1), eps);
    const R2 = dpSimplify(pts.slice(maxI),    eps);
    return [...L.slice(0,-1), ...R2];
  }
  return [pts[0], pts[pts.length-1]];
}
function ptLineDist(p, a, b) {
  const dx=b.x-a.x, dy=b.y-a.y;
  if (!dx && !dy) return d2(p, a);
  const t = ((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy);
  const tc = Math.max(0,Math.min(1,t));
  return d2(p, {x:a.x+tc*dx, y:a.y+tc*dy});
}

function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

//  PLAYER MANAGEMENT

function addPlayerByNum(num, team) {
  const now = (typeof performance !== 'undefined' && Number.isFinite(performance.now())) ? performance.now() : Date.now();
  if (isPhoneViewport && lastPhoneAddAction.team === team && (now - lastPhoneAddAction.at) < PHONE_DATA_ACTION_GUARD_MS) {
    return;
  }
  if ((team === 'A' ? S.atkUsed : S.defUsed).has(num)) return; // already on field
  lastPhoneAddAction = { team, at: now };
  snapshot();
  // snapshot() persists the live board into GamePlan.phases[currentPhase] via a
  // freshly normalized object, so S.atkUsed/S.defUsed (getters proxying into that
  // phase) may now point at a new Set instance. Re-read them live rather than
  // reusing a reference captured before snapshot(), or this add is silently lost.
  // Smart placement: stagger across field
  const existing = S.players.filter(p => p.team === team);
  const idx = existing.length;
  const cols = 6, spacingX = 10, spacingY = 12;
  const startX = team === 'A' ? 10 : 10;
  const startY = team === 'A' ? 20 : 70;
  const x = startX + (idx % cols) * spacingX;
  const y = startY + Math.floor(idx / cols) * spacingY;
  S.players.push({
    id: S.nextId++, num, team,
    x: clamp(x, 2, 66), y: clamp(y, -8, 108),
    isBC: false
  });
  (team === 'A' ? S.atkUsed : S.defUsed).add(num);
  completeFirstUseTutorial();
  rebuildPalette();
  setTool('move');
  selectPlayer(S.players[S.players.length - 1].id);
  S.ballAssignCandidate = S.selectedPlayerId;
  setHint(`${team === 'A' ? 'Attack' : 'Defence'} #${num} added. Drag to position.`);
  refreshInteractionUI();
  render();
}

function selectPalettePlayer(num, team) {
  const existing = S.players.find((player) => player.num === num && player.team === team) || null;
  if (!existing) return false;
  setTool('move');
  clearPassKickState();
  selectPlayer(existing.id);
  S.ballAssignCandidate = existing.id;
  setHint(`${team === 'A' ? 'Attack' : 'Defence'} #${num} selected.`);
  refreshInteractionUI();
  render();
  return true;
}

function syncPlayerNumberPickerButtons() {
  ['mobileAddAttackPickerBtn', 'mobileAddDefencePickerBtn', 'mobileRailAddAttackPickerBtn', 'mobileRailAddDefencePickerBtn'].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const isActive = !document.getElementById('playerNumberPopover')?.hidden && playerNumberPickerState.anchorId === id;
    btn.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    btn.classList.toggle('active', isActive);
  });
}

function closePlayerNumberPicker() {
  const popover = document.getElementById('playerNumberPopover');
  if (!popover || popover.hidden) return;
  popover.hidden = true;
  popover.setAttribute('aria-hidden', 'true');
  playerNumberPickerState = { team: null, anchorId: null };
  syncPlayerNumberPickerButtons();
}

function positionPlayerNumberPicker() {
  const popover = document.getElementById('playerNumberPopover');
  const anchor = playerNumberPickerState.anchorId ? document.getElementById(playerNumberPickerState.anchorId) : null;
  if (!popover || popover.hidden || !anchor || !anchor.offsetParent) {
    closePlayerNumberPicker();
    return;
  }
  const rect = anchor.getBoundingClientRect();
  const popoverWidth = popover.offsetWidth;
  const popoverHeight = popover.offsetHeight;
  const margin = 8;
  let left = rect.left + (rect.width / 2) - (popoverWidth / 2);
  left = clamp(left, margin, Math.max(margin, window.innerWidth - popoverWidth - margin));
  let top = rect.top - popoverHeight - 10;
  let below = false;
  if (top < margin) {
    top = rect.bottom + 10;
    below = true;
  }
  top = clamp(top, margin, Math.max(margin, window.innerHeight - popoverHeight - margin));
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.dataset.placement = below ? 'below' : 'above';
}

function renderPlayerNumberPicker() {
  const popover = document.getElementById('playerNumberPopover');
  const grid = document.getElementById('playerNumberPopoverGrid');
  const title = document.getElementById('playerNumberPopoverTitle');
  const meta = document.getElementById('playerNumberPopoverMeta');
  const team = playerNumberPickerState.team;
  if (!popover || !grid || !team) return;
  const used = team === 'A' ? S.atkUsed : S.defUsed;
  title.textContent = `${team === 'A' ? 'Attack' : 'Defence'} Numbers`;
  meta.textContent = 'Pick a number to place, or jump back to one already on the board.';
  grid.innerHTML = '';
  for (let n = 1; n <= 15; n++) {
    const existing = S.players.find((player) => player.num === n && player.team === team) || null;
    const isSelected = !!existing && isPlayerSelected(existing.id);
    const isUsed = used.has(n);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `player-number-popover-btn ${team === 'A' ? 'atk' : 'def'}${isUsed ? ' is-used' : ''}${isSelected ? ' is-selected' : ''}`;
    btn.textContent = String(n);
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    btn.dataset.used = isUsed ? 'true' : 'false';
    btn.title = isUsed
      ? `Select ${team === 'A' ? 'Attack' : 'Defence'} #${n}`
      : `Add ${team === 'A' ? 'Attack' : 'Defence'} #${n}`;
    btn.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    btn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const targetTab = team === 'A' ? 'atk' : 'def';
      if (palTab !== targetTab) setTab(targetTab);
      if (existing) {
        setTimeout(() => {
          closePlayerNumberPicker();
          setTimeout(() => {
            selectPalettePlayer(n, team);
          }, 60);
        }, 0);
        return;
      }
      if (!claimPhoneDataAction(`add-player:${team}:${n}`)) return;
      addPlayerByNum(n, team);
      setTimeout(() => {
        closePlayerNumberPicker();
        setTimeout(() => {
          const added = S.players.find((player) => player.num === n && player.team === team) || null;
          if (!added) return;
          selectPlayer(added.id);
          refreshInteractionUI();
          render();
        }, 60);
      }, 0);
    };
    grid.appendChild(btn);
  }
  popover.hidden = false;
  popover.setAttribute('aria-hidden', 'false');
  syncPlayerNumberPickerButtons();
  positionPlayerNumberPicker();
}

function togglePlayerNumberPicker(team, anchorId, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const popover = document.getElementById('playerNumberPopover');
  if (!popover) return;
  const isSameAnchor = !popover.hidden && playerNumberPickerState.team === team && playerNumberPickerState.anchorId === anchorId;
  if (isSameAnchor) {
    closePlayerNumberPicker();
    return;
  }
  playerNumberPickerState = { team, anchorId };
  renderPlayerNumberPicker();
}
window.togglePlayerNumberPicker = togglePlayerNumberPicker;

function togglePalettePlayer(num, team, event = null) {
  const existing = S.players.find((player) => player.num === num && player.team === team) || null;
  const isMultiSelect = !!(event?.ctrlKey || event?.metaKey);

  if (existing) {
    if (isPlayerSelected(existing.id)) {
      if (isMultiSelect) {
        togglePlayerSelection(existing.id);
        setHint(`${team === 'A' ? 'Attack' : 'Defence'} #${num} ${isPlayerSelected(existing.id) ? 'added to' : 'removed from'} the color selection.`);
        refreshInteractionUI();
        render();
        return;
      }
      clearSelection();
      setHint(`${team === 'A' ? 'Attack' : 'Defence'} #${num} deselected.`);
      refreshInteractionUI();
      render();
      return;
    }

    setTool('move');
    clearPassKickState();
    if (isMultiSelect) {
      togglePlayerSelection(existing.id);
      S.ballAssignCandidate = selectedPlayers().length === 1 ? existing.id : null;
      setHint(`${team === 'A' ? 'Attack' : 'Defence'} #${num} added to the color selection.`);
    } else {
      selectPlayer(existing.id);
      S.ballAssignCandidate = existing.id;
      setHint(`${team === 'A' ? 'Attack' : 'Defence'} #${num} selected.`);
    }
    refreshInteractionUI();
    render();
    return;
  }

  addPlayerByNum(num, team);
}

function addNextAvailablePlayer(team) {
  if (!claimPhoneDataAction(`add-player:${team}`)) return;
  const used = team === 'A' ? S.atkUsed : S.defUsed;
  const nextNum = Array.from({ length: 15 }, (_, idx) => idx + 1).find(num => !used.has(num));
  if (!nextNum) {
    setHint(`${team === 'A' ? 'Attack' : 'Defence'} numbers are already all on the board.`);
    refreshInteractionUI();
    render();
    return;
  }
  const targetTab = team === 'A' ? 'atk' : 'def';
  if (palTab !== targetTab) setTab(targetTab);
  addPlayerByNum(nextNum, team);
}

window.addNextAvailablePlayer = addNextAvailablePlayer;

function addBall() {
  if (!claimPhoneDataAction('add-ball')) return;
  snapshot();
  const selectedPlayer = S.selectedPlayerId !== null
    ? S.players.find(p => p.id === S.selectedPlayerId)
    : null;
  if (selectedPlayer) {
    setTool('move');
    assignBallToPlayer(selectedPlayer, { snapshotBefore: false, source: 'place' });
    return;
  }
  S.ball = { x:34, y:50 };
  S.ballAttached = false;
  updateBallOwnerFromPosition();
  completeFirstUseTutorial();
  setTool('move'); setHint('Ball placed. Drag it to the right spot.'); refreshInteractionUI(); render();
}

function removePlayer(id) {
  const pl = S.players.find(p => p.id === id);
  if (!pl) return;
  if (pl.team === 'A') S.atkUsed.delete(pl.num);
  else                  S.defUsed.delete(pl.num);
  S.players = S.players.filter(p => p.id !== id);
  if (samePlayerRef(playerRef(pl), S.ballOwner)) {
    S.ballOwner = null;
    S.ballAttached = false;
  }
  S.paths   = S.paths.filter(p => p.pid !== id);
  S.passes  = S.passes.filter(p => p.from!==id && p.to!==id);
  if (isPlayerSelected(id)) clearSelectedObject();
  if (S.activePasserId === id || S.activeKickerId === id) clearPassKickState();
  if (S.ballAssignCandidate === id) S.ballAssignCandidate = null;
  applyBallOwnershipVisualState();
  setHint(`${pl.team === 'A' ? 'Attack' : 'Defence'} #${pl.num} removed. That number is available again.`);
  rebuildPalette(); refreshInteractionUI(); render();
}

function deleteSelected() {
  if (selectedGroup()) {
    clearSelection();
    return;
  }
  if (S.selectedPathPid !== null) {
    snapshot();
    S.paths = S.paths.filter(p => p.pid !== S.selectedPathPid);
    S.selectedPathPid = null;
    setHint('Run path removed.');
    refreshInteractionUI(); render();
    return;
  }
  if (S.selectedPassIdx !== null && S.selectedPassIdx < S.passes.length) {
    snapshot();
    const style = S.passes[S.selectedPassIdx]?.style;
    S.passes.splice(S.selectedPassIdx, 1);
    S.selectedPassIdx = null;
    setHint(style === 'kick' ? 'Kick path removed.' : 'Pass line removed.');
    refreshInteractionUI(); render();
    return;
  }
  const annId = selectedAnnotationId();
  if (annId) {
    snapshot();
    removeAnnotation(annId);
  }
  else if (S.selectedPlayerId !== null) {
    snapshot();
    removePlayer(S.selectedPlayerId);
  }
  else if (isBallSelected()) { snapshot(); S.ball=null; S.ballOwner=null; S.ballAttached=false; S.ballAssignCandidate=null; clearSelectedObject(); applyBallOwnershipVisualState(); setHint('Ball removed from the board.'); }
  refreshInteractionUI();
  render();
}
window.deleteSelected = deleteSelected;

function translateAnnotationCopy(sourceAnnotation, dx = ANNOTATION_CLIPBOARD_OFFSET, dy = ANNOTATION_CLIPBOARD_OFFSET) {
  const copy = cloneData(sourceAnnotation);
  copy.id = mkAnnotationId();
  if (copy.type === 'note') {
    copy.x += dx;
    copy.y += dy;
    copy.width = noteWidthValue(copy);
    copy.height = noteHeightValue(copy);
    clampNoteAnnotation(copy);
  } else if (copy.type === 'arrow') {
    copy.start = { ...copy.start };
    copy.end = { ...copy.end };
    const dxMin = Math.max(F.XMIN - copy.start.x, F.XMIN - copy.end.x);
    const dxMax = Math.min(F.XMAX - copy.start.x, F.XMAX - copy.end.x);
    const dyMin = Math.max(F.YMIN - copy.start.y, F.YMIN - copy.end.y);
    const dyMax = Math.min(F.YMAX - copy.start.y, F.YMAX - copy.end.y);
    const shiftX = clamp(dx, dxMin, dxMax);
    const shiftY = clamp(dy, dyMin, dyMax);
    copy.start.x += shiftX;
    copy.start.y += shiftY;
    copy.end.x += shiftX;
    copy.end.y += shiftY;
  } else if (copy.type === 'zone') {
    copy.x += dx;
    copy.y += dy;
    clampZoneAnnotation(copy);
  } else if (copy.type === 'box') {
    copy.x += dx;
    copy.y += dy;
    clampBoxAnnotation(copy);
  } else if (copy.type === 'ellipse') {
    copy.x += dx;
    copy.y += dy;
    clampEllipseAnnotation(copy);
  }
  return copy;
}

function copySelectedAnnotationToClipboard() {
  const ann = selectedAnnotation();
  if (!ann) return false;
  S.annotationClipboard = cloneData(ann);
  return true;
}

function pasteAnnotationFromClipboard(snapshotBefore = true) {
  if (!S.annotationClipboard) return null;
  if (snapshotBefore) snapshot();
  const copy = translateAnnotationCopy(S.annotationClipboard);
  const normalized = normalizeAnnotation(copy);
  if (!normalized) return null;
  S.annotations.push(normalized);
  selectAnnotationById(normalized.id);
  commitLiveBoardToCurrentStep();
  refreshInteractionUI();
  render();
  return normalized;
}

function duplicateSelected() {
  const ann = selectedAnnotation();
  if (!ann) return null;
  snapshot();
  const copy = translateAnnotationCopy(ann);
  const normalized = normalizeAnnotation(copy);
  if (!normalized) return null;
  S.annotations.push(normalized);
  selectAnnotationById(normalized.id);
  commitLiveBoardToCurrentStep();
  refreshInteractionUI();
  render();
  return normalized;
}
window.duplicateSelected = duplicateSelected;

function nudgeSelectedAnnotation(dx, dy) {
  snapshot();
  const ann = selectedAnnotation();
  if (!ann) return false;
  if (ann.type === 'note') {
    ann.x += dx;
    ann.y += dy;
    clampNoteAnnotation(ann);
  } else if (ann.type === 'box') {
    ann.x += dx;
    ann.y += dy;
    clampBoxAnnotation(ann);
  } else if (ann.type === 'ellipse') {
    ann.x += dx;
    ann.y += dy;
    clampEllipseAnnotation(ann);
  } else if (ann.type === 'zone') {
    ann.x += dx;
    ann.y += dy;
    clampZoneAnnotation(ann);
  } else if (ann.type === 'arrow') {
    const dxMin = Math.max(F.XMIN - ann.start.x, F.XMIN - ann.end.x);
    const dxMax = Math.min(F.XMAX - ann.start.x, F.XMAX - ann.end.x);
    const dyMin = Math.max(F.YMIN - ann.start.y, F.YMIN - ann.end.y);
    const dyMax = Math.min(F.YMAX - ann.start.y, F.YMAX - ann.end.y);
    const shiftX = clamp(dx, dxMin, dxMax);
    const shiftY = clamp(dy, dyMin, dyMax);
    ann.start.x += shiftX;
    ann.start.y += shiftY;
    ann.end.x += shiftX;
    ann.end.y += shiftY;
  } else {
    return false;
  }
  commitLiveBoardToCurrentStep();
  refreshInteractionUI();
  render();
  return true;
}

function setSelectedAnnotationOpacity(value) {
  const ann = selectedAnnotation();
  if (!ann) return;
  const opacity = Number(value);
  if (!Number.isFinite(opacity)) return;
  ann.opacity = clamp(opacity, 0.2, 1);
  const floatingOpacity = document.getElementById('floatingToolbarOpacity');
  if (floatingOpacity) floatingOpacity.value = String(ann.opacity);
  refreshInteractionUI();
  render();
}
window.setSelectedAnnotationOpacity = setSelectedAnnotationOpacity;

function sequenceStepCount() {
  ensureSteps();
  return S.steps.length;
}

function sequenceSegmentCount() {
  return Math.max(1, sequenceStepCount() - 1);
}

function currentPlaybackUsesStepSequence() {
  return false;
}

function currentPlaybackUsesImplicitMotion() {
  return canonicalPlaybackTargetIndex() !== null;
}

function playbackDurationSeconds() {
  return DEFAULT_PLAYBACK_DURATION;
}

function currentStepStartProgress() {
  const currentIndex = getCurrentCanonicalMoveIndex();
  const moveCount = getCanonicalMoveCount();
  if (moveCount <= 1 || currentIndex < 0) return 0;
  const lastPlayable = Math.max(0, moveCount - 2);
  return Math.min(lastPlayable, currentIndex) / (moveCount - 1);
}

function stopPlayback(resetProgress = false) {
  cancelCanonicalPlaybackFrame();
  S.animating = false;
  S.lastTs = null;
  if (resetProgress) {
    S.animT = 0;
    canonicalPlaybackBoundaryIndex = null;
    canonicalPlaybackMode = 'idle';
  }
  setPlayBtnState();
}

function buildStepLookup(players = []) {
  const map = new Map();
  players.forEach(pl => {
    const key = playerKey(pl);
    if (key) map.set(key, pl);
  });
  return map;
}

function uniquePlayersByRef(players = []) {
  return Array.from(buildStepLookup(players).values());
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function resolveStepBall(step) {
  const owner = normalizePlayerRef(step?.ballOwner);
  if (step?.ballAttached && owner) {
    const lookup = buildStepLookup(step?.players || []);
    const ownerPlayer = lookup.get(playerKey(owner));
    return ownerPlayer ? attachedBallPositionForPlayer(ownerPlayer) : null;
  }
  const ball = normalizeBallPosition(step?.ball);
  if (ball) return ball;
  if (!owner) return null;
  const lookup = buildStepLookup(step?.players || []);
  const ownerPlayer = lookup.get(playerKey(owner));
  return ownerPlayer ? { x: ownerPlayer.x, y: ownerPlayer.y } : null;
}

function computeChainedStepStates() {
  ensureSteps();
  const sourceSteps = S.steps.map(step => cloneStepState(step || emptyStepState()));
  if (!sourceSteps.length) return [emptyStepState()];

  const chained = [cloneStepState(sourceSteps[0])];
  for (let idx = 1; idx < sourceSteps.length; idx++) {
    const prevState = cloneStepState(chained[idx - 1]);
    const stepDef = sourceSteps[idx];
    const prevLookup = buildStepLookup(prevState.players);
    const defLookup = buildStepLookup(stepDef.players);
    const allKeys = new Set([...prevLookup.keys(), ...defLookup.keys()]);
    const players = Array.from(allKeys).map((key) => {
      const prevPlayer = prevLookup.get(key) || defLookup.get(key);
      const defPlayer = defLookup.get(key) || prevPlayer;
      const defPath = defPlayer ? phasePathForPlayer(stepDef, defPlayer) : null;
      const finalPoint = defPath?.pts?.length ? defPath.pts[defPath.pts.length - 1] : null;
      return {
        ...(cloneData(defPlayer) || cloneData(prevPlayer) || {}),
        x: finalPoint ? finalPoint.x : (Number.isFinite(defPlayer?.x) ? defPlayer.x : prevPlayer?.x),
        y: finalPoint ? finalPoint.y : (Number.isFinite(defPlayer?.y) ? defPlayer.y : prevPlayer?.y),
      };
    });

    const playerLookup = buildStepLookup(players);
    let ball = resolveStepBall(stepDef);
    if (stepDef.ballAttached) {
      const owner = normalizePlayerRef(stepDef.ballOwner);
      const ownerPlayer = owner ? playerLookup.get(playerKey(owner)) : null;
      ball = ownerPlayer ? attachedBallPositionForPlayer(ownerPlayer) : ball;
    } else if (stepDef.passes?.length) {
      const lastPass = stepDef.passes[stepDef.passes.length - 1];
      if (lastPass?.style === 'kick' && lastPass.targetX !== undefined && lastPass.targetY !== undefined) {
        ball = { x: lastPass.targetX, y: lastPass.targetY };
      } else if (lastPass?.toNum !== undefined && lastPass?.toT !== undefined) {
        const receiver = playerLookup.get(playerKey({ num: lastPass.toNum, team: lastPass.toT }));
        if (receiver) ball = attachedBallPositionForPlayer(receiver);
      }
    }

    chained.push({
      ...cloneStepState(stepDef),
      players,
      ball,
      ballOwner: normalizePlayerRef(stepDef.ballOwner),
      ballAttached: !!stepDef.ballAttached,
      paths: cloneData(stepDef.paths),
      passes: cloneData(stepDef.passes),
      annotations: cloneData(stepDef.annotations),
    });
  }

  return chained;
}

function canonicalPlaybackStepAt(ref) {
  if (!ref) return null;
  const phase = normalizePhaseState(GamePlan.phases?.[ref.phaseIndex], ref.phaseIndex);
  if (!Array.isArray(phase.steps) || ref.stepIndex < 0 || ref.stepIndex >= phase.steps.length) return null;
  return cloneStepState(phase.steps[ref.stepIndex] || emptyStepState());
}

function activateCanonicalMoveForPlayback(index, { resetProgress = false } = {}) {
  const ref = getCanonicalMoveRef(index);
  if (!ref) return false;
  const phase = normalizePhaseState(GamePlan.phases?.[ref.phaseIndex], ref.phaseIndex);
  if (!Array.isArray(phase.steps) || ref.stepIndex < 0 || ref.stepIndex >= phase.steps.length) return false;
  if (resetProgress) S.animT = 0;
  GamePlan.currentPhase = ref.phaseIndex;
  phase.currentStep = ref.stepIndex;
  GamePlan.phases[ref.phaseIndex] = phase;
  S.currentStep = ref.stepIndex;
  clearSelectedObject();
  S.dragging = null;
  S.drawing = null;
  clearPassKickState();
  S.annotationDraft = null;
  setLiveBoardFromStep(phase.steps[ref.stepIndex] || emptyStepState());
  rebuildPalette();
  updateSelInfo();
  updatePhaseUI();
  refreshInteractionUI();
  return true;
}

function buildSequenceFrame(progress) {
  const localT = clamp(progress, 0, 1);
  let from = null;
  let to = null;
  let motionStep = null;
  const fromIdx = getCurrentCanonicalMoveIndex();
  const toIdx = canonicalPlaybackTargetIndex(fromIdx);
  const fromRef = getCanonicalMoveRef(fromIdx);
  const toRef = getCanonicalMoveRef(toIdx);
  from = canonicalPlaybackStepAt(fromRef) || emptyStepState();
  if (toIdx === null || !toRef) {
    return {
      ...from,
      segmentIndex: fromIdx,
      localT: 0,
    };
  }
  to = canonicalPlaybackStepAt(toRef) || from;
  motionStep = to;
  let segmentIndex = fromIdx;

  const fromLookup = buildStepLookup(from.players);
  const toLookup = buildStepLookup(to.players);
  const allKeys = new Set([...fromLookup.keys(), ...toLookup.keys()]);
  const players = Array.from(allKeys).map(key => {
    const a = fromLookup.get(key) || toLookup.get(key);
    const b = toLookup.get(key) || fromLookup.get(key);
    const toPath = b ? phasePathForPlayer(motionStep, b) : null;
    if (toPath && Array.isArray(toPath.pts) && toPath.pts.length >= 2) {
      const rebasedPts = [{ x: a.x, y: a.y }, ...toPath.pts.slice(1)];
      const alongPath = catmullRom(rebasedPts, localT);
      return {
        ...(cloneData(a) || cloneData(b) || {}),
        x: alongPath.x,
        y: alongPath.y,
      };
    }
    return {
      ...(cloneData(b) || cloneData(a) || {}),
      x: lerp(a.x, b.x, localT),
      y: lerp(a.y, b.y, localT),
    };
  });
  const fromBall = resolveStepBall(from);
  const toBall = resolveStepBall(to);
  let ball = null;
  if (fromBall && toBall) {
    ball = { x: lerp(fromBall.x, toBall.x, localT), y: lerp(fromBall.y, toBall.y, localT) };
  } else if (toBall) {
    ball = { ...toBall };
  } else if (fromBall) {
    ball = { ...fromBall };
  }
  return {
    players,
    ball,
    ballOwner: normalizePlayerRef(localT < 0.5 ? from.ballOwner : to.ballOwner),
    annotations: cloneData(motionStep.annotations),
    paths: cloneData(motionStep.paths),
    passes: cloneData(motionStep.passes),
    segmentIndex,
    localT,
  };
}

function resolveAnimatedKickBall(frame, playerLookup) {
  if (!frame?.passes?.length) return null;
  const activeKick = [...frame.passes].reverse().find(pass => pass.style === 'kick');
  if (!activeKick) return null;
  const from = playerLookup.get(playerKey({ num: activeKick.fromNum, team: activeKick.fromT }));
  if (!from) return null;
  let target = null;
  if (activeKick.targetX !== undefined && activeKick.targetY !== undefined) {
    target = { x: activeKick.targetX, y: activeKick.targetY };
  } else if (activeKick.toNum !== undefined && activeKick.toT !== undefined) {
    target = playerLookup.get(playerKey({ num: activeKick.toNum, team: activeKick.toT })) || null;
  }
  if (!target) return null;
  return {
    x: lerp(from.x, target.x, frame.localT),
    y: lerp(from.y, target.y, frame.localT),
  };
}

function resolveLiveAnimatedKickBall(progress) {
  if (!S.animating || !S.passes?.length) return null;
  const activeKick = [...S.passes].reverse().find(pass => pass.style === 'kick');
  if (!activeKick) return null;
  const fromPlayer = S.players.find(player => player.id === activeKick.from);
  if (!fromPlayer) return null;
  const from = animPos(fromPlayer, progress);
  let target = null;
  if (activeKick.to === null && activeKick.targetX !== undefined && activeKick.targetY !== undefined) {
    target = { x: activeKick.targetX, y: activeKick.targetY };
  } else {
    const toPlayer = S.players.find(player => player.id === activeKick.to);
    if (!toPlayer) return null;
    target = animPos(toPlayer, progress);
  }
  return {
    x: lerp(from.x, target.x, progress),
    y: lerp(from.y, target.y, progress),
  };
}

function shouldRenderSequencePreview() {
  if (!S.animating) return false;
  return currentPhaseHasPlayablePlayback();
}

function gotoStep(index, { snapshotBefore = false } = {}) {
  clearPendingCanonicalPhaseStart();
  ensureSteps();
  const next = clamp(index, 0, S.steps.length - 1);
  if (next === S.currentStep) return;
  if (snapshotBefore) snapshot();
  persistCurrentStep();
  S.currentStep = next;
  stopPlayback(true);
  S.drawing = null;
  clearPassKickState();
  clearSelectedObject();
  S.annotationDraft = null;
  setLiveBoardFromStep(S.steps[S.currentStep]);
  setHint(`Step ${S.currentStep + 1} ready. Build the next phase from here.`);
  rebuildPalette();
  refreshInteractionUI();
  updateTL();
  render();
}

function prevStep() {
  gotoStep(S.currentStep - 1);
}

function nextStep() {
  gotoStep(S.currentStep + 1);
}

function addStep() {
  if (!claimPhoneDataAction('more:move:add')) return;
  resetDeleteConfirm('move');
  resetDeleteConfirm('phase');
  snapshot();
  persistCurrentStep();
  const next = createCarryForwardStep(S.steps[S.currentStep] || liveBoardToStepState());
  S.steps.splice(S.currentStep + 1, 0, next);
  S.currentStep += 1;
  stopPlayback(true);
  setLiveBoardFromStep(next);
  setHint(`Move ${S.currentStep + 1} added. The previous move was duplicated so you can build the next moment from it.`);
  rebuildPalette();
  refreshInteractionUI();
  flashMobilePhaseCounter();
  showPhoneMoveToast();
  updateTL();
  render();
}

function duplicateStep() {
  snapshot();
  persistCurrentStep();
  const next = cloneStepState(S.steps[S.currentStep] || liveBoardToStepState());
  S.steps.splice(S.currentStep + 1, 0, next);
  S.currentStep += 1;
  stopPlayback(true);
  setLiveBoardFromStep(next);
  setHint(`Step ${S.currentStep + 1} duplicated. Refine the copied phase as needed.`);
  rebuildPalette();
  refreshInteractionUI();
  updateTL();
  render();
}

function deleteStep() {
  ensureSteps();
  if (S.steps.length === 1) {
    snapshot();
    S.steps = [emptyStepState()];
    S.currentStep = 0;
    setLiveBoardFromStep(S.steps[0]);
    stopPlayback(true);
    setHint('Step 1 cleared. Build the sequence again from a clean board.');
  } else {
    snapshot();
    S.steps.splice(S.currentStep, 1);
    S.currentStep = clamp(S.currentStep, 0, S.steps.length - 1);
    stopPlayback(true);
    setLiveBoardFromStep(S.steps[S.currentStep]);
    setHint(`Step removed. Now viewing Step ${S.currentStep + 1}.`);
  }
  rebuildPalette();
  refreshInteractionUI();
  updateTL();
  render();
}

function deleteStepAt(idx) {
  ensureSteps();
  if (S.steps.length === 1) {
    // Only one step - clear it rather than remove
    snapshot();
    S.steps = [emptyStepState()];
    S.currentStep = 0;
    setLiveBoardFromStep(S.steps[0]);
    stopPlayback(true);
    setHint('Step cleared. Board is empty.');
  } else {
    snapshot();
    S.steps.splice(idx, 1);
    // If we deleted a step before or at the current position, adjust currentStep
    S.currentStep = clamp(
      idx < S.currentStep ? S.currentStep - 1 : S.currentStep,
      0, S.steps.length - 1
    );
    stopPlayback(true);
    setLiveBoardFromStep(S.steps[S.currentStep]);
    setHint(`Step ${idx + 1} deleted. Now on Step ${S.currentStep + 1}.`);
  }
  rebuildPalette();
  refreshInteractionUI();
  updateTL();
  render();
}
window.deleteStepAt = deleteStepAt;

function deleteLastMoveWithConfirm() {
  if (!claimPhoneDataAction('more:move:delete')) return;
  if (!confirmDeleteAction('move')) return;
  resetDeleteConfirm('phase');
  ensureSteps();
  snapshot();
  persistCurrentStep();
  const lastIdx = Math.max(0, S.steps.length - 1);
  if (S.steps.length === 1) {
    S.steps = [emptyStepState()];
    S.currentStep = 0;
    setHint('Move 1 reset. Build the phase again from a clean board.');
  } else {
    S.steps.splice(lastIdx, 1);
    S.currentStep = Math.min(S.currentStep, S.steps.length - 1);
    setHint(`Last move removed. Now on Move ${S.currentStep + 1}.`);
  }
  stopPlayback(true);
  setLiveBoardFromStep(S.steps[S.currentStep]);
  rebuildPalette();
  refreshInteractionUI();
  updateTL();
  flashMobilePhaseCounter();
  render();
}

let sequenceDockEls = null;
let sequenceDockAddMoveLock = false;
let sequenceDockAddMoveLockTimer = null;
let sequenceDockPositionRaf = 0;
const SEQUENCE_DOCK_GAP = 18;
const SEQUENCE_DOCK_FULL_WIDTH = 320;
const SEQUENCE_DOCK_COMPACT_WIDTH = 180;
const SEQUENCE_DOCK_COLLAPSED_WIDTH = 148;
let sequenceDockMode = 'full';
let sequenceDockView = 'primary';
let sequenceDockVisible = false;
let sequenceDockSide = 'right';
let pendingCanonicalPhaseStart = false;
let canonicalPlaybackBoundaryIndex = null;
// Runtime-only playback intent for the shared engine. Never persisted (not part of
// GamePlan/save/export/import/history) - reset to 'idle' whenever playback fully stops.
let canonicalPlaybackMode = 'idle'; // 'idle' | 'preview' | 'phase' | 'from-here'
let canonicalPlaybackRafHandle = null;

function cancelCanonicalPlaybackFrame() {
  if (canonicalPlaybackRafHandle !== null) {
    cancelAnimationFrame(canonicalPlaybackRafHandle);
    canonicalPlaybackRafHandle = null;
  }
}

function setSequenceDockVisibility(isVisible) {
  if (!sequenceDockEls?.dock) return;
  sequenceDockVisible = !!isVisible;
  sequenceDockEls.dock.hidden = !isVisible;
  if (!isVisible) {
    sequenceDockView = 'primary';
    sequenceDockEls.dock.style.left = '-9999px';
    sequenceDockEls.dock.style.top = '0px';
  }
  document.getElementById('emptyState')?.classList.toggle('sequence-dock-suppressed', sequenceDockVisible);
  // While the dock is visible it is the single playback-control authority;
  // the duplicated top Play/Pause/Resume control hides (CSS). Phone never
  // reaches this with isVisible=true, so the top control stays there.
  document.body.classList.toggle('sequence-dock-active', sequenceDockVisible);
}

function getRenderedPitchViewportRect() {
  const canvasRect = cv.getBoundingClientRect();
  if (canvasRect.width <= 0 || canvasRect.height <= 0) return null;
  const pitchStart = toC(0, F.YMIN);
  const pitchEnd = toC(F.W, F.YMAX);
  return {
    left: canvasRect.left + Math.min(pitchStart.x, pitchEnd.x),
    right: canvasRect.left + Math.max(pitchStart.x, pitchEnd.x),
    top: canvasRect.top + Math.min(pitchStart.y, pitchEnd.y),
    bottom: canvasRect.top + Math.max(pitchStart.y, pitchEnd.y),
    width: Math.abs(pitchEnd.x - pitchStart.x),
    height: Math.abs(pitchEnd.y - pitchStart.y),
  };
}

function getSequenceDockPlacement(rightSpace, leftSpace) {
  const widths = [
    { mode: 'full', width: SEQUENCE_DOCK_FULL_WIDTH },
    { mode: 'compact', width: SEQUENCE_DOCK_COMPACT_WIDTH },
    { mode: 'collapsed', width: SEQUENCE_DOCK_COLLAPSED_WIDTH },
  ];
  for (const { mode, width } of widths) {
    if (rightSpace >= width + SEQUENCE_DOCK_GAP) return { mode, side: 'right', width };
    if (leftSpace >= width + SEQUENCE_DOCK_GAP) return { mode, side: 'left', width };
  }
  return null;
}

function getSequenceDockModeLabels(mode) {
  if (mode === 'collapsed') {
    return {
      status: `P${GamePlan.currentPhase + 1} · M${S.currentStep + 1}/${sequenceStepCount()}`,
      prev: 'Previous',
      next: 'Next',
      addMove: '+ Move',
      play: 'Play',
      more: 'More',
      back: 'Back',
      duplicate: 'Duplicate',
      preview: 'Preview',
      addPhase: phaseStartContext.kind === 'pending-final' ? 'Cancel Phase' : '+ Phase',
      deleteMove: 'Delete Move',
    };
  }
  if (mode === 'compact') {
    return {
      status: `P${GamePlan.currentPhase + 1} · M${S.currentStep + 1}/${sequenceStepCount()}`,
      prev: 'Previous',
      next: 'Next',
      addMove: '+ Move',
      play: 'Play',
      more: 'More',
      back: 'Back',
      duplicate: 'Duplicate',
      preview: 'Preview',
      addPhase: phaseStartContext.kind === 'pending-final' ? 'Cancel Phase' : 'New Phase',
      deleteMove: 'Delete Move',
    };
  }
  return {
    status: `Phase ${GamePlan.currentPhase + 1} of ${GamePlan.phases.length}. Move ${S.currentStep + 1} of ${sequenceStepCount()}.`,
    prev: 'Previous Move',
    next: 'Next Move',
    addMove: 'Add Move',
    play: 'Play from Here',
    more: 'More',
    back: 'Back',
    duplicate: 'Duplicate Move',
    preview: 'Preview Move',
    addPhase: phaseStartContext.kind === 'pending-final' ? 'Cancel New Phase' : 'Start New Phase',
    deleteMove: 'Delete selected move',
  };
}

function focusSequenceDockViewTarget(view) {
  if (!sequenceDockEls) return;
  if (view === 'secondary') {
    const candidates = [
      sequenceDockEls.duplicate,
      sequenceDockEls.redo,
      sequenceDockEls.back,
    ].filter(Boolean);
    const target = candidates.find(btn => !btn.disabled) || sequenceDockEls.back;
    target?.focus();
    return;
  }
  sequenceDockEls.more?.focus();
}

function setSequenceDockView(view, { focusTarget = false } = {}) {
  const nextView = sequenceDockMode === 'full' ? 'primary' : (view === 'secondary' ? 'secondary' : 'primary');
  const changed = sequenceDockView !== nextView;
  sequenceDockView = nextView;
  updateSequenceDockUI();
  if (changed) scheduleSequenceDockPosition();
  if (focusTarget) {
    requestAnimationFrame(() => focusSequenceDockViewTarget(nextView));
  }
}

function toggleSequenceDockView() {
  if (sequenceDockMode === 'full') return;
  setSequenceDockView(sequenceDockView === 'secondary' ? 'primary' : 'secondary', { focusTarget: true });
}

function positionSequenceControlDock() {
  sequenceDockPositionRaf = 0;
  if (!sequenceDockEls?.dock) return;
  const dock = sequenceDockEls.dock;
  if (isPhoneViewport) {
    setSequenceDockVisibility(false);
    return;
  }

  const viewportWidth = window.visualViewport?.width || window.innerWidth;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const viewportLeft = window.visualViewport?.offsetLeft || 0;
  const viewportTop = window.visualViewport?.offsetTop || 0;
  const viewportRight = viewportLeft + viewportWidth;

  const topbar = document.getElementById('topbar');
  const bottomPanel = document.getElementById('bottomPanel');
  const smartPanel = document.getElementById('smartPanel');
  if (!topbar || !bottomPanel) {
    setSequenceDockVisibility(false);
    return;
  }

  const pitchRect = getRenderedPitchViewportRect();
  if (pitchRect.width <= 0 || pitchRect.height <= 0) {
    setSequenceDockVisibility(false);
    return;
  }

  const previousHidden = dock.hidden;
  const previousVisibility = dock.style.visibility;
  dock.hidden = false;
  dock.style.visibility = 'hidden';
  const dockRect = dock.getBoundingClientRect();
  const dockWidth = dockRect.width;
  const dockHeight = dockRect.height;
  if (previousHidden) dock.hidden = true;
  dock.style.visibility = previousVisibility;

  if (dockWidth <= 0 || dockHeight <= 0) {
    setSequenceDockVisibility(false);
    return;
  }

  const safeLeftBoundary = Math.max(
    viewportLeft,
    smartPanel?.getBoundingClientRect().right || viewportLeft
  );
  const rightSpace = viewportRight - pitchRect.right;
  const leftSpace = pitchRect.left - safeLeftBoundary;
  const placement = getSequenceDockPlacement(rightSpace, leftSpace);
  if (!placement) {
    setSequenceDockVisibility(false);
    return;
  }
  const previousMode = sequenceDockMode;
  sequenceDockMode = placement.mode;
  sequenceDockSide = placement.side;
  if (sequenceDockMode === 'full' || previousMode !== sequenceDockMode) sequenceDockView = 'primary';
  updateSequenceDockUI();

  const previousHiddenAfterMode = dock.hidden;
  const previousVisibilityAfterMode = dock.style.visibility;
  dock.hidden = false;
  dock.style.visibility = 'hidden';
  const activeDockRect = dock.getBoundingClientRect();
  const activeDockWidth = activeDockRect.width;
  const activeDockHeight = activeDockRect.height;
  if (previousHiddenAfterMode) dock.hidden = true;
  dock.style.visibility = previousVisibilityAfterMode;

  const dockLeft = sequenceDockSide === 'right'
    ? pitchRect.right + SEQUENCE_DOCK_GAP
    : pitchRect.left - activeDockWidth - SEQUENCE_DOCK_GAP;

  const topLimit = Math.max(viewportTop + 10, topbar.getBoundingClientRect().bottom + 10);
  const bottomLimit = Math.min(viewportTop + viewportHeight - activeDockHeight - 10, bottomPanel.getBoundingClientRect().top - activeDockHeight - 10);
  if (bottomLimit < topLimit) {
    setSequenceDockVisibility(false);
    return;
  }

  const idealTop = pitchRect.top + ((pitchRect.height - activeDockHeight) / 2);
  const dockTop = clamp(idealTop, topLimit, bottomLimit);
  setSequenceDockVisibility(true);
  dock.dataset.mode = sequenceDockMode;
  dock.dataset.side = sequenceDockSide;
  dock.dataset.view = sequenceDockView;
  dock.style.left = `${Math.round(dockLeft)}px`;
  dock.style.top = `${Math.round(dockTop)}px`;
  dock.style.right = 'auto';
}

function scheduleSequenceDockPosition() {
  if (sequenceDockPositionRaf) return;
  sequenceDockPositionRaf = requestAnimationFrame(positionSequenceControlDock);
}

function releaseSequenceDockAddMoveLock() {
  sequenceDockAddMoveLock = false;
  if (sequenceDockAddMoveLockTimer) {
    clearTimeout(sequenceDockAddMoveLockTimer);
    sequenceDockAddMoveLockTimer = null;
  }
  updateSequenceDockUI();
}

function handleSequenceDockAddMove() {
  if (sequenceDockAddMoveLock) return;
  sequenceDockAddMoveLock = true;
  updateSequenceDockUI();
  sequenceDockAddMoveLockTimer = setTimeout(releaseSequenceDockAddMoveLock, 350);
  try {
    addStep();
  } catch (err) {
    releaseSequenceDockAddMoveLock();
    throw err;
  }
}

function confirmDeleteSelectedMoveFromDock() {
  const moveCount = getCanonicalMoveCount();
  const moveIndex = getCurrentCanonicalMoveIndex();
  const targetRef = getCanonicalMoveRef(moveIndex);
  if (moveCount <= 1 || !targetRef) return;
  let message = `Delete Move ${moveIndex + 1} of ${moveCount}?`;
  if (phaseStepCountAt(targetRef.phaseIndex) === 1) {
    message += `\n\nThis will also remove Phase ${targetRef.phaseIndex + 1}.`;
  }
  if (!window.confirm(message)) return;
  deleteCanonicalMove(moveIndex);
}

// Secondary dock control: Stop only. It never resumes - the one universal
// Pause/Resume control is sequenceDockPlay (see toggleSmartPlay/togglePlayAll).
function handleSequenceDockPlaybackControl() {
  if (!S.animating && !isCanonicalPlaybackPaused()) return;
  stopPlayback(true);
  refreshInteractionUI();
  updateTL();
  render();
}

function updateSequenceDockUI() {
  if (!sequenceDockEls) return;
  const phaseCount = GamePlan.phases.length;
  const moveCount = sequenceStepCount();
  const currentPhase = GamePlan.currentPhase + 1;
  const currentMove = S.currentStep + 1;
  const previewPlayable = currentPhaseHasPlayablePlayback();
  const playFromHerePlayable = projectHasPlayablePlayback();
  const hasPausedPlayback = !S.animating && S.animT > 0;
  const isAnimating = !!S.animating;
  const editingLocked = isAnimating;
  const showPlaybackControl = isAnimating || hasPausedPlayback;
  const isFullMode = sequenceDockMode === 'full';
  const isSecondaryView = !isFullMode && sequenceDockView === 'secondary';
  const labels = getSequenceDockModeLabels(sequenceDockMode);
  let playbackControlLabel = '';
  let playbackControlAria = '';

  if (isAnimating) {
    playbackControlLabel = 'Pause';
    playbackControlAria = 'Pause playback';
  } else if (hasPausedPlayback) {
    playbackControlLabel = 'Resume';
    playbackControlAria = S.playAll ? 'Resume playback from here to the end' : 'Resume move preview';
  }

  sequenceDockEls.dock.dataset.mode = sequenceDockMode;
  sequenceDockEls.dock.dataset.side = sequenceDockSide;
  sequenceDockEls.dock.dataset.view = isFullMode ? 'full' : sequenceDockView;
  sequenceDockEls.phase.textContent = `${currentPhase} / ${phaseCount}`;
  sequenceDockEls.move.textContent = `${currentMove} / ${moveCount}`;
  sequenceDockEls.status.textContent = labels.status;
  sequenceDockEls.prev.textContent = labels.prev;
  sequenceDockEls.next.textContent = labels.next;
  sequenceDockEls.addMove.textContent = labels.addMove;
  sequenceDockEls.play.textContent = labels.play;
  sequenceDockEls.more.textContent = labels.more;
  sequenceDockEls.duplicate.textContent = labels.duplicate;
  sequenceDockEls.preview.textContent = labels.preview;
  sequenceDockEls.addPhase.textContent = labels.addPhase;
  sequenceDockEls.deleteMove.textContent = labels.deleteMove;
  sequenceDockEls.back.textContent = labels.back;
  sequenceDockEls.prev.disabled = S.currentStep === 0 || editingLocked;
  sequenceDockEls.next.disabled = S.currentStep >= moveCount - 1 || editingLocked;
  sequenceDockEls.addMove.disabled = editingLocked || sequenceDockAddMoveLock;
  sequenceDockEls.duplicate.disabled = editingLocked || moveCount < 1;
  sequenceDockEls.play.disabled = !playFromHerePlayable;
  sequenceDockEls.preview.disabled = !previewPlayable;
  sequenceDockEls.more.hidden = isFullMode;
  sequenceDockEls.more.disabled = isFullMode;
  sequenceDockEls.more.tabIndex = isFullMode ? -1 : 0;
  sequenceDockEls.more.setAttribute('aria-expanded', isSecondaryView ? 'true' : 'false');
  sequenceDockEls.primaryPanel.hidden = !isFullMode && isSecondaryView;
  sequenceDockEls.secondaryPanel.hidden = !isFullMode && !isSecondaryView;
  sequenceDockEls.back.hidden = isFullMode;
  sequenceDockEls.back.disabled = isFullMode;
  sequenceDockEls.back.tabIndex = isFullMode || !isSecondaryView ? -1 : 0;
  sequenceDockEls.playbackControl.hidden = false;
  sequenceDockEls.playbackControl.disabled = !showPlaybackControl;
  sequenceDockEls.playbackControl.tabIndex = showPlaybackControl ? 0 : -1;
  sequenceDockEls.playbackControl.textContent = playbackControlLabel;
  sequenceDockEls.playbackControl.classList.toggle('sequence-dock__playback-control--inactive', !showPlaybackControl);
  if (showPlaybackControl) {
    sequenceDockEls.playbackControl.setAttribute('aria-label', playbackControlAria);
  } else {
    sequenceDockEls.playbackControl.removeAttribute('aria-label');
  }
  sequenceDockEls.addPhase.disabled = editingLocked;
  sequenceDockEls.deleteMove.disabled = editingLocked || moveCount < 1;
}

function initSequenceControlDock() {
  const dock = document.getElementById('sequenceControlDock');
  if (!dock) return;
  sequenceDockEls = {
    dock,
    phase: document.getElementById('sequenceDockPhase'),
    move: document.getElementById('sequenceDockMove'),
    status: document.getElementById('sequenceDockStatus'),
    prev: document.getElementById('sequenceDockPrev'),
    next: document.getElementById('sequenceDockNext'),
    addMove: document.getElementById('sequenceDockAddMove'),
    more: document.getElementById('sequenceDockMore'),
    primaryPanel: document.getElementById('sequenceDockPrimaryPanel'),
    secondaryPanel: document.getElementById('sequenceDockSecondaryPanel'),
    duplicate: document.getElementById('sequenceDockDuplicate'),
    play: document.getElementById('sequenceDockPlay'),
    preview: document.getElementById('sequenceDockPreview'),
    playbackControl: document.getElementById('sequenceDockPlaybackControl'),
    addPhase: document.getElementById('sequenceDockAddPhase'),
    phaseActionStatus: document.getElementById('sequenceDockPhaseActionStatus'),
    deleteMove: document.getElementById('sequenceDockDelete'),
    back: document.getElementById('sequenceDockBack'),
  };

  sequenceDockEls.prev.addEventListener('click', prevStep);
  sequenceDockEls.next.addEventListener('click', nextStep);
  sequenceDockEls.addMove.addEventListener('click', handleSequenceDockAddMove);
  sequenceDockEls.more.addEventListener('click', toggleSequenceDockView);
  sequenceDockEls.duplicate.addEventListener('click', duplicateStep);
  sequenceDockEls.play.addEventListener('click', toggleSmartPlay);
  sequenceDockEls.preview.addEventListener('click', previewCurrentMove);
  sequenceDockEls.playbackControl.addEventListener('click', handleSequenceDockPlaybackControl);
  sequenceDockEls.addPhase.addEventListener('click', handleSequenceDockStartPhase);
  sequenceDockEls.deleteMove.addEventListener('click', confirmDeleteSelectedMoveFromDock);
  sequenceDockEls.back.addEventListener('click', () => setSequenceDockView('primary', { focusTarget: true }));
  updateSequenceDockUI();
  scheduleSequenceDockPosition();
}

function updateSequenceUI() {
  syncPendingCanonicalPhaseStart();
  const prevBtn = document.getElementById('seqPrevBtn');
  const nextBtn = document.getElementById('seqNextBtn');
  const seqBarPrev = document.getElementById('seqBarPrev');
  const seqBarNext = document.getElementById('seqBarNext');
  const playIcon  = document.getElementById('seqBarPlayIcon');
  const playLabel = document.getElementById('seqBarPlayLabel');
  const playBtn = document.getElementById('playBtn');
  const tlPlayBtn = document.getElementById('tlPlayBtn');
  const count = sequenceStepCount();
  const playable = currentPhaseHasPlayablePlayback();
  if (prevBtn) prevBtn.disabled = S.currentStep === 0;
  if (nextBtn) nextBtn.disabled = S.currentStep >= count - 1;
  if (seqBarPrev) seqBarPrev.disabled = S.currentStep === 0;
  if (seqBarNext) seqBarNext.disabled = S.currentStep >= sequenceStepCount() - 1;
  if (playIcon)  playIcon.innerHTML = S.animating ? '&#9208;' : '&#9654;';
  if (playLabel) playLabel.textContent = S.animating ? 'PAUSE' : 'PLAY';
  if (playBtn) playBtn.disabled = !playable;
  if (tlPlayBtn) tlPlayBtn.disabled = !playable;
  updateSequenceDockUI();
  scheduleSequenceDockPosition();
}

function updatePhaseUI() {
  const strip = document.getElementById('phaseChipStrip');
  if (!strip) return;
  const currentCanonicalIndex = getCurrentCanonicalMoveIndex();
  const phases = Array.isArray(GamePlan.phases) ? GamePlan.phases : [];
  const phaseShort = tr('phase.short', {}, 'PHASE');
  strip.innerHTML = '';
  let moveCursor = 0;
  phases.forEach((phase, phaseIndex) => {
    const stepCount = Array.isArray(phase?.steps) ? phase.steps.length : 0;
    if (!stepCount) return;
    const firstIndexInPhase = moveCursor;

    const group = document.createElement('div');
    group.className = `tb-phase-group${phaseIndex === GamePlan.currentPhase ? ' active' : ''}`;

    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'tb-phase-label';
    label.textContent = `${phaseShort} ${phaseIndex + 1}`;
    label.title = `Go to ${phaseShort} ${phaseIndex + 1}`;
    label.setAttribute('aria-label', `Go to ${phaseShort} ${phaseIndex + 1}, starting at Move ${firstIndexInPhase + 1}`);
    label.onclick = () => handleCanonicalMoveChipSelect(firstIndexInPhase);
    group.appendChild(label);

    const moves = document.createElement('div');
    moves.className = 'tb-phase-moves';
    for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
      const globalIndex = moveCursor;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tb-phase-chip${globalIndex === currentCanonicalIndex ? ' active' : ''}`;
      btn.textContent = String(globalIndex + 1);
      btn.title = `Go to Move ${globalIndex + 1}`;
      btn.setAttribute('aria-label', `Go to Move ${globalIndex + 1}`);
      if (globalIndex === currentCanonicalIndex) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
      btn.onclick = () => handleCanonicalMoveChipSelect(globalIndex);
      moves.appendChild(btn);
      moveCursor += 1;
    }
    group.appendChild(moves);
    strip.appendChild(group);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'tb-phase-chip tb-phase-chip-add';
  addBtn.textContent = '+';
  addBtn.title = 'Add Move';
  addBtn.setAttribute('aria-label', 'Add Move');
  addBtn.onclick = () => addCanonicalMove();
  strip.appendChild(addBtn);
  scheduleSequenceBarScroller({ center: true, behavior: 'auto' });
}

function getCanonicalPhaseActionShortLabel(kind) {
  switch (kind) {
    case 'existing-boundary': return tr('dock.removeBreak');
    case 'pending-final': return tr('dock.cancelPhase');
    case 'final-move': return tr('dock.newPhase');
    case 'split-available': return tr('dock.newPhase');
    default: return tr('dock.phase');
  }
}

function getSequenceDockModeLabels(mode) {
  const phaseAction = getCanonicalPhaseActionDetails();
  if (mode === 'collapsed' || mode === 'compact') {
    return {
      addMove: tr('dock.addMove.short'),
      play: tr('dock.play'),
      playPhase: tr('dock.playPhase'),
      more: tr('dock.more'),
      back: tr('dock.back'),
      duplicate: tr('dock.duplicate'),
      preview: tr('dock.preview'),
      undo: tr('dock.undo'),
      redo: tr('dock.redo'),
      addPhase: getCanonicalPhaseActionShortLabel(phaseAction.context.kind),
      deleteMove: tr('dock.deleteMove'),
    };
  }
  return {
    addMove: tr('dock.addMove'),
    play: tr('dock.playFromHere'),
    playPhase: tr('dock.playPhase'),
    more: tr('dock.more'),
    back: tr('dock.back'),
    duplicate: tr('dock.duplicateMove'),
    preview: tr('dock.previewMove'),
    undo: tr('dock.undo'),
    redo: tr('dock.redo'),
    addPhase: phaseAction.label,
    deleteMove: tr('dock.deleteMove'),
  };
}

function handleSequenceDockAddMove() {
  if (sequenceDockAddMoveLock) return;
  sequenceDockAddMoveLock = true;
  updateSequenceDockUI();
  sequenceDockAddMoveLockTimer = setTimeout(releaseSequenceDockAddMoveLock, 350);
  try {
    addCanonicalMove();
  } catch (err) {
    releaseSequenceDockAddMoveLock();
    throw err;
  }
}

function handleSequenceDockStartPhase() {
  return startCanonicalPhaseAfterCurrentMove();
}

function handleSequenceDockPlayPhase() {
  if (S.animating) {
    stopPlayback(false);
    refreshInteractionUI();
    updateTL();
    render();
    return;
  }
  if (isCanonicalPlaybackPaused()) {
    resumeCanonicalPlayback();
    return;
  }
  playCurrentCanonicalPhase();
}

function updateSequenceDockUI() {
  if (!sequenceDockEls) return;
  syncPendingCanonicalPhaseStart();
  const canonicalMove = getCanonicalMoveDisplay();
  const phaseAction = getCanonicalPhaseActionDetails();
  const phaseCount = GamePlan.phases.length;
  const hasValidPhase = Number.isInteger(GamePlan.currentPhase) && GamePlan.currentPhase >= 0 && GamePlan.currentPhase < phaseCount;
  const currentPhase = hasValidPhase ? GamePlan.currentPhase + 1 : null;
  const previewPlayable = currentPhaseHasPlayablePlayback();
  const playFromHerePlayable = projectHasPlayablePlayback();
  const phaseRange = getCanonicalPhasePlaybackRange();
  const playPhasePlayable = !!phaseRange && phaseRange.moveCount > 1;
  const isAnimating = !!S.animating;
  const hasPausedPlayback = !isAnimating && S.animT > 0;
  const anySessionActive = isAnimating || hasPausedPlayback;
  const editingLocked = isAnimating;
  const showPlaybackControl = anySessionActive;
  const isFullMode = sequenceDockMode === 'full';
  const isSecondaryView = !isFullMode && sequenceDockView === 'secondary';
  const labels = getSequenceDockModeLabels(sequenceDockMode);
  const phaseStartPending = phaseAction.pressed;
  const phaseStartDisabled = editingLocked || canonicalMove.count < 1 || phaseAction.disabled;
  const deleteDisabled = editingLocked || canonicalMove.count <= 1;
  const historyDisabled = editingLocked || !(S.history && S.history.length);
  const futureDisabled = editingLocked || !(S.future && S.future.length);
  // Exactly one universal Pause/Resume control (sequenceDockPlay). The secondary
  // control is Stop-only; Play Phase and Preview never relabel themselves.
  const playbackControlLabel = showPlaybackControl ? tr('dock.stop') : '';
  const playbackControlAria = tr('dock.stop.aria');

  sequenceDockEls.dock.dataset.mode = sequenceDockMode;
  sequenceDockEls.dock.dataset.side = sequenceDockSide;
  sequenceDockEls.dock.dataset.view = isFullMode ? 'full' : sequenceDockView;
  const translatedMoveHeadline = canonicalMove.hasSelection
    ? (isFullMode
      ? tr('dock.moveOf', { current: canonicalMove.current, total: canonicalMove.count })
      : tr('dock.moveCompact', { current: canonicalMove.current, total: canonicalMove.count }))
    : (isFullMode ? tr('dock.moveEmpty') : tr('dock.moveCompactEmpty'));
  const translatedPhaseHeadline = currentPhase !== null
    ? (isFullMode
      ? tr('dock.phaseOf', { current: currentPhase, total: phaseCount })
      : tr('dock.phaseCompact', { current: currentPhase, total: phaseCount }))
    : (isFullMode ? tr('dock.phaseEmpty') : tr('dock.phaseCompactEmpty'));

  sequenceDockEls.moveHeadline.textContent = canonicalMove.hasSelection
    ? (isFullMode ? `Move ${canonicalMove.current} of ${canonicalMove.count}` : `M ${canonicalMove.current}/${canonicalMove.count}`)
    : (isFullMode ? 'Move — of —' : 'M —/—');
  sequenceDockEls.phaseHeadline.textContent = currentPhase !== null
    ? (isFullMode ? `Phase ${currentPhase} of ${phaseCount}` : `P ${currentPhase}/${phaseCount}`)
    : (isFullMode ? 'Phase — of —' : 'P —/—');

  sequenceDockEls.moveHeadline.textContent = translatedMoveHeadline;
  sequenceDockEls.phaseHeadline.textContent = translatedPhaseHeadline;

  // sequenceDockPlay is the ONE universal Pause/Resume control in the dock.
  let playLabel = labels.play;
  let playAria = 'Play from the selected move to the end';
  if (anySessionActive) {
    playLabel = isAnimating ? 'Pause' : 'Resume';
    playAria = isAnimating ? 'Pause playback' : 'Resume playback';
  }
  if (anySessionActive) {
    playLabel = isAnimating ? tr('dock.pause') : tr('dock.resume');
    playAria = isAnimating ? tr('dock.pause.aria') : tr('dock.resume.aria');
  } else {
    playAria = tr('dock.playFromHere.aria');
  }
  sequenceDockEls.play.textContent = playLabel;
  sequenceDockEls.play.setAttribute('aria-label', playAria);
  sequenceDockEls.play.disabled = anySessionActive ? false : !playFromHerePlayable;

  // Play Phase and Preview never relabel to Pause/Resume - they only start a
  // session. While any session is active or paused, they stay on their normal
  // label and are disabled until the coach stops playback via sequenceDockPlay
  // or the secondary Stop control.
  sequenceDockEls.playPhase.textContent = labels.playPhase;
  sequenceDockEls.playPhase.disabled = anySessionActive || !playPhasePlayable;
  sequenceDockEls.playPhase.title = anySessionActive
    ? 'Stop the current playback first'
    : (playPhasePlayable ? 'Play this Phase from its first Move' : 'This Phase contains only one Move');
  sequenceDockEls.playPhase.setAttribute('aria-label', anySessionActive
    ? 'Play Phase unavailable: stop the current playback first'
    : (playPhasePlayable ? 'Play the current Phase from its first move' : 'Play Phase unavailable: this Phase contains only one Move'));
  sequenceDockEls.playPhase.title = anySessionActive
    ? tr('dock.playPhase.title.busy')
    : (playPhasePlayable ? tr('dock.playPhase.title.ready') : tr('dock.playPhase.title.single'));
  sequenceDockEls.playPhase.setAttribute('aria-label', anySessionActive
    ? tr('dock.playPhase.aria.busy')
    : (playPhasePlayable ? tr('dock.playPhase.aria.ready') : tr('dock.playPhase.aria.single')));

  sequenceDockEls.addMove.textContent = labels.addMove;
  sequenceDockEls.addMove.disabled = editingLocked || sequenceDockAddMoveLock;
  sequenceDockEls.duplicate.textContent = labels.duplicate;
  sequenceDockEls.duplicate.disabled = editingLocked || canonicalMove.count < 1;
  sequenceDockEls.preview.textContent = labels.preview;
  sequenceDockEls.preview.disabled = anySessionActive || !previewPlayable;
  sequenceDockEls.preview.title = anySessionActive
    ? 'Stop the current playback first'
    : (previewPlayable ? 'Preview the next transition' : 'No later move available to preview');
  sequenceDockEls.preview.setAttribute('aria-label', anySessionActive
    ? 'Preview unavailable: stop the current playback first'
    : (previewPlayable ? 'Preview only the selected move' : 'Preview unavailable: no later move'));
  sequenceDockEls.preview.title = anySessionActive
    ? tr('dock.preview.title.busy')
    : (previewPlayable ? tr('dock.preview.title.ready') : tr('dock.preview.title.none'));
  sequenceDockEls.preview.setAttribute('aria-label', anySessionActive
    ? tr('dock.preview.aria.busy')
    : (previewPlayable ? tr('dock.preview.aria.ready') : tr('dock.preview.aria.none')));
  sequenceDockEls.more.textContent = labels.more;
  sequenceDockEls.more.hidden = isFullMode;
  sequenceDockEls.more.disabled = isFullMode;
  sequenceDockEls.more.tabIndex = isFullMode ? -1 : 0;
  sequenceDockEls.more.setAttribute('aria-expanded', isSecondaryView ? 'true' : 'false');
  sequenceDockEls.primaryPanel.hidden = !isFullMode && isSecondaryView;
  sequenceDockEls.secondaryPanel.hidden = !isFullMode && !isSecondaryView;
  sequenceDockEls.back.textContent = labels.back;
  sequenceDockEls.back.hidden = isFullMode;
  sequenceDockEls.back.disabled = isFullMode;
  sequenceDockEls.back.tabIndex = isFullMode || !isSecondaryView ? -1 : 0;
  sequenceDockEls.playbackControl.hidden = false;
  sequenceDockEls.playbackControl.disabled = !showPlaybackControl;
  sequenceDockEls.playbackControl.tabIndex = showPlaybackControl ? 0 : -1;
  sequenceDockEls.playbackControl.textContent = playbackControlLabel;
  sequenceDockEls.playbackControl.classList.toggle('sequence-dock__playback-control--inactive', !showPlaybackControl);
  if (showPlaybackControl) {
    sequenceDockEls.playbackControl.setAttribute('aria-label', playbackControlAria);
  } else {
    sequenceDockEls.playbackControl.removeAttribute('aria-label');
  }
  sequenceDockEls.addPhase.textContent = labels.addPhase;
  sequenceDockEls.addPhase.disabled = phaseStartDisabled;
  sequenceDockEls.addPhase.setAttribute('aria-pressed', phaseStartPending ? 'true' : 'false');
  sequenceDockEls.addPhase.setAttribute('aria-label', phaseAction.ariaLabel);
  sequenceDockEls.addPhase.title = phaseAction.title || '';
  if (sequenceDockEls.phaseActionStatus) {
    sequenceDockEls.phaseActionStatus.hidden = false;
    sequenceDockEls.phaseActionStatus.textContent = phaseAction.note || ' ';
  }
  sequenceDockEls.deleteMove.textContent = labels.deleteMove;
  sequenceDockEls.deleteMove.disabled = deleteDisabled;
  sequenceDockEls.deleteMove.title = canonicalMove.count <= 1
    ? 'A play must contain at least one Move'
    : 'Delete the selected Move';
  sequenceDockEls.deleteMove.title = canonicalMove.count <= 1
    ? tr('dock.delete.disabled')
    : tr('dock.delete.ready');
  sequenceDockEls.undo.textContent = labels.undo;
  sequenceDockEls.undo.disabled = historyDisabled;
  sequenceDockEls.undo.title = historyDisabled ? 'Nothing to undo' : 'Undo the last change';
  sequenceDockEls.undo.title = historyDisabled ? tr('dock.undo.none') : tr('dock.undo.ready');
  sequenceDockEls.redo.textContent = labels.redo;
  sequenceDockEls.redo.disabled = futureDisabled;
  sequenceDockEls.redo.title = futureDisabled ? 'Nothing to redo' : 'Redo the last undone change';
  sequenceDockEls.redo.title = futureDisabled ? tr('dock.redo.none') : tr('dock.redo.ready');
}

function initSequenceControlDock() {
  const dock = document.getElementById('sequenceControlDock');
  if (!dock) return;
  sequenceDockEls = {
    dock,
    moveHeadline: document.getElementById('sequenceDockMoveHeadline'),
    phaseHeadline: document.getElementById('sequenceDockPhaseHeadline'),
    status: document.getElementById('sequenceDockStatus'),
    addMove: document.getElementById('sequenceDockAddMove'),
    more: document.getElementById('sequenceDockMore'),
    primaryPanel: document.getElementById('sequenceDockPrimaryPanel'),
    secondaryPanel: document.getElementById('sequenceDockSecondaryPanel'),
    duplicate: document.getElementById('sequenceDockDuplicate'),
    play: document.getElementById('sequenceDockPlay'),
    playPhase: document.getElementById('sequenceDockPlayPhase'),
    preview: document.getElementById('sequenceDockPreview'),
    playbackControl: document.getElementById('sequenceDockPlaybackControl'),
    addPhase: document.getElementById('sequenceDockAddPhase'),
    phaseActionStatus: document.getElementById('sequenceDockPhaseActionStatus'),
    deleteMove: document.getElementById('sequenceDockDelete'),
    undo: document.getElementById('sequenceDockUndo'),
    redo: document.getElementById('sequenceDockRedo'),
    back: document.getElementById('sequenceDockBack'),
  };

  sequenceDockEls.addMove.addEventListener('click', handleSequenceDockAddMove);
  sequenceDockEls.more.addEventListener('click', toggleSequenceDockView);
  sequenceDockEls.duplicate.addEventListener('click', duplicateStep);
  sequenceDockEls.play.addEventListener('click', toggleSmartPlay);
  sequenceDockEls.playPhase.addEventListener('click', handleSequenceDockPlayPhase);
  sequenceDockEls.preview.addEventListener('click', previewCurrentMove);
  sequenceDockEls.playbackControl.addEventListener('click', handleSequenceDockPlaybackControl);
  sequenceDockEls.addPhase.addEventListener('click', handleSequenceDockStartPhase);
  sequenceDockEls.deleteMove.addEventListener('click', confirmDeleteSelectedMoveFromDock);
  sequenceDockEls.undo.addEventListener('click', undo);
  sequenceDockEls.redo.addEventListener('click', redo);
  sequenceDockEls.back.addEventListener('click', () => setSequenceDockView('primary', { focusTarget: true }));
  updateSequenceDockUI();
  scheduleSequenceDockPosition();
}

function updateSequenceUI() {
  const prevBtn = document.getElementById('seqPrevBtn');
  const nextBtn = document.getElementById('seqNextBtn');
  const seqBarPrev = document.getElementById('seqBarPrev');
  const seqBarNext = document.getElementById('seqBarNext');
  const seqBarPlay = document.getElementById('seqBarPlay');
  const playIcon  = document.getElementById('seqBarPlayIcon');
  const playLabel = document.getElementById('seqBarPlayLabel');
  const playBtn = document.getElementById('playBtn');
  const tlPlayBtn = document.getElementById('tlPlayBtn');
  const playable = currentPhaseHasPlayablePlayback();
  const playFromHerePlayable = projectHasPlayablePlayback();
  const activeTransition = getActiveCanonicalTransitionRefs();
  // During an active/paused transition, Previous/Next always target the actual
  // transition source/target - not just whichever chip is currently highlighted.
  const hasPrev = activeTransition ? true : hasPreviousCanonicalMove();
  const hasNext = activeTransition ? true : hasNextCanonicalMove();
  const canonicalMove = getCanonicalMoveDisplay();
  updatePhaseUI();
  syncSequenceBarSummary(canonicalMove);
  if (prevBtn) prevBtn.disabled = !hasPrev;
  if (nextBtn) nextBtn.disabled = !hasNext;
  if (seqBarPrev) seqBarPrev.disabled = !hasPrev;
  if (seqBarNext) seqBarNext.disabled = !hasNext;
  if (seqBarPrev) seqBarPrev.setAttribute('aria-disabled', String(!hasPrev));
  if (seqBarNext) seqBarNext.setAttribute('aria-disabled', String(!hasNext));
  if (seqBarPrev) seqBarPrev.title = activeTransition
    ? 'Stop playback and return to the previous Move'
    : (canonicalMove.hasSelection ? 'Previous Move' : 'Previous Move unavailable');
  if (seqBarNext) seqBarNext.title = activeTransition
    ? 'Stop playback and jump to the next Move'
    : (canonicalMove.hasSelection ? 'Next Move' : 'Next Move unavailable');
  const isPaused = !S.animating && S.animT > 0;
  const anyPlaybackActive = S.animating || isPaused;
  if (seqBarPlay) seqBarPlay.disabled = anyPlaybackActive ? false : !playFromHerePlayable;
  if (seqBarPlay) seqBarPlay.title = S.animating
    ? 'Pause playback'
    : isPaused
      ? 'Resume playback'
      : playFromHerePlayable
        ? 'Play from the current move through to the end'
        : 'No later move available to play';
  if (playIcon)  playIcon.innerHTML = S.animating ? '&#9208;' : '&#9654;';
  if (playLabel) playLabel.textContent = S.animating ? 'PAUSE' : (isPaused ? 'RESUME' : 'PLAY');
  if (playBtn) playBtn.disabled = !playable;
  if (tlPlayBtn) tlPlayBtn.disabled = !playable;
  scheduleSequenceBarScroller({ center: true, behavior: 'smooth' });
  updateSequenceDockUI();
  scheduleSequenceDockPosition();
}

let seqBarScrollRefreshRaf = 0;
let seqBarScrollShouldCenter = false;
let seqBarScrollBehavior = 'smooth';
let seqBarScrollBindingsReady = false;

function getSequenceBarElements() {
  return {
    strip: document.getElementById('phaseChipStrip'),
    shell: document.getElementById('seqBarStripShell'),
    scrollPrev: document.getElementById('seqBarScrollPrev'),
    scrollNext: document.getElementById('seqBarScrollNext'),
    moveIndicator: document.getElementById('seqBarMoveIndicator'),
    phaseIndicator: document.getElementById('seqBarPhaseIndicator'),
  };
}

function centerSequenceBarOnCurrentChip({ behavior = 'smooth' } = {}) {
  const { strip } = getSequenceBarElements();
  if (!strip) return;
  const activeChip = strip.querySelector('.tb-phase-chip.active');
  if (!activeChip) return;
  const maxScroll = Math.max(0, strip.scrollWidth - strip.clientWidth);
  if (maxScroll <= 0) return;
  const targetLeft = Math.max(
    0,
    Math.min(
      activeChip.offsetLeft - ((strip.clientWidth - activeChip.offsetWidth) / 2),
      maxScroll
    )
  );
  strip.scrollTo({ left: targetLeft, behavior });
}

function refreshSequenceBarScroller() {
  seqBarScrollRefreshRaf = 0;
  const { strip, shell, scrollPrev, scrollNext } = getSequenceBarElements();
  if (!strip || !shell) return;
  if (seqBarScrollShouldCenter) centerSequenceBarOnCurrentChip({ behavior: seqBarScrollBehavior });
  seqBarScrollShouldCenter = false;
  seqBarScrollBehavior = 'smooth';

  const maxScroll = Math.max(0, strip.scrollWidth - strip.clientWidth);
  const canScrollLeft = strip.scrollLeft > 2;
  const canScrollRight = strip.scrollLeft < maxScroll - 2;
  shell.dataset.canScrollLeft = canScrollLeft ? 'true' : 'false';
  shell.dataset.canScrollRight = canScrollRight ? 'true' : 'false';
  if (scrollPrev) {
    scrollPrev.disabled = !canScrollLeft;
    scrollPrev.setAttribute('aria-disabled', canScrollLeft ? 'false' : 'true');
  }
  if (scrollNext) {
    scrollNext.disabled = !canScrollRight;
    scrollNext.setAttribute('aria-disabled', canScrollRight ? 'false' : 'true');
  }
}

function scheduleSequenceBarScroller({ center = false, behavior = 'smooth' } = {}) {
  if (center) {
    seqBarScrollShouldCenter = true;
    seqBarScrollBehavior = behavior;
  }
  if (seqBarScrollRefreshRaf) return;
  seqBarScrollRefreshRaf = requestAnimationFrame(refreshSequenceBarScroller);
}

function scrollSequenceBarBy(direction) {
  const { strip } = getSequenceBarElements();
  if (!strip) return;
  const distance = Math.max(strip.clientWidth * 0.62, 180) * direction;
  strip.scrollBy({ left: distance, behavior: 'smooth' });
  scheduleSequenceBarScroller();
}

function syncSequenceBarSummary(canonicalMove = getCanonicalMoveDisplay()) {
  const { moveIndicator, phaseIndicator } = getSequenceBarElements();
  if (moveIndicator) {
    moveIndicator.textContent = canonicalMove.hasSelection
      ? tr('dock.moveOf', { current: canonicalMove.current, total: canonicalMove.count })
      : tr('dock.moveEmpty');
  }
  if (phaseIndicator) {
    const phaseTotal = Array.isArray(GamePlan.phases) ? GamePlan.phases.length : 0;
    const currentPhase = phaseTotal ? GamePlan.currentPhase + 1 : 0;
    phaseIndicator.textContent = `${tr('phase.short', {}, 'PHASE')} ${currentPhase} / ${Math.max(phaseTotal, 1)}`;
  }
}

function initSequenceBarNavigator() {
  if (seqBarScrollBindingsReady) return;
  const { strip, scrollPrev, scrollNext } = getSequenceBarElements();
  if (!strip) return;
  seqBarScrollBindingsReady = true;
  strip.addEventListener('scroll', () => scheduleSequenceBarScroller());
  scrollPrev?.addEventListener('click', () => scrollSequenceBarBy(-1));
  scrollNext?.addEventListener('click', () => scrollSequenceBarBy(1));
  window.addEventListener('resize', () => scheduleSequenceBarScroller({ center: true, behavior: 'auto' }));
}

//  ANIMATION
function isCanonicalPlaybackPaused() {
  return !S.animating && S.animT > 0;
}

// Resumes whichever session (preview / phase / from-here) is currently paused,
// using the state it was started with. Never re-derives or redefines the mode.
function resumeCanonicalPlayback() {
  if (!currentPhaseHasPlayablePlayback()) {
    stopPlayback(true);
    setHint('This is the final move. There is no next move to continue.');
    refreshInteractionUI();
    return;
  }
  S.animating = true;
  S.lastTs = null;
  setPlayBtnState();
  updateTL();
  render();
  canonicalPlaybackRafHandle = requestAnimationFrame(animLoop);
}

// While animating or paused, the canonical transition in flight always has a
// resolvable source (the still-selected Move) and target (the next Move the
// engine is animating toward) - independent of which chip happens to be
// highlighted. Returns null when idle.
function getActiveCanonicalTransitionRefs() {
  if (!S.animating && !isCanonicalPlaybackPaused()) return null;
  const fromIdx = getCurrentCanonicalMoveIndex();
  const toIdx = canonicalPlaybackTargetIndex(fromIdx);
  if (fromIdx < 0 || toIdx === null) return null;
  return { fromIdx, toIdx };
}

// Fully cancels any active/paused playback session and lands cleanly on the
// given canonical Move index, selected and editable. Shared by transport
// (Previous/Next), Move chips and Phase labels - never a second engine.
function cancelPlaybackAndSelect(index) {
  stopPlayback(true);
  activateCanonicalMoveForPlayback(index, { resetProgress: true });
  updateTL();
  render();
}

function handleCanonicalPrevious() {
  const transition = getActiveCanonicalTransitionRefs();
  if (transition) {
    cancelPlaybackAndSelect(transition.fromIdx);
  } else {
    goToPreviousCanonicalMove();
  }
  mobileAutoReturnFromFitFullPitch();
}
window.handleCanonicalPrevious = handleCanonicalPrevious;

function handleCanonicalNext() {
  const transition = getActiveCanonicalTransitionRefs();
  if (transition) {
    cancelPlaybackAndSelect(transition.toIdx);
  } else {
    goToNextCanonicalMove();
  }
  mobileAutoReturnFromFitFullPitch();
}
window.handleCanonicalNext = handleCanonicalNext;

function handleCanonicalMoveChipSelect(index) {
  const transition = getActiveCanonicalTransitionRefs();
  if (transition) {
    cancelPlaybackAndSelect(index);
  } else {
    goToCanonicalMove(index);
  }
  mobileAutoReturnFromFitFullPitch();
}

function toggleSmartPlay() {
  // PRIMARY PLAY (desktop): run the sequence from the CURRENT phase through every
  // later phase to the end. Repeat clicks pause, then resume from where it stopped.
  // Single-move preview stays available via previewCurrentMove()/togglePlay().
  if (S.animating) {
    stopPlayback(false);
    refreshInteractionUI();
    updateTL();
    render();
    return;
  }
  togglePlayAll();
}

// Secondary: preview only the current phase transition (the old single-step play).
function previewCurrentMove() {
  if (S.animating) { stopPlayback(false); refreshInteractionUI(); render(); return; }
  togglePlay();
}
window.previewCurrentMove = previewCurrentMove;
window.toggleSmartPlay = toggleSmartPlay;

function togglePlay() {
  if (S.animating) {
    S.animating = false;
    S.lastTs = null;
    setPlayBtnState();
    refreshInteractionUI();
    updateTL();
    render();
    return;
  }
  if (isCanonicalPlaybackPaused()) {
    resumeCanonicalPlayback();
    return;
  }
  S.playAll = false;
  canonicalPlaybackBoundaryIndex = null;
  canonicalPlaybackMode = 'preview';
  persistCurrentPhase();
  if (!currentPhaseHasPlayablePlayback()) {
    stopPlayback(false);
    setHint('This is the final move. There is no next move to preview.');
    refreshInteractionUI();
    return;
  }
  S.animT = 0;
  S.animating = true;
  S.lastTs = null;
  setPlayBtnState();
  canonicalPlaybackRafHandle = requestAnimationFrame(animLoop);
}

function togglePlayAll() {
  if (!claimPhoneDataAction('more:play-all')) return;
    if (S.animating) {
      S.animating = false;
      S.lastTs = null;
    setPlayBtnState();
    refreshInteractionUI();
    updateTL();
    render();
    return;
  }
  if (isCanonicalPlaybackPaused()) {
    resumeCanonicalPlayback();
    return;
  }

  persistCurrentPhase();
  if (!currentPhaseHasPlayablePlayback()) {
    stopPlayback(false);
    setHint('This is the final move. There are no later moves to play.');
    refreshInteractionUI();
    return;
  }

  canonicalPlaybackBoundaryIndex = null;
  canonicalPlaybackMode = 'from-here';
  S.playAll = true;
  S.animT = 0;
  S.animating = true;
  S.lastTs = null;
  setPlayBtnState();
  updateTL();
  render();
  canonicalPlaybackRafHandle = requestAnimationFrame(animLoop);
}
window.togglePlayAll = togglePlayAll;
window.deleteStep = deleteStep;
window.deleteCanonicalMove = deleteCanonicalMove;

function playCurrentCanonicalPhase() {
  const range = getCanonicalPhasePlaybackRange();
  if (!range || range.moveCount <= 1) return;
  persistCurrentPhase();
  goToCanonicalMove(range.firstIndex);
  canonicalPlaybackBoundaryIndex = range.lastIndex;
  canonicalPlaybackMode = 'phase';
  S.playAll = true;
  S.animT = 0;
  S.animating = true;
  S.lastTs = null;
  setPlayBtnState();
  updateTL();
  render();
  canonicalPlaybackRafHandle = requestAnimationFrame(animLoop);
}
window.playCurrentCanonicalPhase = playCurrentCanonicalPhase;

function animLoop(ts) {
  if (!S.animating) return;
  const DUR = playbackDurationSeconds();
  if (S.lastTs !== null) {
    S.animT = Math.min(1, S.animT + (ts - S.lastTs) / 1000 * S.animSpd / DUR);
    if (S.animT >= 1) {
      const targetIdx = canonicalPlaybackTargetIndex(getCurrentCanonicalMoveIndex());
      if (targetIdx !== null && activateCanonicalMoveForPlayback(targetIdx, { resetProgress: true })) {
        const nextIdx = canonicalPlaybackTargetIndex(getCurrentCanonicalMoveIndex());
        const withinBoundary = canonicalPlaybackBoundaryIndex === null
          || (nextIdx !== null && nextIdx <= canonicalPlaybackBoundaryIndex);
        if (S.playAll && nextIdx !== null && withinBoundary) {
          S.lastTs = ts;
          updateTL();
          render();
          canonicalPlaybackRafHandle = requestAnimationFrame(animLoop);
          return;
        }
      }
      S.animating = false;
      S.playAll = false;
      S.animT = 0;
      S.lastTs = null;
      canonicalPlaybackBoundaryIndex = null;
      canonicalPlaybackMode = 'idle';
      canonicalPlaybackRafHandle = null;
      setPlayBtnState();
      refreshInteractionUI();
      render();
      updateTL();
      return;
    }
  }
  S.lastTs = ts;
  render(); updateTL();
  if (S.animating) canonicalPlaybackRafHandle = requestAnimationFrame(animLoop);
}
function setPlayBtnState() {
  syncPlayButtons();
  updateSequenceUI();
  updateMobileUI();
}
function resetAnim() {
  stopPlayback(true);
  ensureSteps();
  S.currentStep = 0;
  setLiveBoardFromStep(S.steps[0]);
  refreshInteractionUI();
  render(); updateTL();
}
function chSpd(d) {
  spdIdx = clamp(spdIdx+d, 0, SPEEDS.length-1);
  S.animSpd = SPEEDS[spdIdx];
  S.projectPlayback = normalizePlaybackSettings({
    ...(S.projectPlayback || {}),
    currentSpeed: S.animSpd,
  });
  syncSpeedButtonsUI();
}
function updateTL() {
  const pct = S.animT * 100;
  document.getElementById('trackFill').style.width = pct + '%';
  document.getElementById('trackThumb').style.left = pct + '%';
  const duration = playbackDurationSeconds();
  document.getElementById('tlTime').textContent = `${(S.animT * duration).toFixed(1)} / ${duration.toFixed(1)}s`;
  updateMobileUI();
}
function seekTrack(e) {
  const r = document.getElementById('track').getBoundingClientRect();
  const raw = clamp((e.clientX-r.left)/r.width, 0, 1);
  if (!S.animating && sequenceStepCount() > 1) {
    gotoStep(Math.round(raw * (sequenceStepCount() - 1)));
    return;
  }
  S.animT = raw;
  updateTL(); render();
}

//  UI
const HINTS = {
  move:  'MOVE – drag players, ball, paths or notes to reposition. Click a path to select it.',
  run:   'RUN – click a player, then drag to draw their movement path.',
  pass:  'PASS – click the passer (ball transfers automatically), then click the receiver.',
  kick:  'KICK – click the kicker (ball transfers automatically), then click a player or field target.',
  erase: 'ERASE – click any player, ball, path or annotation to remove it.',
  box:   'BOX – drag on the pitch to highlight a channel or area.',
};

const MODE_LABELS = {
  move:  'Move',
  run:   'Run',
  pass:  'Pass',
  kick:  'Kick',
  erase: 'Erase',
  box:   'Box Highlight',
};

HINTS.note  = 'NOTE – click the pitch to place a coaching cue card.';
HINTS.arrow = 'ARROW – drag to draw a coaching annotation arrow. Does not animate players.';
HINTS.zone  = 'CIRCLE – drag to place a circle or oval highlight. Hold Shift for a perfect circle.';
MODE_LABELS.note  = 'Note';
MODE_LABELS.arrow = 'Arrow';
MODE_LABELS.zone  = 'Circle Highlight';

HINTS.ellipse = HINTS.zone;
MODE_LABELS.ellipse = 'Circle Highlight';
HINTS.tele = 'TELESTRATOR - draw live ink that fades in 3 seconds.';
MODE_LABELS.tele = 'Telestrator';

const MOBILE_DRAWER_IDS = ['selection', 'annotations', 'notes', 'files'];

function isMobileViewport() {
  return isPhoneViewport;
}

function setMobileToolsDropdownOpen(open) {
  const dropdown = document.getElementById('mobileToolsDropdown');
  const btn = document.getElementById('mobileToolsBtn');
  if (!dropdown) return;
  const isOpen = !!open && isMobileViewport();
  dropdown.classList.toggle('is-open', isOpen);
  dropdown.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  if (btn) {
    btn.classList.toggle('active', isOpen);
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }
}

function toggleMobileToolsDropdown() {
  const dropdown = document.getElementById('mobileToolsDropdown');
  if (!dropdown) return;
  setMobileToolsDropdownOpen(!dropdown.classList.contains('is-open'));
}

function closeMobileToolsDropdown() {
  setMobileToolsDropdownOpen(false);
}

window.toggleMobileToolsDropdown = toggleMobileToolsDropdown;
window.closeMobileToolsDropdown = closeMobileToolsDropdown;

function setMobileSpd(val) {
  const idx = SPEEDS.indexOf(val);
  if (idx < 0) return;
  spdIdx = idx;
  S.animSpd = SPEEDS[spdIdx];
  S.projectPlayback = normalizePlaybackSettings({ ...(S.projectPlayback || {}), currentSpeed: S.animSpd });
  syncSpeedButtonsUI();
}
window.setMobileSpd = setMobileSpd;

function isCompactViewport() {
  return isPhoneViewport;
}

function syncResponsiveToolbarLabels() {
  const compact = isCompactViewport();
  document.querySelectorAll('[data-label-desktop], [data-i18n-label-desktop]').forEach((btn) => {
    const desktopKey = btn.getAttribute('data-i18n-label-desktop') || '';
    const mobileKey = btn.getAttribute('data-i18n-label-mobile') || desktopKey;
    const desktopLabel = desktopKey ? tr(desktopKey, {}, btn.getAttribute('data-label-desktop') || '') : (btn.getAttribute('data-label-desktop') || '');
    const mobileLabel = mobileKey ? tr(mobileKey, {}, btn.getAttribute('data-label-mobile') || desktopLabel) : (btn.getAttribute('data-label-mobile') || desktopLabel);
    btn.innerHTML = compact ? mobileLabel : desktopLabel;
  });
}

function syncPlayButtons() {
  const compact = isCompactViewport();
  const singlePlayable = currentPhaseHasPlayablePlayback();
  const playAllPlayable = projectHasPlayablePlayback();
  const playBtn = document.getElementById('playBtn');
  const playAllBtn = document.getElementById('playAllBtn');
  const mobPlayBtn = document.getElementById('mobPlayBtn');
  const mobileTopPlayBtn = document.getElementById('mobileTopPlayBtn');
  const tlPlayBtn = document.getElementById('tlPlayBtn');
  const singlePlayActive = S.animating && !S.playAll;
  const playAllLocked = S.playAll;
  const singlePlayLabel = singlePlayActive ? (compact ? '||' : tr('play.pause', {}, 'PAUSE')) : (compact ? '\u25b6' : tr('play.play', {}, 'PLAY'));
  const playAllLabel = S.animating && S.playAll ? (compact ? '||' : `\u23f8 ${tr('play.pauseAll', {}, 'PAUSE ALL')}`) : (compact ? '\u25b6\u25b6' : `\u25b6\u25b6 ${tr('play.playAll', {}, 'PLAY ALL')}`);
  if (playBtn) {
    playBtn.textContent = singlePlayLabel;
    playBtn.disabled = !singlePlayable || playAllLocked;
  }
  if (playAllBtn) {
    playAllBtn.textContent = playAllLabel;
    playAllBtn.disabled = !playAllPlayable;
  }
  if (tlPlayBtn) {
    tlPlayBtn.textContent = singlePlayActive ? tr('play.pauseTitle', {}, 'Pause') : tr('play.playTitle', {}, 'Play');
    tlPlayBtn.disabled = !singlePlayable || playAllLocked;
  }
  if (mobPlayBtn) {
    mobPlayBtn.textContent = S.animating ? `\u23f8 ${tr('play.pause', {}, 'PAUSE')}` : `\u25b6 ${tr('play.play', {}, 'PLAY')}`;
    mobPlayBtn.disabled = !singlePlayable;
  }
  if (mobileTopPlayBtn) {
    // Universal Pause/Resume control on phone (mirrors the desktop dock's
    // sequenceDockPlay): idle -> Play from Here; while any session (Preview,
    // Play Phase or Play from Here, however it was started) is active or
    // paused, this becomes the single Pause/Resume control for it.
    const mobileSessionActive = S.animating || isCanonicalPlaybackPaused();
    mobileTopPlayBtn.textContent = S.animating ? tr('play.pauseTitle', {}, 'Pause') : (isCanonicalPlaybackPaused() ? tr('play.resume', {}, 'Resume') : tr('play.playTitle', {}, 'Play'));
    mobileTopPlayBtn.disabled = mobileSessionActive ? false : !playAllPlayable;
  }
}

function setMobileDrawerState(id, open) {
  const section = document.getElementById(`drawer-${id}`);
  if (!section) return;
  section.classList.toggle('is-open', !!open);
  const toggle = section.querySelector('.mobile-drawer-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function toggleMobileDrawer(id) {
  const section = document.getElementById(`drawer-${id}`);
  if (!section) return;
  const willOpen = !section.classList.contains('is-open');
  setMobileDrawerState(id, willOpen);
}

window.toggleMobileDrawer = toggleMobileDrawer;

function updateMobileUI() {
  const mobilePhaseCounter = document.getElementById('mobilePhaseCounter');
  const mobileAddAttackBtn = document.getElementById('mobileAddAttackBtn');
  const mobileAddDefenceBtn = document.getElementById('mobileAddDefenceBtn');
  const mobileMoreAddAttackBtn = document.getElementById('mobileMoreAddAttackBtn');
  const mobileMoreAddDefenceBtn = document.getElementById('mobileMoreAddDefenceBtn');
  const mobileMorePrevPhaseBtn = document.getElementById('mobileMorePrevPhaseBtn');
  const mobileMoreNextPhaseBtn = document.getElementById('mobileMoreNextPhaseBtn');
  const mobileMorePrevStepBtn = document.getElementById('mobileMorePrevStepBtn');
  const mobileMoreNextStepBtn = document.getElementById('mobileMoreNextStepBtn');
  const mobileMorePlayAllBtn = document.getElementById('mobileMorePlayAllBtn');
  const count = sequenceStepCount();
  const playable = currentPhaseHasPlayablePlayback();

  syncResponsiveToolbarLabels();
  syncPlayButtons();
  if (mobilePhaseCounter) mobilePhaseCounter.textContent = `${tr('phase.short', {}, 'PHASE')} ${GamePlan.currentPhase + 1} / ${GamePlan.phases.length}`;
  [0.25, 0.5, 1, 2].forEach(v => {
    const chip = document.getElementById('mspd-' + v);
    if (chip) chip.classList.toggle('active', v === S.animSpd);
  });
  if (mobileMorePrevPhaseBtn) mobileMorePrevPhaseBtn.disabled = GamePlan.currentPhase === 0;
  if (mobileMoreNextPhaseBtn) mobileMoreNextPhaseBtn.disabled = GamePlan.currentPhase >= GamePlan.phases.length - 1;
  if (mobileMorePrevStepBtn) mobileMorePrevStepBtn.disabled = S.currentStep === 0;
  if (mobileMoreNextStepBtn) mobileMoreNextStepBtn.disabled = S.currentStep >= count - 1;
  if (mobileAddAttackBtn) mobileAddAttackBtn.disabled = S.atkUsed.size >= 15;
  if (mobileAddDefenceBtn) mobileAddDefenceBtn.disabled = S.defUsed.size >= 15;
  if (mobileMoreAddAttackBtn) mobileMoreAddAttackBtn.disabled = S.atkUsed.size >= 15;
  if (mobileMoreAddDefenceBtn) mobileMoreAddDefenceBtn.disabled = S.defUsed.size >= 15;
  if (mobileMorePlayAllBtn) {
    mobileMorePlayAllBtn.textContent = S.animating && S.playAll ? '⏸ PAUSE ALL' : '▶▶ PLAY ALL';
    mobileMorePlayAllBtn.disabled = !playable;
  }
  MOBILE_DRAWER_IDS.forEach(id => {
    const section = document.getElementById(`drawer-${id}`);
    if (!section) return;
    if (!isPhoneViewport) {
      section.classList.remove('is-open');
    }
  });
  if (!isPhoneViewport) {
    closeMobileToolsDropdown();
    closeMobileBoardMenu();
    closeMobileNotesSheet();
    setMobileMoreDrawerOpen(false);
  }
  return;

  syncResponsiveToolbarLabels();
  syncPlayButtons();
  if (mobileBoardName) mobileBoardName.textContent = currentPlayTitle();
  if (mobilePlayBtn) {
    mobilePlayBtn.textContent = S.animating ? 'Pause' : 'Play';
    mobilePlayBtn.disabled = !playable;
  }
  if (mobileSequencePlayBtn) {
    mobileSequencePlayBtn.textContent = S.animating ? '⏸ Pause' : '▶ Play';
    mobileSequencePlayBtn.disabled = !playable;
  }
  [0.25, 0.5, 1, 2].forEach(v => {
    const chip = document.getElementById('mspd-' + v);
    if (chip) chip.classList.toggle('active', v === S.animSpd);
  });
  if (mobileBoardSummary) {
    mobileBoardSummary.textContent = `Mode: ${MODE_LABELS[S.tool] || 'Board'} · Step ${S.currentStep + 1} of ${count} · ${ownerText}`;
  }
  if (mobilePrevStepBtn) mobilePrevStepBtn.disabled = S.currentStep === 0;
  if (mobileNextStepBtn) mobileNextStepBtn.disabled = S.currentStep >= count - 1;
  if (mobileAddAttackBtn) mobileAddAttackBtn.disabled = S.atkUsed.size >= 15;
  if (mobileAddDefenceBtn) mobileAddDefenceBtn.disabled = S.defUsed.size >= 15;

  ['move', 'run', 'pass', 'kick', 'tele', 'zone', 'box', 'ellipse', 'erase', 'note', 'arrow'].forEach(tool => {
    const btn = document.getElementById(`mq-${tool}`);
    if (btn) btn.classList.toggle('active', S.tool === tool);
  });

  MOBILE_DRAWER_IDS.forEach(id => {
    const section = document.getElementById(`drawer-${id}`);
    if (!section) return;
    if (!isMobileViewport()) {
      section.classList.remove('is-open');
    }
  });
  if (!isMobileViewport()) closeMobileToolsDropdown();
}

function updateMobileUI() {
  const mobilePhaseCounter = document.getElementById('mobilePhaseCounter');
  const mobileAddAttackBtn = document.getElementById('mobileAddAttackBtn');
  const mobileAddDefenceBtn = document.getElementById('mobileAddDefenceBtn');
  const mobileMoreAddAttackBtn = document.getElementById('mobileMoreAddAttackBtn');
  const mobileMoreAddDefenceBtn = document.getElementById('mobileMoreAddDefenceBtn');
  const mobileMorePrevPhaseBtn = document.getElementById('mobileMorePrevPhaseBtn');
  const mobileMoreNextPhaseBtn = document.getElementById('mobileMoreNextPhaseBtn');
  const mobileMorePrevStepBtn = document.getElementById('mobileMorePrevStepBtn');
  const mobileMoreNextStepBtn = document.getElementById('mobileMoreNextStepBtn');
  const mobileMorePlayAllBtn = document.getElementById('mobileMorePlayAllBtn');
  const count = sequenceStepCount();
  const playable = currentPhaseHasPlayablePlayback();

  syncResponsiveToolbarLabels();
  syncPlayButtons();
  if (mobilePhaseCounter) mobilePhaseCounter.textContent = `${tr('phase.short', {}, 'PHASE')} ${GamePlan.currentPhase + 1} / ${GamePlan.phases.length}`;
  [0.25, 0.5, 1, 2].forEach(v => {
    const chip = document.getElementById('mspd-' + v);
    if (chip) chip.classList.toggle('active', v === S.animSpd);
  });
  if (mobileMorePrevPhaseBtn) mobileMorePrevPhaseBtn.disabled = GamePlan.currentPhase === 0;
  if (mobileMoreNextPhaseBtn) mobileMoreNextPhaseBtn.disabled = GamePlan.currentPhase >= GamePlan.phases.length - 1;
  if (mobileMorePrevStepBtn) mobileMorePrevStepBtn.disabled = S.currentStep === 0;
  if (mobileMoreNextStepBtn) mobileMoreNextStepBtn.disabled = S.currentStep >= count - 1;
  if (mobileAddAttackBtn) mobileAddAttackBtn.disabled = S.atkUsed.size >= 15;
  if (mobileAddDefenceBtn) mobileAddDefenceBtn.disabled = S.defUsed.size >= 15;
  if (mobileMoreAddAttackBtn) mobileMoreAddAttackBtn.disabled = S.atkUsed.size >= 15;
  if (mobileMoreAddDefenceBtn) mobileMoreAddDefenceBtn.disabled = S.defUsed.size >= 15;
  if (mobileMorePlayAllBtn) {
    mobileMorePlayAllBtn.textContent = S.animating && S.playAll ? 'â¸ PAUSE ALL' : 'â–¶â–¶ PLAY ALL';
    mobileMorePlayAllBtn.disabled = !playable;
  }
  MOBILE_DRAWER_IDS.forEach(id => {
    const section = document.getElementById(`drawer-${id}`);
    if (!section) return;
    if (!isPhoneViewport) section.classList.remove('is-open');
  });
  if (!isPhoneViewport) {
    closeMobileToolsDropdown();
    closeMobileBoardMenu();
    closeMobileNotesSheet();
    setMobileMoreDrawerOpen(false);
  }
}

function getSelectedSummary() {
  const players = selectedPlayers();
  const group = selectedGroup();
  if (group) {
    const members = groupMembers(group);
    return {
      title: group.label,
      meta: group.active
        ? `Pack selected with ${members.length} players. Click the pack, then click again anywhere on the field to place the full unit.`
        : 'Pack available for regrouping. Players are currently in individual edit mode.',
    };
  }
  if (isBallSelected()) {
    const owner = findPlayerByRef(S.ballOwner);
    const candidate = manualBallAssignmentTarget();
    const ownerLabel = owner
      ? ` Currently linked to ${owner.team==='A'?'Attack':'Defence'} #${owner.num}${S.ballAttached ? ' as the live carrier.' : '.'}`
      : '';
    const candidateLabel = candidate ? ` Use "Give Ball to Selected Player" to attach it to ${candidate.team==='A'?'Attack':'Defence'} #${candidate.num}.` : '';
    return { title: 'Ball Selected', meta: `Drag the ball to a new spot or remove it from the board.${ownerLabel}${candidateLabel}` };
  }
  const ann = selectedAnnotation();
  if (ann) {
    if (ann.type === 'note') {
      return { title: 'Tactical Note', meta: 'Move it on the board, drag a corner handle to resize it, or update the note text below.' };
    }
    if (ann.type === 'arrow') {
      return { title: 'Free Arrow', meta: 'Drag the line or either endpoint in Move to refine the arrow.' };
    }
    if (ann.type === 'zone') {
      return { title: 'Circle Highlight', meta: 'Drag the circle to move it or drag the outer handle to resize it.' };
    }
    if (ann.type === 'box') {
      return { title: 'Box Highlight', meta: 'Drag inside the box to move it, use the round handle above it to rotate, or drag any corner handle to resize it.' };
    }
    if (ann.type === 'ellipse') {
      return { title: 'Circle Highlight', meta: 'Drag inside the shape to move it, use the round handle above it to rotate, or drag any corner handle to resize it. Hold Shift while resizing for a perfect circle.' };
    }
  }
  if (players.length > 1) {
    return {
      title: `${players.length} Players Selected`,
      meta: 'Ctrl/Cmd-click lets you build a temporary player set. Any color change now applies to all selected players.',
    };
  }
  if (S.selectedPlayerId !== null) {
    const pl = S.players.find(p => p.id === S.selectedPlayerId);
    if (pl) {
      return {
        title: `${pl.team==='A'?'Attack':'Defence'} #${pl.num}`,
        meta: S.tool === 'move'
          ? (pl.isBC
              ? 'Selected and carrying the ball. Drag on the field to reposition while the ball stays attached.'
              : 'Selected and ready to move. Drag on the field to reposition.')
          : `Selected for ${MODE_LABELS[S.tool] || 'interaction'}.`,
      };
    }
  }
  if (S.selectedPathPid !== null) {
    const path = S.paths.find(p => p.pid === S.selectedPathPid);
    const pl = path ? S.players.find(q => q.id === path.pid) : null;
    const label = pl ? `${pl.team === 'A' ? 'Attack' : 'Defence'} #${pl.num}` : 'player';
    return { title: 'Run Path', meta: `Run path for ${label}. Press Delete to remove it.` };
  }
  if (S.selectedPassIdx !== null) {
    const pass = S.passes[S.selectedPassIdx];
    const fromPl = pass ? S.players.find(p => p.id === pass.from) : null;
    const fromLabel = fromPl ? `from ${fromPl.team === 'A' ? 'Attack' : 'Defence'} #${fromPl.num}` : '';
    if (pass?.style === 'pass') {
      const toPl = pass.to ? S.players.find(p => p.id === pass.to) : null;
      const toLabel = toPl ? ` to ${toPl.team === 'A' ? 'Attack' : 'Defence'} #${toPl.num}` : '';
      return { title: 'Pass Line', meta: `Pass line${fromLabel ? ' ' + fromLabel : ''}${toLabel}. Press Delete to remove it.` };
    }
    return { title: 'Kick Path', meta: `Kick path${fromLabel ? ' ' + fromLabel : ''}. Press Delete to remove it.` };
  }
  return { title: '-', meta: 'Select a player or ball to inspect it here.' };
}

function getStatusMessage() {
  const players = selectedPlayers();
  if (!S.players.length && !S.ball && !S.annotations.length) return 'Add players from the left, place the ball, then choose how to build the picture.';
  if (S.dragging?.type === 'gainline') return 'Dragging the gainline. Release to lock the contest line.';
  if (S.dragging?.type === 'player') {
    const pl = S.players.find(p => p.id === S.dragPlayerId);
    return pl ? `Dragging ${pl.team==='A'?'Attack':'Defence'} #${pl.num}. Release to place.` : 'Dragging player.';
  }
  if (S.pendingGroupPlacement) {
    const group = selectedGroup() || S.groups.find(item => item.id === S.pendingGroupPlacement.id);
    return group ? `${group.label} armed for placement. Click again to drop the pack.` : 'Pack armed for placement.';
  }
  if (S.dragging?.type === 'ball') return 'Dragging the ball. Release to place it.';
  if (S.dragging?.type === 'annotation') {
    const ann = findAnnotationById(S.dragging.id);
    return ann ? `Adjusting ${MODE_LABELS[ann.type] || 'annotation'}. Release to place.` : 'Adjusting annotation.';
  }
  if (S.drawing) {
    const pl = S.players.find(p => p.id === S.drawing.pid);
    return pl ? `Drawing run for ${pl.team==='A'?'Attack':'Defence'} #${pl.num}. Release to finish.` : 'Drawing run path.';
  }
  if (activeWorkflowPlayerId()) {
    const pl = S.players.find(p => p.id === activeWorkflowPlayerId());
    return pl ? `${MODE_LABELS[S.tool]} armed from ${pl.team==='A'?'Attack':'Defence'} #${pl.num}. Choose the target.` : 'Choose the target.';
  }
  if (S.annotationDraft) return `Drawing ${MODE_LABELS[S.annotationDraft.type] || 'annotation'}. Release to place it.`;
  const group = selectedGroup();
  if (group) {
    return group.active
      ? `${group.label} selected. Click the pack, then click again to place it.`
      : `${group.label} unlocked. Players can be edited individually.`;
  }
  if (players.length > 1) {
    return `${players.length} players selected. Pick a color to update the whole selection, or click one player normally to return to single selection.`;
  }
  if (isBallSelected()) return 'Ball selected. Move it, or switch tools to build around it.';
  const ann = selectedAnnotation();
  if (ann) return `${MODE_LABELS[ann.type] || 'Annotation'} selected. Use Move to adjust it or Delete to remove it.`;
  if (S.selectedPlayerId !== null) {
    const pl = S.players.find(p => p.id === S.selectedPlayerId);
    if (pl) {
      return pl.isBC
        ? `${pl.team==='A'?'Attack':'Defence'} #${pl.num} selected with the ball attached.`
        : `${pl.team==='A'?'Attack':'Defence'} #${pl.num} selected.`;
    }
    return 'Selection active.';
  }
  return HINTS[S.tool] || 'Select a tool to begin.';
}

function updatePaletteSummary() {
  const atkCount = S.atkUsed.size;
  const defCount = S.defUsed.size;
  const activeCount = palTab === 'atk' ? atkCount : defCount;
  const activeLabel = palTab === 'atk' ? 'Attack' : 'Defence';

  const atkTabCount = document.getElementById('tab-atk-count');
  const defTabCount = document.getElementById('tab-def-count');
  const onBoard = document.getElementById('palOnBoard');
  const available = document.getElementById('palAvailable');
  const ballStatus = document.getElementById('palBallStatus');
  const palCopy = document.getElementById('palCopy');
  const attackPlayerCount = document.getElementById('attackPlayerCount');
  const defencePlayerCount = document.getElementById('defencePlayerCount');

  if (atkTabCount) atkTabCount.textContent = `${atkCount} / 15`;
  if (defTabCount) defTabCount.textContent = `${defCount} / 15`;
  if (attackPlayerCount) attackPlayerCount.textContent = `${atkCount} / 15`;
  if (defencePlayerCount) defencePlayerCount.textContent = `${defCount} / 15`;
  if (onBoard) onBoard.textContent = `${activeCount} / 15`;
  if (available) available.textContent = String(15 - activeCount);
  if (ballStatus) {
    if (!S.ball) ballStatus.textContent = 'Not Placed';
    else if (S.ballOwner) {
      ballStatus.textContent = `${S.ballOwner.team === 'A' ? 'A' : 'D'} #${S.ballOwner.num}`;
    } else {
      ballStatus.textContent = 'Loose';
    }
  }
  if (palCopy) palCopy.textContent = `${activeLabel} numbers ready to place. Used numbers stay dimmed until removed.`;
  const addAtkBtn = document.getElementById('mobileAddAttackBtn');
  const addDefBtn = document.getElementById('mobileAddDefenceBtn');
  const ballBtn = document.getElementById('mobileBallBtn');
  if (addAtkBtn) addAtkBtn.disabled = atkCount >= 15;
  if (addDefBtn) addDefBtn.disabled = defCount >= 15;
  if (ballBtn) ballBtn.classList.toggle('active', !!S.ball);
}

function updateBoardStatus() {
  const mode = document.getElementById('boardModeLabel');
  const text = document.getElementById('boardStatusText');
  const empty = document.getElementById('emptyState');
  const toolbarMode = document.getElementById('toolbarModeInline');
  const gainlineBtn = document.getElementById('gainlineToggleBtn');
  const mobGainlineBtn = document.getElementById('mobGainlineBtn');
  const ghostPrevBtn = document.getElementById('ghostPreviousToggleBtn');
  const mobGhostPrevBtn = document.getElementById('mobGhostPrevBtn');
  const mobBallBtn = document.querySelector('#mobileMoreDrawer .mob-more-btn[onclick*="addBall"]');
  const count = sequenceStepCount();
  const owner = normalizePlayerRef(S.ballOwner);
  const ownerText = owner ? `Ball: ${owner.team === 'A' ? 'A' : 'D'} #${owner.num}` : (S.ball ? 'Ball: Loose' : 'Ball: Off board');
  const summary = `Mode: ${MODE_LABELS[S.tool] || 'Board'} · Step ${S.currentStep + 1} of ${count} · ${ownerText}`;
  if (mode) mode.textContent = MODE_LABELS[S.tool] || 'Board';
  if (text) text.textContent = summary;
  if (toolbarMode) toolbarMode.textContent = `Mode: ${MODE_LABELS[S.tool] || 'Board'}`;
  if (gainlineBtn) gainlineBtn.classList.toggle('active', showGainline);
  if (mobGainlineBtn) {
    mobGainlineBtn.classList.toggle('is-active', showGainline);
    mobGainlineBtn.textContent = showGainline ? 'ON' : 'OFF';
  }
  if (ghostPrevBtn) {
    ghostPrevBtn.classList.toggle('active', !!S.showGhostPrevious);
    ghostPrevBtn.setAttribute('aria-pressed', S.showGhostPrevious ? 'true' : 'false');
  }
  if (mobGhostPrevBtn) {
    mobGhostPrevBtn.classList.toggle('is-active', !!S.showGhostPrevious);
    mobGhostPrevBtn.textContent = S.showGhostPrevious ? 'ON' : 'OFF';
  }
  if (mobBallBtn) mobBallBtn.disabled = !!S.ball;
  if (empty) empty.classList.toggle('hidden', !!S.players.length || !!S.ball || !!S.annotations.length);
  if (shouldShowFirstUseTutorial() && !_tourActive) {
    startTour();
  }
}

function toggleGainline() {
  if (!claimPhoneDataAction('more:gainline')) return;
  showGainline = !showGainline;
  resetDeleteConfirm('phase');
  resetDeleteConfirm('move');
  closeRadialMenu();
  setHint(showGainline ? 'Gainline visible. Drag it in Move mode to reposition it.' : 'Gainline hidden.');
  refreshInteractionUI();
  render();
}
window.toggleGainline = toggleGainline;

function toggleGhostPrevious() {
  if (!claimPhoneDataAction('more:ghost-previous')) return;
  S.showGhostPrevious = !S.showGhostPrevious;
  closeRadialMenu();
  setHint(S.showGhostPrevious ? 'Ghost previous is on. Previous positions render as reference outlines only.' : 'Ghost previous is off. Only the current move keyframe renders as solid tokens.');
  refreshInteractionUI();
  render();
}
window.toggleGhostPrevious = toggleGhostPrevious;

function updateAnnotationPanel() {
  const copy = document.getElementById('annotationCopy');
  const input = document.getElementById('annotationText');
  if (!copy || !input) return;
  if (S.tool === 'note') {
    copy.textContent = 'Click the field to place a premium note card. The input above sets the default note text.';
  } else if (S.tool === 'arrow') {
    copy.textContent = 'Drag on the field to draw a free tactical arrow.';
  } else if (S.tool === 'zone') {
    copy.textContent = 'Drag on the field to size a circle or oval highlight for space, support, or defensive gaps. Hold Shift for a perfect circle.';
  } else if (S.tool === 'box') {
    copy.textContent = 'Drag on the field to size a box highlight for channels, pressure areas, or field zones.';
  } else if (S.tool === 'ellipse') {
    copy.textContent = 'Drag on the field to size a circle or oval highlight for space, support, or defensive gaps. Hold Shift for a perfect circle.';
  } else if (S.tool === 'kick') {
    copy.textContent = 'Secondary tool: click the kicker, then the target.';
  } else if (S.tool === 'erase') {
    copy.textContent = 'Secondary tool: remove players, the ball, paths, passes, or highlights.';
  } else {
    copy.textContent = 'Choose a highlight or secondary tool, then click or drag on the field.';
  }
}

function updatePlayMetadataPanel() {
  const metadata = buildPlayMetadata();
  const titleValue = document.getElementById('metaTitleValue');
  if (titleValue) titleValue.textContent = metadata.title || tr('untitled.play', {}, 'Untitled Play');

  const purpose = document.getElementById('metaPurpose');
  const decisionCue = document.getElementById('metaDecisionCue');
  const coachingInputs = [
    document.getElementById('metaCoachingPoint1'),
    document.getElementById('metaCoachingPoint2'),
    document.getElementById('metaCoachingPoint3'),
  ];
  const mistakeInputs = [
    document.getElementById('metaCommonMistake1'),
    document.getElementById('metaCommonMistake2'),
    document.getElementById('metaCommonMistake3'),
  ];

  if (purpose && purpose !== document.activeElement) purpose.value = metadata.purpose || '';
  if (decisionCue && decisionCue !== document.activeElement) decisionCue.value = metadata.decisionCue || '';

  coachingInputs.forEach((input, idx) => {
    if (input && input !== document.activeElement) input.value = metadata.coachingPoints[idx] || '';
  });
  mistakeInputs.forEach((input, idx) => {
    if (input && input !== document.activeElement) input.value = metadata.commonMistakes[idx] || '';
  });
}

function readMetaList(ids, maxItems) {
  return normalizeTextList(ids.map(id => document.getElementById(id)?.value || ''), maxItems);
}

function updatePlayMetadataFromInputs() {
  S.playMetadata = normalizeProjectMetadata(
    { name: currentPlayTitle() },
    {
      ...(S.playMetadata || {}),
      title: currentPlayTitle(),
      purpose: document.getElementById('metaPurpose')?.value || '',
      coachingPoints: readMetaList(['metaCoachingPoint1', 'metaCoachingPoint2', 'metaCoachingPoint3'], 3),
      decisionCue: document.getElementById('metaDecisionCue')?.value || '',
      commonMistakes: readMetaList(['metaCommonMistake1', 'metaCommonMistake2', 'metaCommonMistake3'], 3),
    }
  );
  updatePlayMetadataPanel();
  scheduleAutosave();
}

function focusSelectedNoteInput(selectAll = false) {
  beginSelectedNoteInlineEdit({ selectAll });
}

function updateSelectedNoteText(value) {
  const ann = selectedAnnotation();
  if (!ann || ann.type !== 'note') return;
  ann.text = String(value ?? '').slice(0, 160);
  clampNoteAnnotation(ann);
  scheduleAutosave();
  refreshInteractionUI();
  render();
}

function setSelectedNoteAlign(align) {
  const ann = selectedAnnotation();
  if (!ann || ann.type !== 'note') return;
  ann.align = align === 'center' || align === 'right' ? align : 'left';
  scheduleAutosave();
  refreshInteractionUI();
  render();
}
window.setSelectedNoteAlign = setSelectedNoteAlign;

const TOOL_GUIDE_CONTENT = {
  move:  { icon: '↖', desc: 'Move objects. Drag players, ball, paths or notes to reposition. Click a run path, pass or kick to select it.' },
  run:   { icon: '⟶', desc: 'Create player movement. Click a player, draw the run path, then play the step.' },
  path:  { icon: '⟶', desc: 'Create player movement. Click a player, draw the run path, then play the step.' },
  pass:  { icon: '⤳', desc: 'Tap the passer — ball moves to them automatically. Then tap the receiver.' },
  kick:  { icon: '↑', desc: 'Tap the kicker — ball moves to them automatically. Then tap a receiver or field target.' },
  zone:  { icon: '○', desc: 'Drag on the field to draw a circle highlight area.' },
  box:   { icon: '□', desc: 'Drag on the field to draw a box zone or channel.' },
  arrow: { icon: '↗', desc: 'Add visual annotation. Arrows explain intent but do not animate players.' },
  note:  { icon: '✎', desc: 'Tap on the field to place a coaching cue card.' },
  erase: { icon: '✕', desc: 'Tap any player, ball, path, or annotation to remove it.' },
};

TOOL_GUIDE_CONTENT.ellipse = { icon: '()', desc: 'Drag on the field to draw a circle or oval highlight area. Hold Shift for a perfect circle.' };

function updateSmartPanel() {
  const guide = TOOL_GUIDE_CONTENT[S.tool] || TOOL_GUIDE_CONTENT.run || TOOL_GUIDE_CONTENT.move;
  const modeEl    = document.getElementById('spModeLabel');
  const guideText = document.getElementById('spGuideText');
  const guideIcon = document.getElementById('spGuideIcon');
  const stepBadge = document.getElementById('spStepBadge');
  const annSection  = document.getElementById('spAnnSection');
  const emptyState  = document.getElementById('spEmptyState');
  const kickCtx   = document.getElementById('spKickCtx');
  const kickStep1 = document.getElementById('spKickStep1');
  const kickStep2 = document.getElementById('spKickStep2');

  const toolLabel = MODE_LABELS[S.tool] || 'Move';
  if (modeEl) modeEl.textContent = toolLabel;
  const defaultMode = document.getElementById('spDefaultMode');
  if (defaultMode) defaultMode.textContent = toolLabel;
  if (guideIcon) guideIcon.textContent = guide.icon;
  if (stepBadge) {
    const count = sequenceStepCount();
    stepBadge.textContent = `${S.currentStep + 1} / ${count}`;
  }

  const isKick = S.tool === 'kick';
  if (guideText) {
    guideText.textContent = guide.desc;
    guideText.hidden = isKick;
  }
  if (kickCtx) kickCtx.hidden = !isKick;
  if (kickStep1) kickStep1.classList.toggle('active', isKick && !activeWorkflowPlayerId());
  if (kickStep2) kickStep2.classList.toggle('active', isKick && !!activeWorkflowPlayerId());

  const isAnnotationTool = S.tool === 'note' || S.tool === 'arrow' || S.tool === 'zone' || S.tool === 'box' || S.tool === 'ellipse';
  const defaultState = document.getElementById('spDefaultState');
  const hasSelection = !!S.selectedPlayerId || !!S.selectedGroupId || isBallSelected() || !!selectedAnnotationId();
  const showDefault = !hasSelection && !isKick;


  if (annSection) annSection.hidden = !isAnnotationTool;
  if (defaultState) defaultState.hidden = !showDefault;
  if (emptyState) emptyState.hidden = true;

  if (guideText && !isKick) {
    guideText.textContent = guide.desc;
  }
  if (isKick && guideText) {
    guideText.textContent = 'Select your kicker, then choose a target or landing zone.';
  }
}

function toggleSmartPanelNotes() {
  // Notes zone is always visible in v2 — kept for backwards compatibility
}
window.toggleSmartPanelNotes = toggleSmartPanelNotes;

function toggleMobileDrawer() {
  const panel    = document.getElementById('smartPanel');
  const backdrop = document.getElementById('spMobileBackdrop');
  const toggle   = document.getElementById('spMobileToggle');
  if (!panel) return;
  const isOpen = panel.classList.contains('sp-drawer-open');
  if (isOpen) { closeMobileDrawer(); return; }
  panel.classList.add('sp-drawer-open');
  if (backdrop) backdrop.classList.add('open');
  if (toggle) toggle.setAttribute('aria-expanded', 'true');
  scheduleSequenceDockPosition();
}
function closeMobileDrawer() {
  const panel    = document.getElementById('smartPanel');
  const backdrop = document.getElementById('spMobileBackdrop');
  const toggle   = document.getElementById('spMobileToggle');
  if (panel) panel.classList.remove('sp-drawer-open');
  if (backdrop) backdrop.classList.remove('open');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
  scheduleSequenceDockPosition();
}
window.toggleMobileDrawer = toggleMobileDrawer;
window.closeMobileDrawer  = closeMobileDrawer;

function setMobileBoardMenuOpen(open) {
  const menu = document.getElementById('mobileBoardMenu');
  const btn = document.getElementById('mobileBoardMenuBtn');
  const isOpen = !!open && isPhoneViewport;
  if (!menu) return;
  if (isOpen) {
    closeMobileNotesSheet();
    setMobileMoreDrawerOpen(false);
  }
  menu.classList.toggle('open', isOpen);
  menu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}
function toggleMobileBoardMenu() {
  const menu = document.getElementById('mobileBoardMenu');
  if (!menu) return;
  setMobileBoardMenuOpen(!menu.classList.contains('open'));
}
function closeMobileBoardMenu() {
  setMobileBoardMenuOpen(false);
}
window.toggleMobileBoardMenu = toggleMobileBoardMenu;
window.closeMobileBoardMenu = closeMobileBoardMenu;

function setMobileNotesSheetOpen(open) {
  const sheet = document.getElementById('mobileNotesSheet');
  const isOpen = !!open && isPhoneViewport;
  if (!sheet) return;
  sheet.classList.toggle('open', isOpen);
  sheet.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
}
function openMobileNotesSheet() {
  if (!claimPhoneDataAction('more:notes')) return;
  closeMobileBoardMenu();
  setMobileMoreDrawerOpen(false);
  setMobileNotesSheetOpen(true);
}
function closeMobileNotesSheet() {
  setMobileNotesSheetOpen(false);
}
window.openMobileNotesSheet = openMobileNotesSheet;
window.closeMobileNotesSheet = closeMobileNotesSheet;

/* ── Coaching drawer ── */
function toggleCoachingDrawer() {
  const drawer = document.getElementById('coachingDrawer');
  const btn    = document.getElementById('coachModeBtn');
  if (!drawer) return;
  const open = drawer.classList.toggle('cd-open');
  if (btn) {
    btn.classList.toggle('coach-active', open);
    btn.setAttribute('aria-pressed', open ? 'true' : 'false');
  }
}
window.toggleCoachingDrawer = toggleCoachingDrawer;

function closeCoachingDrawer() {
  const drawer = document.getElementById('coachingDrawer');
  const btn    = document.getElementById('coachModeBtn');
  if (!drawer) return;
  drawer.classList.remove('cd-open');
  if (btn) {
    btn.classList.remove('coach-active');
    btn.setAttribute('aria-pressed', 'false');
  }
}
window.closeCoachingDrawer = closeCoachingDrawer;

function toggleAccordion(id) {
  const section = document.getElementById(id);
  if (!section) return;
  const setOpen = (target, open) => {
    target.classList.toggle('sp-acc-open', open);
    const targetTrigger = target.querySelector(':scope > .sp-acc-trigger');
    if (targetTrigger) targetTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  const isOpen = section.classList.contains('sp-acc-open');
  const shouldOpen = !isOpen;
  const desktopAccordion = !document.body.classList.contains('is-phone');
  const group = section.getAttribute('data-accordion-group');
  if (desktopAccordion && shouldOpen && group) {
    const groupSections = document.querySelectorAll('.sp-acc-section[data-accordion-group="' + group + '"]');
    groupSections.forEach(function(target) {
      if (target !== section) setOpen(target, false);
    });
  }
  setOpen(section, shouldOpen);
  scheduleSequenceDockPosition();
}
window.toggleAccordion = toggleAccordion;

function setAnnotationColor(color) {
  const ann = selectedAnnotation();
  if (ann?.type === 'arrow' || (!ann && S.tool === 'arrow')) {
    applyArrowStyleSelection({ color });
    return;
  }
  if (isShapeAnnotationType(ann?.type) || (!ann && isShapeAnnotationType(S.tool))) {
    applyShapeStyleSelection({ color });
    return;
  }
  if (ann) {
    const annId = selectedAnnotationId();
    snapshot();
    const target = annId ? findAnnotationById(annId) : selectedAnnotation();
    if (target) target.color = color;
    refreshInteractionUI();
    render();
    return;
  }
  if (selectedGroup() || S.selectedPlayerId !== null) {
    snapshot();
    setSelectedUnitColor(color);
  }
}
window.setAnnotationColor = setAnnotationColor;

function setArrowThickness(thickness) {
  if (S.tool !== 'arrow' && selectedAnnotation()?.type !== 'arrow') return;
  applyArrowStyleSelection({ thickness });
}
window.setArrowThickness = setArrowThickness;

function setArrowDash(dash) {
  if (S.tool !== 'arrow' && selectedAnnotation()?.type !== 'arrow') return;
  applyArrowStyleSelection({ dash });
}
window.setArrowDash = setArrowDash;

function setShapeThickness(thickness) {
  if (!isShapeAnnotationType(S.tool) && !isShapeAnnotationType(selectedAnnotation()?.type)) return;
  applyShapeStyleSelection({ thickness });
}
window.setShapeThickness = setShapeThickness;

function setShapeDash(dash) {
  if (!isShapeAnnotationType(S.tool) && !isShapeAnnotationType(selectedAnnotation()?.type)) return;
  applyShapeStyleSelection({ dash });
}
window.setShapeDash = setShapeDash;

function refreshInteractionUI() {
  persistCurrentStep();
  updateSelInfo();
  rebuildPalette();
  updatePaletteSummary();
  updateBoardStatus();
  updatePlayMetadataPanel();
  updateSequenceUI();
  updateMobileUI();
  updateSmartPanel();
  syncHistoryControls();
  scheduleSequenceDockPosition();
  syncNoteInlineEditor();
}

function scrollCompactToolbarToolIntoView(tool = S.tool) {
  const toolbar = document.getElementById('compactToolbar');
  const btn = toolbar?.querySelector(`.tool-btn[data-tool="${tool}"]`);
  if (!toolbar || !btn) return;
  requestAnimationFrame(() => {
    const targetLeft = Math.max(0, btn.offsetLeft - Math.max(24, (toolbar.clientWidth - btn.offsetWidth) / 2));
    const maxScroll = Math.max(0, toolbar.scrollWidth - toolbar.clientWidth);
    toolbar.scrollLeft = clamp(targetLeft, 0, maxScroll);
  });
}

function setTool(t) {
  if (t === 'ellipse') t = 'zone';
  // Any call to setTool() - rail click or radial dispatch alike - starts by
  // treating a prior radial one-shot Arrow as abandoned. activateRadialAction()
  // re-arms it immediately after calling setTool('arrow') below, so the flag
  // still ends up correctly set for a genuine radial activation; this only
  // prevents a stale flag from an abandoned radial attempt silently making a
  // later, unrelated rail Arrow click player-anchored.
  S.radialArrowSourcePlayerId = null;
  if (t === S.tool && t !== 'move') {
    // Second click on the already-active rail tool: cancel it and return to
    // Move. One canonical helper (also used by Escape) replaces the previous
    // ad-hoc per-tool special cases here, so every tool - not just
    // erase/pass/kick/run - toggles off the same way.
    cancelActiveBoardInteraction();
    return;
  }
  const switchingAwayFromKick = t !== 'kick' && S.activeKickerId;
  const switchingAwayFromRun = t !== 'run' && S.activeRunSourceId;
  if (switchingAwayFromKick) cancelArmedKick();
  if (switchingAwayFromRun) cancelArmedRun();
  S.tool = t;
  if (t !== 'run')           S.drawing = null;
  if (t !== 'arrow' && t !== 'zone' && t !== 'box' && t !== 'ellipse') S.annotationDraft = null;
  if (t !== 'tele') teleDrawing = null;
  if (t !== 'pass' && t !== 'kick') clearPassKickState();
  if (t !== 'run') clearArmedRunState();
  if (t !== 'move') clearDragPlayer();
  if (t !== 'move') clearPendingGroupPlacement();
  S.selectedPathPid = null;
  S.selectedPassIdx = null;
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`[data-tool="${t}"]`).forEach(b => b.classList.add('active'));
  scrollCompactToolbarToolIntoView(t);
  cv.style.cursor = t === 'move' ? 'default' : 'crosshair';
  if (t === 'run' && S.selectedPlayerId !== null && !selectedGroup()) {
    const selectedPlayer = S.players.find(player => player.id === S.selectedPlayerId) || null;
    if (selectedPlayer) {
      setArmedRunSource(selectedPlayer.id);
      selectPlayer(selectedPlayer.id, { highlightedIds: [selectedPlayer.id] });
      const teamLabel = selectedPlayer.team === 'A' ? 'Attack' : 'Defence';
      setHint(`Run from ${teamLabel} #${selectedPlayer.num}. Drag on the pitch to draw the path, or tap the same player again to cancel.`);
    } else {
      setHint(HINTS[t] || '');
    }
  } else if ((t === 'pass' || t === 'kick') && S.selectedPlayerId !== null && !selectedGroup()) {
    const selectedPlayer = S.players.find(player => player.id === S.selectedPlayerId) || null;
    if (selectedPlayer) {
      setWorkflowSource(selectedPlayer.id, t);
      selectPlayer(selectedPlayer.id, { highlightedIds: [selectedPlayer.id] });
      S.ballOwner = playerRef(selectedPlayer);
      S.ballAttached = true;
      if (!S.ball) S.ball = { x: selectedPlayer.x, y: selectedPlayer.y };
      syncAttachedBallToOwner();
      applyBallOwnershipVisualState();
      const teamLabel = selectedPlayer.team === 'A' ? 'Attack' : 'Defence';
      setHint(t === 'kick'
        ? `Kick from ${teamLabel} #${selectedPlayer.num}. Tap a receiver or field target.`
        : `Pass from ${teamLabel} #${selectedPlayer.num}. Tap the receiver.`);
    } else {
      setHint(HINTS[t] || '');
    }
  } else {
    setHint(HINTS[t] || '');
  }
  updateAnnotationPanel();
  refreshInteractionUI();
  render();
}
function setHint(txt) { document.getElementById('hint').textContent = txt; }


window.addEventListener('animator-languagechange', () => {
  HINTS.move = hintText('move');
  HINTS.run = hintText('run');
  HINTS.pass = hintText('pass');
  HINTS.kick = hintText('kick');
  HINTS.erase = hintText('erase');
  HINTS.box = hintText('box');
  HINTS.note = hintText('note');
  HINTS.arrow = hintText('arrow');
  HINTS.zone = hintText('zone');
  HINTS.ellipse = hintText('zone');
  HINTS.tele = hintText('tele');

  MODE_LABELS.move = modeLabel('move');
  MODE_LABELS.run = modeLabel('run');
  MODE_LABELS.pass = modeLabel('pass');
  MODE_LABELS.kick = modeLabel('kick');
  MODE_LABELS.erase = modeLabel('erase');
  MODE_LABELS.box = modeLabel('box');
  MODE_LABELS.note = modeLabel('note');
  MODE_LABELS.arrow = modeLabel('arrow');
  MODE_LABELS.zone = modeLabel('zone');
  MODE_LABELS.ellipse = modeLabel('ellipse');
  MODE_LABELS.tele = modeLabel('tele');

  updateAnnotationPanel();
  updatePresetOptionsUI();
  updatePlayMetadataPanel();
  refreshSavedPlayList();
  updateSelInfo();
  refreshInteractionUI();
  updateSequenceUI();
  if (!document.getElementById('playerNumberPopover')?.hidden) renderPlayerNumberPicker();
  if (_tourActive) _tourShowStep(_tourCurrentStep);
  render();
});


function toggleMobileMoreDrawer() {
  const drawer = document.getElementById('mobileMoreDrawer');
  const btn    = document.getElementById('mobMoreBtn');
  if (!drawer) return;
  setMobileMoreDrawerOpen(!drawer.classList.contains('open'));
  return;
  const isOpen = drawer.classList.toggle('open');
  drawer.setAttribute('aria-hidden', String(!isOpen));
  if (btn) btn.textContent = isOpen ? 'MORE ▾' : 'MORE ▴';
}
window.toggleMobileMoreDrawer = toggleMobileMoreDrawer;

function setMobileMoreDrawerOpen(open) {
  const drawer = document.getElementById('mobileMoreDrawer');
  const btn    = document.getElementById('mobMoreBtn');
  const isOpen = !!open && isMobilePortraitBoard;
  if (!drawer) return;
  drawer.classList.toggle('open', isOpen);
  drawer.setAttribute('aria-hidden', String(!isOpen));
  if (btn) btn.textContent = isOpen ? 'MORE ▾' : 'MORE ▴';
}

function toggleMobileMoreDrawer() {
  const drawer = document.getElementById('mobileMoreDrawer');
  if (!drawer) return;
  closeMobileBoardMenu();
  closeMobileNotesSheet();
  setMobileMoreDrawerOpen(!drawer.classList.contains('open'));
}
window.toggleMobileMoreDrawer = toggleMobileMoreDrawer;

function setMobileMoreDrawerOpen(open) {
  const drawer = document.getElementById('mobileMoreDrawer');
  const btn    = document.getElementById('mobMoreBtn');
  const isOpen = !!open && isPhoneViewport;
  if (!drawer) return;
  drawer.classList.toggle('open', isOpen);
  drawer.setAttribute('aria-hidden', String(!isOpen));
  if (btn) btn.textContent = isOpen ? 'MORE â–¾' : 'MORE â–´';
}

function toggleMobileMoreDrawer() {
  const drawer = document.getElementById('mobileMoreDrawer');
  if (!drawer) return;
  closeMobileBoardMenu();
  closeMobileNotesSheet();
  setMobileMoreDrawerOpen(!drawer.classList.contains('open'));
}
window.toggleMobileMoreDrawer = toggleMobileMoreDrawer;

function setMobileMoreDrawerOpen(open) {
  const drawer = document.getElementById('mobileMoreDrawer');
  const backdrop = document.getElementById('mobileMoreBackdrop');
  const btn    = document.getElementById('mobMoreBtn');
  const isOpen = !!open && isPhoneViewport;
  if (!drawer) return;
  // updateMobileUI() calls this unconditionally on every resize() pass (to
  // force the drawer closed off-phone) - scheduleResizePass() must only fire
  // when the drawer's open state actually flips, or resize() -> updateMobileUI()
  // -> setMobileMoreDrawerOpen(false) -> scheduleResizePass() -> next-frame
  // resize() forms an unconditional, self-perpetuating render loop that never
  // settles even at complete idle.
  const wasOpen = drawer.classList.contains('open');
  drawer.classList.toggle('open', isOpen);
  drawer.setAttribute('aria-hidden', String(!isOpen));
  if (backdrop) backdrop.classList.toggle('open', isOpen);
  if (isOpen) drawer.scrollTop = 0;
  if (btn) btn.textContent = isOpen ? 'MORE v' : 'MORE ^';
  if (isOpen !== wasOpen) scheduleResizePass();
}

// ---- Portrait editing-view scroll lifecycle -------------------------------

// The halfway line (field y=50) sits exactly at the vertical midpoint of the
// field's own display bounds (F.DY0..F.DY1 are symmetric around 50), which
// is exactly #canvasWrap's own vertical centre - so centring the wrap's
// centre in #canvasHost's viewport centres the halfway line.
function centerPortraitHalfwayLine() {
  const host = document.getElementById('canvasHost');
  const wrap = document.getElementById('canvasWrap');
  if (!host || !wrap) return;
  host.scrollTop = Math.max(0, (wrap.offsetHeight - host.clientHeight) / 2);
}

function restorePortraitScrollPosition() {
  const host = document.getElementById('canvasHost');
  if (!host) return;
  if (Number.isFinite(mobilePortraitScrollTop)) {
    const maxScroll = Math.max(0, host.scrollHeight - host.clientHeight);
    host.scrollTop = Math.max(0, Math.min(mobilePortraitScrollTop, maxScroll));
  } else {
    centerPortraitHalfwayLine();
  }
}

let mobileLastKnownPortraitState = null; // null=unknown (first phone entry), then true/false

// Called from resize() on every settled phone pass. Detects genuine
// orientation TRANSITIONS (not every resize) to: save the editing-view
// scroll position when leaving portrait, and restore it (or centre the
// halfway line, for a first-ever entry) when (re)entering it.
function handleMobilePortraitScrollLifecycle(isPortraitNow) {
  const wasPortrait = mobileLastKnownPortraitState;
  if (wasPortrait === true && !isPortraitNow) {
    const host = document.getElementById('canvasHost');
    if (host && !mobileFitFullPitch) mobilePortraitScrollTop = host.scrollTop;
  }
  const enteringPortrait = isPortraitNow && wasPortrait !== true;
  mobileLastKnownPortraitState = isPortraitNow;
  if (enteringPortrait && !mobileFitFullPitch) {
    // Wait for the scroll container's CSS (overflow-y:auto, natural tall
    // #canvasWrap) to be the settled, active layout before reading/writing
    // scrollTop - one rAF for this resize pass's own layout, one more so any
    // dependent reflow (e.g. the toolbar/header switching modes too) settles.
    requestAnimationFrame(() => requestAnimationFrame(restorePortraitScrollPosition));
  }
}

function mobileAutoReturnFromFitFullPitch() {
  if (mobileFitFullPitch) toggleMobileFitFullPitch(false);
}

// Portrait-only. Temporarily contain-fits the whole pitch (both goalposts
// visible, no scroll) instead of the default large, scrollable editing view.
// Auto-returns to editing view on the next player select/drag/add or Move
// change (mobileAutoReturnFromFitFullPitch's call sites); pressing the same
// More button again also toggles it back manually - never a second,
// duplicate playback/view control.
function toggleMobileFitFullPitch(forceValue) {
  if (!isMobilePortraitBoard) return;
  const next = typeof forceValue === 'boolean' ? forceValue : !mobileFitFullPitch;
  if (next === mobileFitFullPitch) return;
  if (next) {
    // Entering: remember the editing-view scroll position so returning to it
    // (whether via auto-return or a manual second press) restores exactly.
    const host = document.getElementById('canvasHost');
    if (host) mobilePortraitScrollTop = host.scrollTop;
  }
  mobileFitFullPitch = next;
  const btn = document.getElementById('mobileMoreFitPitchBtn');
  if (btn) btn.textContent = mobileFitFullPitch ? 'EDITING VIEW' : 'FIT FULL PITCH';
  scheduleResizePass();
  if (!mobileFitFullPitch) {
    requestAnimationFrame(() => requestAnimationFrame(restorePortraitScrollPosition));
  }
}
window.toggleMobileFitFullPitch = toggleMobileFitFullPitch;

function updateMobileUI() {
  const mobilePhasePill = document.getElementById('mobilePhasePill');
  const mobilePhaseCounterLabel = document.getElementById('mobilePhaseCounterLabel');
  const mobilePhasePrevBtn = document.getElementById('mobilePhasePrevBtn');
  const mobilePhaseNextBtn = document.getElementById('mobilePhaseNextBtn');
  const mobilePhaseStepperValue = document.getElementById('mobilePhaseStepperValue');
  const mobileMoveStepperValue = document.getElementById('mobileMoveStepperValue');
  const mobilePhaseDeleteBtn = document.getElementById('mobilePhaseDeleteBtn');
  const mobileMoveDeleteBtn = document.getElementById('mobileMoveDeleteBtn');
  const mobGainlineBtn = document.getElementById('mobGainlineBtn');
  const mobileRailAddAttackBtn = document.getElementById('mobileRailAddAttackBtn');
  const mobileRailAddDefenceBtn = document.getElementById('mobileRailAddDefenceBtn');
  const mobileMorePlayPhaseBtn = document.getElementById('mobileMorePlayPhaseBtn');
  const mobileMorePreviewBtn = document.getElementById('mobileMorePreviewBtn');
  const playAllPlayable = projectHasPlayablePlayback();

  syncResponsiveToolbarLabels();
  syncPlayButtons();
  if (mobilePhasePill) updateMobilePhaseCounterLabel();
  if (mobilePhaseCounterLabel) {
    mobilePhaseCounterLabel.textContent = `PHASE ${GamePlan.currentPhase + 1}/${GamePlan.phases.length} · MOVE ${S.currentStep + 1}/${sequenceStepCount()}`;
  }
  syncSpeedButtonsUI();
  // Header chevrons step canonical Moves (see the bindSinglePhoneButton wiring
  // below), so their disabled state follows the canonical Move boundary, not
  // the current Phase's boundary.
  {
    const canonicalIndex = getCurrentCanonicalMoveIndex();
    const canonicalCount = getCanonicalMoveCount();
    if (mobilePhasePrevBtn) mobilePhasePrevBtn.disabled = canonicalIndex <= 0;
    if (mobilePhaseNextBtn) mobilePhaseNextBtn.disabled = canonicalIndex < 0 || canonicalIndex >= canonicalCount - 1;
  }
  if (mobilePhaseStepperValue) mobilePhaseStepperValue.textContent = `${GamePlan.currentPhase + 1}/${GamePlan.phases.length}`;
  if (mobileMoveStepperValue) mobileMoveStepperValue.textContent = `${sequenceStepCount()}/${sequenceStepCount()}`;
  if (mobilePhaseDeleteBtn) {
    mobilePhaseDeleteBtn.textContent = phoneDeleteConfirmState.phase ? 'SURE?' : '-';
    mobilePhaseDeleteBtn.classList.toggle('is-confirming', phoneDeleteConfirmState.phase);
  }
  if (mobileMoveDeleteBtn) {
    mobileMoveDeleteBtn.textContent = phoneDeleteConfirmState.move ? 'SURE?' : '-';
    mobileMoveDeleteBtn.classList.toggle('is-confirming', phoneDeleteConfirmState.move);
  }
  if (mobGainlineBtn) {
    mobGainlineBtn.textContent = showGainline ? 'ON' : 'OFF';
    mobGainlineBtn.classList.toggle('is-active', showGainline);
  }
  if (mobileRailAddAttackBtn) mobileRailAddAttackBtn.disabled = S.atkUsed.size >= 15;
  if (mobileRailAddDefenceBtn) mobileRailAddDefenceBtn.disabled = S.defUsed.size >= 15;
  // Play Phase / Preview Move (More panel): same rule as the desktop dock -
  // keep their normal label at all times, disable while any playback session
  // (started from either of them or from the top Play control) is active or
  // paused, so the top control remains the single Pause/Resume authority.
  const mobileAnySessionActive = S.animating || isCanonicalPlaybackPaused();
  if (mobileMorePlayPhaseBtn) {
    const phaseRange = getCanonicalPhasePlaybackRange();
    const playPhasePlayable = !!phaseRange && phaseRange.moveCount > 1;
    mobileMorePlayPhaseBtn.disabled = mobileAnySessionActive || !playPhasePlayable;
    mobileMorePlayPhaseBtn.title = mobileAnySessionActive
      ? 'Stop the current playback first'
      : (playPhasePlayable ? 'Play this Phase from its first Move' : 'This Phase contains only one Move');
  }
  if (mobileMorePreviewBtn) {
    const previewPlayable = currentPhaseHasPlayablePlayback();
    mobileMorePreviewBtn.disabled = mobileAnySessionActive || !previewPlayable;
    mobileMorePreviewBtn.title = mobileAnySessionActive
      ? 'Stop the current playback first'
      : (previewPlayable ? 'Preview the next transition' : 'No later move available to preview');
  }
  const mobileMoreFitPitchBtn = document.getElementById('mobileMoreFitPitchBtn');
  if (mobileMoreFitPitchBtn) {
    // Portrait-only view toggle - not meaningful in landscape (already a
    // contain-fit presentation view with no editing-view/scroll mode).
    mobileMoreFitPitchBtn.disabled = !isMobilePortraitBoard;
    mobileMoreFitPitchBtn.textContent = mobileFitFullPitch ? 'EDITING VIEW' : 'FIT FULL PITCH';
  }
  MOBILE_DRAWER_IDS.forEach(id => {
    const section = document.getElementById(`drawer-${id}`);
    if (!section) return;
    if (!isPhoneViewport) section.classList.remove('is-open');
  });
  if (!isPhoneViewport) {
    closeMobileToolsDropdown();
    closeMobileBoardMenu();
    closeMobileNotesSheet();
    setMobileMoreDrawerOpen(false);
  }
}

function clearPaths()  { snapshot(); S.paths=[]; S.passes=[]; S.drawing=null; setHint('Paths cleared. Choose the next action.'); refreshInteractionUI(); render(); }
function clearSelection() {
  endNoteInlineEdit();
  clearSelectedObject();
  S.selectedPassIdx = null;
  S.selectedPathPid = null;
  S.ballAssignCandidate = null;
  S.pointerTap = null;
  S.dragging = null;
  clearDragPlayer();
  clearPassKickState();
  clearArmedRunState();
  S.drawing = null;
  S.annotationDraft = null;
  setHint(tr('selection.clear', {}, 'Clear Selection'));
  updatePresetOptionsUI();
  updateAnnotationPanel();
  refreshInteractionUI();
  render();
}
window.clearSelection = clearSelection;

function cancelActiveBoardInteraction() {
  closeMobileToolsDropdown();
  // Single canonical "cancel everything, land on Move" path - shared by
  // Escape and by setTool()'s same-tool-click toggle, so a second click on
  // any active rail tool and pressing Escape always produce the exact same
  // safe, neutral result, no matter which tool was active or how far into
  // its interaction (armed-but-idle, mid-draft, mid-drag) the coach got.
  const hadInteraction = !!(
    (S.radialArrowSourcePlayerId !== null && S.radialArrowSourcePlayerId !== undefined) ||
    S.annotationDraft ||
    S.drawing ||
    teleDrawing ||
    activeWorkflowPlayerId() ||
    S.activeRunSourceId ||
    S.tool !== 'move' ||
    S.selectedPlayerId !== null ||
    S.selectedGroupId !== null ||
    isBallSelected() ||
    selectedAnnotationId() ||
    S.selectedPassIdx !== null ||
    S.selectedPathPid !== null
  );
  if (!hadInteraction) return false;

  S.radialArrowSourcePlayerId = null;
  S.annotationDraft = null;
  S.drawing = null;
  teleDrawing = null;
  clearPassKickState();
  clearArmedRunState();
  clearSelectedObject();
  clearDragPlayer();
  clearPendingGroupPlacement();
  clearHighlightedPlayers();
  S.selectedPassIdx = null;
  S.selectedPathPid = null;
  S.dragging = null;
  S.pointerTap = null;
  returnInteractionToMoveTool();
  updateAnnotationPanel();
  refreshInteractionUI();
  render();
  return true;
}
function clearAll() {
  clearPendingCanonicalPhaseStart();
  if (!claimPhoneDataAction('more:clear')) return;
  if (!confirm('Clear all players and paths? This cannot be undone.')) return;
  snapshot();
  resetDeleteConfirm('phase');
  resetDeleteConfirm('move');
  currentPresetId = null;
  GamePlan.name = 'New Play';
  GamePlan.currentPhase = 0;
  GamePlan.phases = [normalizePhaseState({ label: 'Phase 1' }, 0)];
  S.players=[]; S.ball=null; S.ballOwner=null; S.ballAttached=false; S.paths=[]; S.passes=[];
  S.projectId = null;
  S.projectMeta = null;
  S.playMetadata = emptyPlayMetadata('New Play');
  S.projectPlayback = null;
  S.annotations = [];
  S.drawing=null; S.passFrom=null; S.annotationDraft=null; S.selected=null; S.selectedPlayerId=null; S.selectedPlayerIds=[]; S.selectedGroupId=null; S.selectedAnnotationIdValue=null; S.selectedObjectType=null; S.dragPlayerId=null; S.activePasserId=null; S.activeKickerId=null; S.activeRunSourceId=null; S.highlightedPlayerIds=[]; S.ballAssignCandidate=null; S.selectedPathPid=null; S.selectedPassIdx=null; S.pendingGroupPlacement=null;
  S.animT=0; S.animating=false; S.playAll=false;
  canonicalPlaybackBoundaryIndex = null;
  canonicalPlaybackMode = 'idle';
  S.animSpd=1; spdIdx=0;
  showGainline=false;
  S.nextId=1;
  S.steps=[emptyStepState()]; S.currentStep=0;
  S.atkUsed=new Set(); S.defUsed=new Set();
  sequenceDockView = 'primary';
  document.getElementById('playName').value='New Play';
  setHint('Board reset. Start by adding players from the left.');
  syncSpeedButtonsUI();
  updateAnnotationPanel();
  updatePhaseUI();
  setPlayBtnState(); rebuildPalette(); refreshInteractionUI(); updateTL(); render();
  removeRecoveryDraft();
  replaceRecoveryDraftWithCurrentBoard();
}

function updateSelInfo() {
  const box = document.getElementById('selInfo');
  const meta = document.getElementById('selMeta');
  const clearBtn = document.getElementById('selClearBtn');
  const deleteBtn = document.getElementById('selDeleteBtn');
  const actionRow = box?.querySelector('.sp-sel-actions') || null;
  const giveBallBtn = document.getElementById('selGiveBallBtn');
  const groupActions = document.getElementById('spGroupActions');
  const groupModeBtn = document.getElementById('selGroupModeBtn');
  const regroupBtn = document.getElementById('selRegroupBtn');
  const arrowToolCards = [
    document.getElementById('spArrowToolCard'),
    document.getElementById('mobileArrowToolCard'),
  ].filter(Boolean);
  const arrowToolCopies = [
    document.getElementById('spArrowToolCopy'),
    document.getElementById('mobileArrowToolCopy'),
  ].filter(Boolean);
  const arrowColorPickers = [
    document.getElementById('spArrowColorPicker'),
    document.getElementById('mobileArrowColorPicker'),
  ].filter(Boolean);
  const arrowStyleControls = [
    document.getElementById('spArrowStyleControls'),
    document.getElementById('mobileArrowStyleControls'),
  ].filter(Boolean);
  const shapeToolCards = [
    document.getElementById('spShapeToolCard'),
    document.getElementById('mobileShapeToolCard'),
  ].filter(Boolean);
  const shapeToolCopies = [
    document.getElementById('spShapeToolCopy'),
    document.getElementById('mobileShapeToolCopy'),
  ].filter(Boolean);
  const shapeColorPickers = [
    document.getElementById('spShapeColorPicker'),
    document.getElementById('mobileShapeColorPicker'),
  ].filter(Boolean);
  const shapeStyleControls = [
    document.getElementById('spShapeStyleControls'),
    document.getElementById('mobileShapeStyleControls'),
  ].filter(Boolean);
  const editWrap = document.getElementById('selEditWrap');
  const editLabel = document.getElementById('selEditLabel');
  const noteInput = document.getElementById('selNoteInput');
  const floatingToolbar = document.getElementById('floatingSelectionToolbar');
  const floatingToolbarTitle = document.getElementById('floatingSelectionToolbarTitle');
  const floatingToolbarColorItem = document.getElementById('floatingToolbarColorItem');
  const floatingToolbarColorValue = document.getElementById('floatingToolbarColorValue');
  const floatingToolbarColorSwatch = document.getElementById('floatingToolbarColorSwatch');
  const floatingToolbarLineItem = document.getElementById('floatingToolbarLineItem');
  const floatingToolbarLineBtn = document.getElementById('floatingToolbarLineBtn');
  const floatingToolbarLineValue = document.getElementById('floatingToolbarLineValue');
  const floatingToolbarLinePreview = document.getElementById('floatingToolbarLinePreview');
  const floatingToolbarWeightItem = document.getElementById('floatingToolbarWeightItem');
  const floatingToolbarWeightBtn = document.getElementById('floatingToolbarWeightBtn');
  const floatingToolbarWeightValue = document.getElementById('floatingToolbarWeightValue');
  const floatingToolbarWeightPreview = document.getElementById('floatingToolbarWeightPreview');
  const floatingToolbarAlignItem = document.getElementById('floatingToolbarAlignItem');
  const floatingToolbarAlignBtn = document.getElementById('floatingToolbarAlignBtn');
  const floatingToolbarAlignValue = document.getElementById('floatingToolbarAlignValue');
  const floatingToolbarOpacityItem = document.getElementById('floatingToolbarOpacityItem');
  const floatingToolbarOpacityBtn = document.getElementById('floatingToolbarOpacityBtn');
  const floatingToolbarOpacityLabel = document.getElementById('floatingToolbarOpacityLabel');
  const floatingToolbarOpacityValue = document.getElementById('floatingToolbarOpacityValue');
  const floatingToolbarOpacity = document.getElementById('floatingToolbarOpacity');
  const floatingToolbarEditNoteBtn = document.getElementById('floatingToolbarEditNoteBtn');
  const summary = getSelectedSummary();
  const ann = selectedAnnotation();
  const group = selectedGroup();
  const selectedPlayer = S.selectedPlayerId !== null
    ? S.players.find(player => player.id === S.selectedPlayerId) || null
    : null;
  const playerGroup = !group && selectedPlayer ? groupForPlayer(selectedPlayer) : null;
  const arrowStyle = currentArrowStyleSelection();
  const activeShapeType = isShapeAnnotationType(ann?.type) ? ann.type : (isShapeAnnotationType(S.tool) ? S.tool : null);
  const shapeStyle = currentShapeStyleSelection(activeShapeType);
  const arrowStyleVisible = S.tool === 'arrow' || ann?.type === 'arrow';
  const shapeStyleVisible = !!activeShapeType;
  const annotationToolbarVisible = !!ann && S.selectedPassIdx === null && S.selectedPathPid === null;
  const showSelectionCard = summary.title !== '-' && !ann;
  document.getElementById('selName').textContent = summary.title;
  if (meta) meta.textContent = summary.meta;
  box.classList.toggle('visible', showSelectionCard);
  box.classList.toggle('annotation-selected', !!ann && S.selectedPassIdx === null && S.selectedPathPid === null);
  if (editWrap) editWrap.classList.toggle('visible', ann?.type === 'note');
  if (editLabel) editLabel.textContent = ann?.type === 'note' ? tr('note.text', {}, 'Note Text') : tr('details', {}, 'Details');
  if (noteInput) {
    if (noteInput !== document.activeElement) {
      noteInput.value = ann?.type === 'note' ? String(ann.text ?? '') : '';
    }
    noteInput.disabled = ann?.type !== 'note';
    noteInput.placeholder = ann?.type === 'note' ? tr('note.refineCue', {}, 'Refine the coaching cue') : tr('note.placeholder', {}, 'Update note text');
  }
  const giveBallTarget = manualBallAssignmentTarget();
  if (giveBallBtn) {
    giveBallBtn.hidden = !giveBallTarget;
    giveBallBtn.disabled = !giveBallTarget;
    giveBallBtn.onclick = giveBallToSelectedPlayer;
    if (giveBallTarget) {
      giveBallBtn.textContent = tr('giveBall.to', {
        team: giveBallTarget.team === 'A' ? 'A' : 'D',
        num: giveBallTarget.num,
      }, `Give Ball to ${giveBallTarget.team === 'A' ? 'A' : 'D'} #${giveBallTarget.num}`);
    }
  }
  const colorPicker = document.getElementById('spColorPicker');
  if (colorPicker) {
    const selectionColorVisible = !ann && (!!group || !!selectedPlayer);
    colorPicker.hidden = !selectionColorVisible;
    if (selectionColorVisible) {
      const currentColor = ann
        ? (ann.color || annotationColor(ann.type))
        : group
          ? (group.color || PRESET_GROUP_ATTACK)
          : (selectedPlayer?.colorOverride || playerColorPalette(selectedPlayer).fill);
      syncColorSwatches(colorPicker, currentColor);
    }
  }
  arrowToolCards.forEach(card => { card.hidden = !arrowStyleVisible; });
  arrowToolCopies.forEach(copy => {
    copy.textContent = ann?.type === 'arrow'
      ? tr('style.selectedLive', { item: tr('mode.arrow', {}, 'Arrow').toLowerCase() }, 'Selected arrow updates live as you change style.')
      : tr('style.chooseDefault', {}, 'Choose the default style before drawing.');
  });
  arrowStyleControls.forEach(controlSet => {
    controlSet.hidden = !arrowStyleVisible;
    syncArrowStyleButtons(controlSet, arrowStyle);
  });
  arrowColorPickers.forEach(picker => {
    if (arrowStyleVisible) syncColorSwatches(picker, arrowStyle.color);
  });
  shapeToolCards.forEach(card => { card.hidden = !shapeStyleVisible; });
  shapeToolCopies.forEach(copy => {
    copy.textContent = isShapeAnnotationType(ann?.type)
      ? tr('style.selectedLive', { item: tr('shape.style', {}, 'Shape Style').toLowerCase() }, 'Selected shape updates live as you change style.')
      : tr('style.chooseDefault', {}, 'Choose the default style before drawing.');
  });
  shapeStyleControls.forEach(controlSet => {
    controlSet.hidden = !shapeStyleVisible;
    syncShapeStyleButtons(controlSet, shapeStyle);
  });
  shapeColorPickers.forEach(picker => {
    if (shapeStyleVisible) syncColorSwatches(picker, shapeStyle.color);
  });
  const hasAnySelection = !!S.selectedPlayerId || !!group || isBallSelected() || !!ann || S.selectedPassIdx !== null || S.selectedPathPid !== null;
  if (groupActions) {
    const canUnlock = !!group && group.active;
    const canRegroup = !!playerGroup && playerGroup.active === false;
    groupActions.hidden = !canUnlock && !canRegroup;
    if (groupModeBtn) {
      groupModeBtn.hidden = !canUnlock;
      groupModeBtn.onclick = editSelectedPackIndividuals;
      groupModeBtn.textContent = tr('editIndividuals', {}, 'Edit Individuals');
    }
    if (regroupBtn) {
      regroupBtn.hidden = !canRegroup;
      regroupBtn.onclick = regroupSelectedPack;
      if (canRegroup) {
        regroupBtn.textContent = tr('regroup.packNamed', { label: playerGroup.label }, `Regroup ${playerGroup.label}`);
      } else {
        regroupBtn.textContent = tr('regroupPack', {}, 'Regroup Pack');
      }
    }
  }
  if (deleteBtn) {
    deleteBtn.onclick = deleteSelected;
    if (S.selectedPathPid !== null) deleteBtn.textContent = tr('remove.runPath', {}, 'Remove Run Path');
    else if (S.selectedPassIdx !== null) {
      const pass = S.passes[S.selectedPassIdx];
      deleteBtn.textContent = pass?.style === 'pass'
        ? tr('remove.pass', {}, 'Remove Pass')
        : tr('remove.kick', {}, 'Remove Kick');
    }
    else if (isBallSelected()) deleteBtn.textContent = tr('remove.ball', {}, 'Remove Ball');
    else if (ann) deleteBtn.textContent = tr('remove.item', { item: MODE_LABELS[ann.type] || 'Item' }, `Remove ${MODE_LABELS[ann.type] || 'Item'}`);
    else if (S.selectedPlayerId !== null) {
      const pl = S.players.find(p => p.id === S.selectedPlayerId);
      deleteBtn.textContent = pl
        ? tr('remove.fromField', {}, 'Remove from Field')
        : tr('remove.player', {}, 'Remove Player');
    } else {
      deleteBtn.textContent = tr('remove.player', {}, 'Remove Player');
    }
    deleteBtn.disabled = !hasAnySelection || !!group;
  }
  if (clearBtn) {
    clearBtn.onclick = clearSelection;
    clearBtn.textContent = hasAnySelection ? tr('selection.clear', {}, 'Clear Selection') : tr('selection.none', {}, 'No Selection');
    clearBtn.disabled = !hasAnySelection;
  }
  if (actionRow) actionRow.hidden = !!ann;
  const carrier = S.players.find(p => p.isBC);
  if (carrier) updateGainDisplayForY(carrier.y);
  else updateGainDisplayForY(GAINLINE_Y);

  if (floatingToolbar) {
    floatingToolbar.hidden = !annotationToolbarVisible;
    if (annotationToolbarVisible) {
      floatingToolbar.dataset.kind = ann.type;
      if (floatingToolbarTitle) floatingToolbarTitle.textContent = annotationToolbarTitle(ann);
      if (floatingToolbarColorItem) {
        floatingToolbarColorItem.hidden = false;
        syncColorSwatches(floatingToolbarColorItem, ann.color || annotationColor(ann.type));
      }
      if (floatingToolbarColorSwatch) floatingToolbarColorSwatch.style.background = ann.color || annotationColor(ann.type);
      if (floatingToolbarColorValue) floatingToolbarColorValue.textContent = annotationColorLabel(ann.color || annotationColor(ann.type));

      const showLine = ann.type === 'arrow' || isShapeAnnotationType(ann.type);
      if (floatingToolbarLineItem) floatingToolbarLineItem.hidden = !showLine;
      if (floatingToolbarLineBtn) floatingToolbarLineBtn.hidden = !showLine;
      if (showLine) {
        const lineValue = ann.type === 'arrow' ? arrowStyle.dash : currentShapeStyleSelection(ann.type).dash;
        if (floatingToolbarLinePreview) floatingToolbarLinePreview.dataset.line = lineValue;
        if (floatingToolbarLineValue) floatingToolbarLineValue.textContent = styleLineLabel(lineValue);
      }

      const showWeight = ann.type === 'arrow' || isShapeAnnotationType(ann.type);
      if (floatingToolbarWeightItem) floatingToolbarWeightItem.hidden = !showWeight;
      if (floatingToolbarWeightBtn) floatingToolbarWeightBtn.hidden = !showWeight;
      if (showWeight) {
        const weightValue = ann.type === 'arrow' ? arrowStyle.thickness : currentShapeStyleSelection(ann.type).thickness;
        if (floatingToolbarWeightPreview) floatingToolbarWeightPreview.dataset.weight = weightValue;
        if (floatingToolbarWeightValue) floatingToolbarWeightValue.textContent = styleWeightLabel(weightValue);
      }

      const showAlign = ann.type === 'note';
      if (floatingToolbarEditNoteBtn) floatingToolbarEditNoteBtn.hidden = !showAlign;
      if (floatingToolbarAlignItem) floatingToolbarAlignItem.hidden = !showAlign;
      if (floatingToolbarAlignBtn) floatingToolbarAlignBtn.hidden = !showAlign;
      if (showAlign) {
        const alignValue = noteAlignValue(ann);
        syncNoteAlignButtons(floatingToolbar, alignValue);
        if (floatingToolbarAlignValue) floatingToolbarAlignValue.textContent = noteAlignLabel(alignValue);
      }

      const showOpacity = ann.type === 'note' || isShapeAnnotationType(ann.type);
      if (floatingToolbarOpacityItem) floatingToolbarOpacityItem.hidden = !showOpacity;
      if (floatingToolbarOpacityBtn) floatingToolbarOpacityBtn.hidden = !showOpacity;
      if (showOpacity) {
        const opacityValue = clamp(Number(ann.opacity) || 1, 0.2, 1);
        if (floatingToolbarOpacity) floatingToolbarOpacity.value = String(opacityValue);
        if (floatingToolbarOpacityLabel) floatingToolbarOpacityLabel.textContent = ann.type === 'note' ? 'Transparency' : 'Fill';
        if (floatingToolbarOpacityValue) floatingToolbarOpacityValue.textContent = `${Math.round(opacityValue * 100)}%`;
      }

      if (ann.type === 'arrow') syncArrowStyleButtons(floatingToolbar, arrowStyle);
      else if (isShapeAnnotationType(ann.type)) syncShapeStyleButtons(floatingToolbar, currentShapeStyleSelection(ann.type));

      if (floatingToolbarOpenFlyout) {
        const activeTrigger = floatingToolbar.querySelector(`[data-flyout-target="${floatingToolbarOpenFlyout}"]`);
        if (!activeTrigger || activeTrigger.hidden || activeTrigger.closest('[hidden]')) {
          closeFloatingToolbarFlyout();
        }
      }
      scheduleFloatingSelectionToolbarUpdate();
    } else {
      floatingToolbar.dataset.kind = '';
      if (floatingToolbarEditNoteBtn) floatingToolbarEditNoteBtn.hidden = true;
      closeFloatingToolbarFlyout();
    }
  }
}

// Palette --------------------------------------------------
let palTab = 'atk';

function setTab(tab) {
  palTab = tab;
  S.tab = tab;
  document.querySelectorAll('.pal-tab').forEach(t => t.classList.remove('active'));
  const tabBtn = document.getElementById('tab-'+tab);
  if (tabBtn) tabBtn.classList.add('active');
  updateAnnotationPanel();
  rebuildPalette();
  refreshInteractionUI();
}

function rebuildPalette() {
  const grid = document.getElementById('palGrid');
  if (grid) grid.innerHTML = '';
  updatePaletteSummary();
  if (!document.getElementById('playerNumberPopover')?.hidden) renderPlayerNumberPicker();
}

function makeBoardData(nameOverride) {
  return makeProjectRecord(nameOverride);
}

function applyBoardData(play, { snapshotBefore = true } = {}) {
  clearPendingCanonicalPhaseStart();
  const project = normalizeProjectRecord(play);
  if (!project) return false;
  if (snapshotBefore) snapshot();

  const p = cloneData(project);
  GamePlan.name = p.name || 'Untitled Play';
  GamePlan.currentPhase = clamp(Number.isFinite(p.currentPhase) ? p.currentPhase : 0, 0, Math.max(0, (p.phases?.length || 1) - 1));
  GamePlan.phases = Array.isArray(p.phases) && p.phases.length
    ? p.phases.map((phase, index) => normalizePhaseState(phase, index))
    : [normalizePhaseState(p, 0)];
  const activePhase = GamePlan.phases[GamePlan.currentPhase] || GamePlan.phases[0];
  setLiveBoardFromStep(activePhase.steps[activePhase.currentStep] || emptyStepState());
  S.animT = 0;
  S.animating = false;
  S.playAll = false;
  canonicalPlaybackBoundaryIndex = null;
  canonicalPlaybackMode = 'idle';
  clearSelectedObject();
  S.selectedPlayerIds = [];
  S.drawing = null;
  S.annotationDraft = null;
  clearPassKickState();
  S.projectId = p.id;
  S.projectMeta = p.metadata;
  S.playMetadata = normalizeProjectMetadata({ name: p.name }, p.metadata);
  S.projectPlayback = p.playback;
  S.animSpd = S.projectPlayback?.currentSpeed || 1;
  spdIdx = Math.max(0, SPEEDS.indexOf(S.animSpd));
  sequenceDockView = 'primary';
  if (p.metadata?.source !== 'preset') currentPresetId = null;
  document.getElementById('playName').value = GamePlan.name || 'Untitled Play';
  syncPlayMetadataTitle();
  setPlayBtnState();
  document.getElementById('spdLabel').textContent = fmtSpd(S.animSpd);
  updatePresetOptionsUI();
  updatePhaseUI();
  rebuildPalette();
  refreshInteractionUI();
  updateTL();
  render();
  setTool('move');
  completeFirstUseTutorial();
  replaceRecoveryDraftWithCurrentBoard();
  return true;
}

function getSavedPlays() {
  try {
    const raw = localStorage.getItem(SAVED_PLAYS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(item => normalizeProjectRecord(item)).filter(Boolean);
  } catch {
    return [];
  }
}

function setSavedPlays(plays) {
  localStorage.setItem(SAVED_PLAYS_KEY, JSON.stringify(plays));
}

function saveCurrentPlay() {
  const board = makeBoardData();
  const saved = getSavedPlays();
  const stamp = nowIso();
  const entry = {
    ...board,
    metadata: {
      ...board.metadata,
      updatedAt: stamp,
    },
    savedAt: stamp,
  };
  S.projectId = entry.id;
  S.projectMeta = entry.metadata;
  S.playMetadata = entry.metadata;
  S.projectPlayback = entry.playback;
  const withoutSameProject = saved.filter(item => item.id !== entry.id);
  const withoutSameName = withoutSameProject.filter(item => item.name !== entry.name);
  withoutSameName.unshift(entry);
  setSavedPlays(withoutSameName.slice(0, 20));
  refreshSavedPlayList();
  setHint(`Saved "${entry.name}" locally.`);
  refreshInteractionUI();
  replaceRecoveryDraftWithCurrentBoard();
}

function refreshSavedPlayList() {
  const wrap = document.getElementById('savedPlayList');
  if (!wrap) return;
  const saved = getSavedPlays();
  wrap.innerHTML = '';
  if (!saved.length) {
    wrap.innerHTML = `<div class="saved-play-empty">${tr('saved.empty', {}, 'No local saves yet. Save the current board to keep building from it later.')}</div>`;
    return;
  }
  saved.forEach(item => {
    const card = document.createElement('div');
    card.className = 'saved-play-card';
    const savedDate = item.savedAt ? new Date(item.savedAt).toLocaleString() : tr('saved.local', {}, 'Saved locally');
    card.innerHTML = `<div class="saved-play-main">
      <div>
        <div class="saved-play-name">${item.name}</div>
        <div class="saved-play-meta">${savedDate}<br>${tr('saved.meta', {
          steps: item.steps?.length || 1,
          stepsLabel: (item.steps?.length || 1) === 1 ? tr('saved.step', {}, 'step') : tr('saved.steps', {}, 'steps'),
          players: item.players?.length || 0,
          paths: (item.paths || []).length,
          passes: (item.passes || []).length,
        }, `${item.steps?.length || 1} step${(item.steps?.length || 1) === 1 ? '' : 's'} · ${item.players?.length || 0} players · ${(item.paths||[]).length} paths · ${(item.passes||[]).length} passes`)}</div>
      </div>
    </div>
    <div class="saved-play-actions">
      <button class="saved-play-btn" data-action="load">${tr('saved.load', {}, 'Load')}</button>
      <button class="saved-play-btn" data-action="export">${tr('saved.export', {}, 'Export')}</button>
      <button class="saved-play-btn danger" data-action="delete">${tr('saved.delete', {}, 'Delete')}</button>
    </div>`;
    card.querySelector('[data-action="load"]').onclick = () => {
      if (applyBoardData(item)) {
        setHint(`Loaded "${item.name}".`);
        refreshInteractionUI();
      }
    };
    card.querySelector('[data-action="export"]').onclick = () => exportPlayData(item);
    card.querySelector('[data-action="delete"]').onclick = () => deleteSavedPlay(item.id, item.name);
    wrap.appendChild(card);
  });
}

function deleteSavedPlay(id, name) {
  const saved = getSavedPlays().filter(item => item.id !== id);
  setSavedPlays(saved);
  refreshSavedPlayList();
  setHint(`Deleted local save "${name}".`);
  refreshInteractionUI();
}

function exportPlayData(play) {
  let project;
  try {
    project = validateExportProject(normalizeProjectRecord(play) || makeBoardData());
  } catch {
    setHint('Export failed. The current play data could not be validated.');
    refreshInteractionUI();
    return;
  }
  const payload = buildCanonicalPlayEnvelope(project);
  buildExportDownload(project.name, payload);
  setHint(`Exported "${project.name}" as JSON.`);
  refreshInteractionUI();
  replaceRecoveryDraftWithCurrentBoard();
}

async function exportPDF() {
  updatePlayMetadataFromInputs();
  if (!window.jspdf?.jsPDF || typeof window.qrcode !== 'function') {
    setHint('PDF export is unavailable right now. Reload the board and try again.');
    refreshInteractionUI();
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, H = 210;
  const playName = document.getElementById('playName').value || 'Play';
  const noteFields = [
    ['PHASE PURPOSE', document.getElementById('metaPurpose')?.value?.trim() || ''],
    ['DECISION CUE', document.getElementById('metaDecisionCue')?.value?.trim() || ''],
    ['COACHING POINTS', readMetaList(['metaCoachingPoint1', 'metaCoachingPoint2', 'metaCoachingPoint3'], 3).join('\n')],
    ['COMMON MISTAKES', readMetaList(['metaCommonMistake1', 'metaCommonMistake2', 'metaCommonMistake3'], 3).join('\n')],
  ];

  doc.setFillColor(10, 19, 16);
  doc.rect(0, 0, W, H, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text('RDA TACTICAL BOARD', 14, 14);
  doc.setFontSize(14);
  doc.setTextColor(251, 191, 36);
  doc.text(playName, 14, 22);

  const imgData = cv.toDataURL('image/png');
  doc.addImage(imgData, 'PNG', 14, 28, 110, 155);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  let noteY = 32;
  noteFields.forEach(([label, val]) => {
    if (!val) return;
    doc.setTextColor(251, 191, 36);
    doc.setFontSize(8);
    doc.text(label, 135, noteY);
    noteY += 5;
    doc.setTextColor(220, 220, 220);
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(val, 75);
    doc.text(lines, 135, noteY);
    noteY += lines.length * 5 + 4;
  });

  const qr = qrcode(0, 'M');
  qr.addData(window.location.href);
  qr.make();
  const qrImg = qr.createDataURL(4);
  doc.addImage(qrImg, 'PNG', 255, 160, 30, 30);
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.text('Scan to open live board', 256, 194);

  doc.save(`${playName || 'play'}.pdf`);
  setHint(`Exported "${playName}" as PDF.`);
  refreshInteractionUI();
  replaceRecoveryDraftWithCurrentBoard();
}
window.exportPDF = exportPDF;

function exportCurrentPlay() {
  exportPlayData(makeBoardData());
}

function triggerImportPlay() {
  const input = document.getElementById('importPlayInput');
  if (input) input.click();
}

function importPlayFromFile(file) {
  clearPendingCanonicalPhaseStart();
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch {
        throw new Error('This file is not a valid Rugby GamePlan play.');
      }
      const importResult = prepareImportedProject(parsed);
      if (isMeaningfulBoardProject(makeBoardData())) {
        const message = 'Importing this play will replace the current board.';
        if (!window.confirm(message)) {
          setHint('Import cancelled.');
          refreshInteractionUI();
          return;
        }
      }
      applyImportedProject(importResult);
    } catch (err) {
      console.error('Import failed:', err);
      const message = typeof err?.message === 'string' && err.message
        ? err.message
        : 'This play could not be imported. Your current board was not changed.';
      setHint(message);
      refreshInteractionUI();
    }
  };
  reader.readAsText(file, 'utf-8');
}


document.addEventListener('keydown', e => {
  if (annotationEditableTarget(e.target)) return;
  const k = e.key.toLowerCase();
  const cmdOrCtrl = e.ctrlKey || e.metaKey;
  if (cmdOrCtrl && k === 'c' && selectedAnnotationId()) {
    if (copySelectedAnnotationToClipboard()) e.preventDefault();
    return;
  }
  if (cmdOrCtrl && k === 'v') {
    if (pasteAnnotationFromClipboard()) e.preventDefault();
    return;
  }
  if (cmdOrCtrl && k === 'd' && selectedAnnotationId()) {
    if (duplicateSelected()) e.preventDefault();
    return;
  }
  if (selectedAnnotationId() && (k === 'arrowleft' || k === 'arrowright' || k === 'arrowup' || k === 'arrowdown')) {
    const step = e.shiftKey ? ANNOTATION_NUDGE_STEP_LARGE : ANNOTATION_NUDGE_STEP;
    const dx = k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0;
    const dy = k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0;
    if (nudgeSelectedAnnotation(dx, dy)) {
      e.preventDefault();
      return;
    }
  }
  const map = {v:'move',r:'run',p:'pass',k:'kick',e:'erase',t:'tele',c:'zone',b:'box'};
  if (map[k])           { setTool(map[k]); return; }
  if (k===' ')          { e.preventDefault(); togglePlay(); return; }
  if (k === 'arrowleft') { e.preventDefault(); goToPhase(GamePlan.currentPhase - 1); return; }
  if (k === 'arrowright') { e.preventDefault(); goToPhase(GamePlan.currentPhase + 1); return; }
  if (k==='escape')     {
    e.preventDefault();
    if (!document.getElementById('playerNumberPopover')?.hidden) {
      closePlayerNumberPicker();
      return;
    }
    if (document.getElementById('mobileMoreDrawer')?.classList.contains('open')) {
      setMobileMoreDrawerOpen(false);
      return;
    }
    if (radialMenu) {
      closeRadialMenu();
      render();
      return;
    }
    cancelActiveBoardInteraction();
    return;
  }
  if (k==='z'&&cmdOrCtrl&&e.shiftKey) { e.preventDefault(); redo(); return; }
  if (k==='z'&&cmdOrCtrl) { e.preventDefault(); undo(); }
  if (k==='delete'||k==='backspace') {
    if (S.selectedPlayerId !== null || S.selectedGroupId !== null || isBallSelected() || selectedAnnotationId() || S.selectedPassIdx !== null || S.selectedPathPid !== null) {
      e.preventDefault();
      deleteSelected();
    }
  }
});

let trackDrag = false;
const _trackThumb = document.getElementById('trackThumb');
_trackThumb.addEventListener('pointerdown', e => {
  trackDrag = true;
  _trackThumb.setPointerCapture(e.pointerId);
});
_trackThumb.addEventListener('pointermove', e => {
  if (!trackDrag) return;
  const r = document.getElementById('track').getBoundingClientRect();
  const raw = clamp((e.clientX - r.left) / r.width, 0, 1);
  if (!S.animating && sequenceStepCount() > 1) {
    gotoStep(Math.round(raw * (sequenceStepCount() - 1)));
    return;
  }
  S.animT = raw;
  updateTL(); render();
});
_trackThumb.addEventListener('pointerup', () => trackDrag = false);
_trackThumb.addEventListener('pointercancel', () => trackDrag = false);
if (!supportsPointerEvents) {
  _trackThumb.addEventListener('touchstart', e => { e.preventDefault(); trackDrag = true; }, { passive: false });
  _trackThumb.addEventListener('touchmove', e => {
    if (!trackDrag) return;
    const ne = normEvent(e);
    const r = document.getElementById('track').getBoundingClientRect();
    const raw = clamp((ne.clientX - r.left) / r.width, 0, 1);
    if (!S.animating && sequenceStepCount() > 1) {
      gotoStep(Math.round(raw * (sequenceStepCount() - 1)));
      return;
    }
    S.animT = raw;
    updateTL(); render();
  }, { passive: false });
  _trackThumb.addEventListener('touchend',    () => trackDrag = false, { passive: false });
  _trackThumb.addEventListener('touchcancel', () => trackDrag = false, { passive: false });
}

//  INIT
GamePlan.phases = GamePlan.phases.map((phase, index) => normalizePhaseState(phase, index));
buildPlayList();
updatePresetOptionsUI();
rebuildPalette();
refreshSavedPlayList();
S.playMetadata = emptyPlayMetadata('New Play');
GamePlan.name = 'New Play';
GamePlan.currentPhase = 0;
S.steps = [emptyStepState()];
S.currentStep = 0;
firstUseTutorialDismissed = hasSeenFirstUseTutorial();
updateAnnotationPanel();
updatePhaseUI();
updatePlayMetadataPanel();
document.getElementById('playName').addEventListener('input', () => {
  GamePlan.name = currentPlayTitle();
  syncPlayMetadataTitle();
  syncMobileBoardNameInput();
  scheduleAutosave();
  refreshInteractionUI();
});
document.getElementById('mobilePlayNameInput')?.addEventListener('input', (e) => {
  const desktopInput = document.getElementById('playName');
  if (!desktopInput) return;
  if (desktopInput.value !== e.target.value) {
    desktopInput.value = e.target.value;
  }
  GamePlan.name = currentPlayTitle();
  syncPlayMetadataTitle();
  scheduleAutosave();
  refreshInteractionUI();
});
getAutosaveStatusElements().restoreBtn?.addEventListener('click', restoreRecoveryDraftFromPrompt);
getAutosaveStatusElements().discardBtn?.addEventListener('click', discardRecoveryDraftFromPrompt);
getAutosaveStatusElements().laterBtn?.addEventListener('click', () => hideRecoveryDraftPrompt({ deferForSession: true }));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushAutosaveOnPageHide();
});
window.addEventListener('pagehide', flushAutosaveOnPageHide);
window.addEventListener('beforeunload', flushAutosaveOnPageHide);
setAutosaveStatus('saved');
maybeOfferRecoveryDraftOnStartup();
window.serializePlay = serializePlay;
window.deserializePlay = deserializePlay;
window.migratePlay = migratePlay;

document.addEventListener('pointerdown', e => {
  if (!radialMenu) return;
  if (radialEventTargetsMenu(e)) return;
  const menu = document.getElementById('radialMenu');
  if (menu && !menu.contains(e.target)) {
    closeRadialMenu();
    render();
  }
});
document.addEventListener('pointerdown', (e) => {
  const popover = document.getElementById('playerNumberPopover');
  if (!popover || popover.hidden) return;
  const activeAnchor = playerNumberPickerState.anchorId ? document.getElementById(playerNumberPickerState.anchorId) : null;
  if (popover.contains(e.target) || activeAnchor?.contains(e.target)) return;
  closePlayerNumberPicker();
}, { capture: true });
window.addEventListener('resize', () => {
  if (document.getElementById('playerNumberPopover')?.hidden) return;
  positionPlayerNumberPicker();
});
document.addEventListener('scroll', () => {
  if (document.getElementById('playerNumberPopover')?.hidden) return;
  positionPlayerNumberPicker();
}, true);
document.getElementById('mobileMoreDrawer')?.addEventListener('click', (e) => {
  const actionBtn = e.target.closest('.mob-more-btn');
  if (!actionBtn || actionBtn.disabled) return;
  if (actionBtn.dataset.tool === 'arrow' || actionBtn.dataset.tool === 'zone') return;
  setTimeout(() => setMobileMoreDrawerOpen(false), 0);
});

// Tap-outside-to-close for the mobile More drawer, mirroring the existing
// mobileToolsDropdown outside-closer below. Intercepted at document capture
// phase on pointerdown, touchstart AND click - earlier than the canvas's own
// bubble-phase pointerdown handler and earlier than any bindSinglePhoneButton
// touchend handler - so the swallowed tap never reaches the pitch or another
// control underneath (no player move/select, no path draw, no other button,
// including a plain <a href> whose navigation is normally driven by the
// eventual click, not by pointerdown/touchstart). A single physical tap fires
// pointerdown, touchstart AND click as three separate events; the drawer is
// already closed by the first of them, so later ones re-check "was this
// gesture already swallowed" via a short time window rather than re-testing
// the (now-closed) drawer's live state, or their own preventDefault would be
// skipped and the underlying click would still fire.
let mobileMoreDrawerSwallowUntil = 0;
function handleMobileMoreDrawerOutsideTap(e) {
  const drawer = document.getElementById('mobileMoreDrawer');
  const moreBtn = document.getElementById('mobMoreBtn');
  const isOutsideOpenDrawer = !!drawer && drawer.classList.contains('open')
    && !drawer.contains(e.target) && !moreBtn?.contains(e.target);
  const withinSwallowWindow = Date.now() <= mobileMoreDrawerSwallowUntil;
  if (!isOutsideOpenDrawer && !withinSwallowWindow) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation?.();
  if (isOutsideOpenDrawer) {
    mobileMoreDrawerSwallowUntil = Date.now() + 500;
    setMobileMoreDrawerOpen(false);
  }
}
document.addEventListener('pointerdown', handleMobileMoreDrawerOutsideTap, { capture: true });
document.addEventListener('touchstart', handleMobileMoreDrawerOutsideTap, { capture: true, passive: false });
document.addEventListener('click', handleMobileMoreDrawerOutsideTap, { capture: true });

function bindSinglePhoneButton(id, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  let lastFireAt = -Infinity;
  const invoke = (e) => {
    if (!isPhoneViewport) return;
    const now = (typeof performance !== 'undefined' && Number.isFinite(performance.now())) ? performance.now() : Date.now();
    if (now - lastFireAt < PHONE_UI_ACTION_GUARD_MS) {
      e.preventDefault();
      e.stopImmediatePropagation?.();
      e.stopPropagation();
      return;
    }
    lastFireAt = now;
    e.preventDefault();
    e.stopImmediatePropagation?.();
    e.stopPropagation();
    handler();
  };

  el.style.touchAction = 'manipulation';
  el.addEventListener('touchend', invoke, { capture: true, passive: false });
  el.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') invoke(e);
  }, true);
  el.addEventListener('click', (e) => {
    if (!isPhoneViewport) return;
    e.preventDefault();
    e.stopImmediatePropagation?.();
    e.stopPropagation();
  }, true);
}

bindSinglePhoneButton('mobileRailAddAttackBtn', () => addNextAvailablePlayer('A'));
bindSinglePhoneButton('mobileRailAddDefenceBtn', () => addNextAvailablePlayer('D'));
bindSinglePhoneButton('mobileRailAddAttackPickerBtn', () => togglePlayerNumberPicker('A', 'mobileRailAddAttackPickerBtn'));
bindSinglePhoneButton('mobileRailAddDefencePickerBtn', () => togglePlayerNumberPicker('D', 'mobileRailAddDefencePickerBtn'));
bindSinglePhoneButton('mobileStepBtn', () => addStep());
bindSinglePhoneButton('mobileRailUndoBtn', () => undo());
bindSinglePhoneButton('mobMoreBtn', () => toggleMobileMoreDrawer());
// The top header chevrons step one canonical Move at a time (matching the
// "MOVE X/Y" half of the header label), sharing the same transport-interrupt
// behaviour as the desktop seq-bar Previous/Next: mid-playback they cancel and
// land on the transition's source/destination Move rather than stepping Phases.
bindSinglePhoneButton('mobilePhasePrevBtn', () => handleCanonicalPrevious());
bindSinglePhoneButton('mobilePhaseNextBtn', () => handleCanonicalNext());
bindSinglePhoneButton('mobilePhaseAddBtn', () => addPhaseAfterCurrent());
bindSinglePhoneButton('mobilePhaseDeleteBtn', () => deleteCurrentPhaseWithConfirm());
bindSinglePhoneButton('mobileMoveDeleteBtn', () => deleteLastMoveWithConfirm());

let lastPhoneUiActivation = { key: '', target: null, at: -Infinity };
document.addEventListener('click', (e) => {
  if (!isPhoneViewport) return;
  const actionEl = e.target.closest('#topbar button, #bottomPanel button, #mobileBoardMenu button, #mobileNotesSheet button, #playerSelector button');
  if (!actionEl) return;
  const key = actionEl.id || actionEl.dataset.tool || actionEl.getAttribute('onclick') || actionEl.textContent.trim();
  const at = Number.isFinite(e.timeStamp) ? e.timeStamp : performance.now();
  const isDuplicate = lastPhoneUiActivation.key === key &&
    lastPhoneUiActivation.target === actionEl &&
    (at - lastPhoneUiActivation.at) < 450;
  if (isDuplicate) {
    e.preventDefault();
    e.stopImmediatePropagation?.();
    e.stopPropagation();
    return;
  }
  lastPhoneUiActivation = { key, target: actionEl, at };
}, true);
[
  'metaPurpose',
  'metaCoachingPoint1',
  'metaCoachingPoint2',
  'metaCoachingPoint3',
  'metaDecisionCue',
  'metaCommonMistake1',
  'metaCommonMistake2',
  'metaCommonMistake3',
].forEach(id => {
  document.getElementById(id).addEventListener('input', updatePlayMetadataFromInputs);
});
document.getElementById('selNoteInput').addEventListener('input', e => updateSelectedNoteText(e.target.value));
document.getElementById('selNoteInput').addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const ann = selectedAnnotation();
    if (ann?.type === 'note') {
      e.target.value = String(ann.text ?? '');
    }
    e.target.blur();
  }
});
document.getElementById('noteInlineEditor').addEventListener('input', e => {
  updateSelectedNoteText(e.target.value);
  const ann = selectedAnnotation();
  if (ann?.type === 'note' && e.target.value !== ann.text) {
    e.target.value = ann.text;
  }
  syncNoteInlineEditor();
});
document.getElementById('noteInlineEditor').addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    e.preventDefault();
    endNoteInlineEdit();
    refreshInteractionUI();
    render();
  }
});
document.getElementById('importPlayInput').addEventListener('change', e => {
  importPlayFromFile(e.target.files?.[0]);
  e.target.value = '';
});
document.getElementById('spKickStep1')?.addEventListener('click', e => {
  e.preventDefault();
  if (S.tool === 'kick') cancelArmedKick();
});

// ── App bootstrap ────────────────────────────────────────────────────────
let _boardBootstrapped = false;
function _initBoard() {
  if (_boardBootstrapped) return;
  _boardBootstrapped = true;
  initSequenceBarNavigator();
  initSequenceControlDock();
  bindViewportObservers();
  resize();
  ensureSteps();
  currentPresetId = null;
  GamePlan.name = 'New Play';
  GamePlan.currentPhase = 0;
  document.getElementById('playName').value = 'New Play';
  setLiveBoardFromStep(emptyStepState());
  render();
  refreshInteractionUI();
  updateBoardStatus();
  updateSequenceUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initBoard);
} else {
  // Script loaded after DOM is ready (defer/bottom of body)
  requestAnimationFrame(() => {
    _initBoard();
  });
}

(function initAccordions() {
  const isPhone = document.body.classList.contains('is-phone');
  ['accPresets', 'accCoachNotes', 'accPurpose', 'accDecision', 'accCoaching', 'accMistakes'].forEach(function(id) {
    var section = document.getElementById(id);
    if (!section) return;
    section.classList.remove('sp-acc-open');
    var trigger = section.querySelector(':scope > .sp-acc-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  });
  if (isPhone) {
    ['accPresets', 'accCoachNotes'].forEach(function(id) {
      var section = document.getElementById(id);
      if (!section) return;
      section.classList.add('sp-acc-open');
      var trigger = section.querySelector(':scope > .sp-acc-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'true');
    });
  }
})();

document.addEventListener('pointerdown', e => {
  const dropdown = document.getElementById('mobileToolsDropdown');
  const btn = document.getElementById('mobileToolsBtn');
  if (!dropdown || !dropdown.classList.contains('is-open')) return;
  if (!dropdown.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
    closeMobileToolsDropdown();
  }
}, { capture: true });

window.goToPhase = goToPhase;
window.addPhase = addPhase;
