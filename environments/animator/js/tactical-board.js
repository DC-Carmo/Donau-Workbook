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
const BALL_CARRY_OFFSET = { x: 1.45, y: -1.05 };
const MOBILE_TAP_TOGGLE_PX = 5;
const SNAP_RADIUS = 4; // field units (~4m)
let GAINLINE_Y = 50;      // default: halfway
let showGainline = true;
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
const FIELD_X_STRETCH = 1.7;
let cvW=0, cvH=0, sc=1, sx=1, sy=1, ox=0, oy=0;
const cv  = document.getElementById('field');

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
const ctx = cv.getContext('2d');

function toC(fx, fy) { return { x: ox + (fx - F.DX0) * sx, y: oy + (fy - F.DY0) * sy }; }
function frC(cx, cy) { return { x: (cx - ox) / sx + F.DX0, y: (cy - oy) / sy + F.DY0 }; }
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
  el.textContent = dist === 0 ? 'On gainline' : `${sign}${dist}m`;
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

  const ACTIONS = [
    { label: 'Run', icon: '→', tool: 'run' },
    { label: 'Pass', icon: '~', tool: 'pass' },
    { label: 'Kick', icon: '⬆', tool: 'kick' },
    { label: 'Ball', icon: '●', fn: () => giveBall(radialMenu.playerId) },
    { label: 'Remove', icon: '✕', fn: () => { snapshot(); removePlayer(radialMenu.playerId); }, danger: true },
  ];

  const radius = 52;
  ACTIONS.forEach((action, index) => {
    const angle = (-Math.PI / 2) + (index * (Math.PI * 2 / ACTIONS.length));
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `radial-btn${action.danger ? ' danger' : ''}`;
    btn.style.left = `${center.x + Math.cos(angle) * radius}px`;
    btn.style.top = `${center.y + Math.sin(angle) * radius}px`;
    btn.innerHTML = `<span>${action.icon}</span><span>${action.label}</span>`;
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (radialMenu?.playerId) selectPlayer(radialMenu.playerId);
      if (action.tool) setTool(action.tool);
      if (action.fn) action.fn();
      closeRadialMenu();
    });
    menu.appendChild(btn);
  });
}

function showRadial(pl, canvasX, canvasY) {
  radialMenu = { playerId: pl.id, x: canvasX, y: canvasY };
  renderRadialMenu();
}

function resize() {
  const wrap = document.getElementById('canvasWrap');
  cvW = cv.clientWidth || wrap.clientWidth;
  cvH = cv.clientHeight || wrap.clientHeight;
  cv.width = cvW; cv.height = cvH;
  const padX = Math.max(6, Math.min(12, cvW * 0.008));
  const padY = Math.max(8, Math.min(14, cvH * 0.01));
  const baseFromWidth = (cvW - padX * 2) / (FVW * FIELD_X_STRETCH);
  const baseFromHeight = (cvH - padY * 2) / FVH;
  sc = Math.min(baseFromWidth, baseFromHeight);
  sx = sc * FIELD_X_STRETCH;
  sy = sc;
  ox = (cvW - FVW * sx) / 2;
  oy = (cvH - FVH * sy) / 2;
  updateMobileUI();
  render();
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
  // Selection model:
  // - selectedPlayerId: one player selected for editing at a time
  // - selectedObjectType/selectedAnnotationIdValue: non-player object selection
  // - activePasserId/activeKickerId: pass/kick workflow only
  // - highlightedPlayerIds: temporary workflow highlights only
  // S.selected and S.passFrom remain compatibility mirrors for older UI helpers.
  selected: null,
  selectedPlayerId: null,
  selectedPlayerIds: [],
  selectedGroupId: null,
  selectedObjectType: null,
  selectedAnnotationIdValue: null,
  dragPlayerId: null,
  dragging: null,       // { type:'player'|'group'|'ball', id? }
  dragOff: { x:0, y:0 },
  drawing: null,        // { pid, pts:[], last:{x,y} }
  passFrom: null,
  activePasserId: null,
  activeKickerId: null,
  highlightedPlayerIds: [],
  pendingGroupPlacement: null,
  history: [],          // undo stack (snapshots)
  future: [],           // redo stack
  animT: 0,
  animating: false,
  animSpd: 1,
  raf: null,
  lastTs: null,
  nextId: 1,
  ballAssignCandidate: null,
  pointerTap: null,
  selectedPassIdx: null,
  selectedPathPid: null,
});
const SPEEDS = [0.25, 0.5, 1, 2];
let   spdIdx = 2;
function fmtSpd(v) { return v===0.25?'¼×':v===0.5?'½×':v+'×'; }
const SAVED_PLAYS_KEY = 'coachmato.animator.savedPlays.v1';
const FIRST_USE_TUTORIAL_KEY = 'coachmato.animator.firstUseTutorial.v1';
const PROJECT_SCHEMA_VERSION = 4;
const PROJECT_TYPE = 'coachmato.animator.project';
const PLAYBACK_TIMELINE_MODEL = 'global_progress_v1';
const DEFAULT_PLAYBACK_DURATION = 5;
const ANNOTATION_NOTE_DEFAULT = 'Note';
const NOTE_FONT = '"Barlow Condensed"';
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
  return window.innerWidth <= 768;
}

function hasSeenFirstUseTutorial() {
  try {
    return localStorage.getItem(FIRST_USE_TUTORIAL_KEY) === '1';
  } catch {
    return false;
  }
}

function markFirstUseTutorialSeen() {
  firstUseTutorialDismissed = true;
  try {
    localStorage.setItem(FIRST_USE_TUTORIAL_KEY, '1');
  } catch {}
}

function shouldShowFirstUseTutorial() {
  return !firstUseTutorialDismissed && !S.players.length && !S.ball && !S.annotations.length;
}

function dismissFirstUseTutorial() {
  markFirstUseTutorialSeen();
  updateBoardStatus();
}

function completeFirstUseTutorial() {
  if (firstUseTutorialDismissed) return;
  markFirstUseTutorialSeen();
  updateBoardStatus();
}

window.dismissFirstUseTutorial = dismissFirstUseTutorial;

const R = () => {
  const base = Math.max(15, Math.min(24, sc * 1.8));
  return isMobileBoardViewport() ? base * 0.88 : base;
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
  return players
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
  GamePlan.phases[GamePlan.currentPhase] = normalizePhaseState(serializePhase(S(), GamePlan.currentPhase), GamePlan.currentPhase);
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
  syncLegacySelectionState();
  if (S.ballAttached && S.ballOwner) syncAttachedBallToOwner();
  else if (S.ball && !S.ballOwner) updateBallOwnerFromPosition();
  else applyBallOwnershipVisualState();
}

function goToPhase(idx) {
  persistCurrentPhase();
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
  render();
}

function updatePhaseUI() {
  const total = GamePlan.phases.length;
  const cur = GamePlan.currentPhase;
  const label = document.getElementById('phaseLabel');
  const prev = document.getElementById('phasePrev');
  const next = document.getElementById('phaseNext');
  if (label) label.textContent = `${GamePlan.phases[cur]?.label || `Phase ${cur + 1}`} / ${total}`;
  if (prev) prev.disabled = cur === 0;
  if (next) next.disabled = cur === total - 1;
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
  if (finalPass && finalPass.toT !== undefined && finalPass.toNum !== undefined) {
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
  };
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
    live.x = start.x + dx;
    live.y = start.y + dy;
    const path = S.paths.find(pathItem => pathItem.pid === live.id);
    if (path && path.pts.length) path.pts[0] = { x: live.x, y: live.y };
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
  S.selectedPlayerId = null;
  S.selectedPlayerIds = [];
  clearSelectedGroup();
  clearPendingGroupPlacement();
  S.selectedAnnotationIdValue = id;
  S.selectedObjectType = 'annotation';
  S.selectedPassIdx = null;
  S.selectedPathPid = null;
  clearHighlightedPlayers();
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

function defaultAnnotationText() {
  const input = document.getElementById('annotationText');
  const txt = input?.value?.trim();
  return txt || ANNOTATION_NOTE_DEFAULT;
}

function annotationColor(type) {
  if (type === 'zone') return '#10b981';
  if (type === 'box') return '#d9b46c';
  if (type === 'arrow') return '#d9b46c';
  return '#f3f4f6';
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
      text: String(annotation.text || ANNOTATION_NOTE_DEFAULT).slice(0, 48),
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
    desc: 'Lineout pods load horizontally across the field and stay editable after setup.',
    defaultGroupId: attacking ? 'atk_lineout_pack' : 'def_lineout_pack',
    focusTeam: attacking ? 'A' : 'D',
    players: [
      ...lineoutChain('A', count, 8, 84),
      ...attackLineoutSupport(84),
      ...lineoutChain('D', count, 10, 80),
      ...defenceLineoutSupport(80),
    ],
    groups: [
      makeGroup('atk_lineout_pack', count === 5 ? 'Attack 5-Man Lineout' : 'Attack 7-Man Lineout', 'A', nums, PRESET_GROUP_ATTACK),
      makeGroup('def_lineout_pack', count === 5 ? 'Defence 5-Man Lineout' : 'Defence 7-Man Lineout', 'D', nums, PRESET_GROUP_DEFENCE),
    ],
  };
}

const PLAYS = [
  scrumPreset('scrum_left', 'Scrum Left Launch', 'Scrum Left', 18, 'left'),
  scrumPreset('scrum_centre', 'Scrum Centre Launch', 'Scrum Centre', 34, 'centre'),
  scrumPreset('scrum_right', 'Scrum Right Launch', 'Scrum Right', 50, 'right'),
  scrumAttackFivePreset(),
  lineoutDefenceFivePreset(),
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
  btn.textContent = presetShowOpposition ? 'Opposition: On' : 'Opposition: Off';
  btn.classList.toggle('sp-btn-accent', presetShowOpposition);
}

function togglePresetOpposition() {
  presetShowOpposition = !presetShowOpposition;
  updatePresetOptionsUI();
  if (currentPresetId) {
    loadPlay(currentPresetId);
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
    const label = document.createElement('div');
    label.className = 'play-category-label';
    label.textContent = cat;
    c.appendChild(label);
    plays.forEach(play => {
      const btn = document.createElement('button');
      btn.className = 'play-preset-btn';
      btn.innerHTML = `<div class="play-preset-name">${play.name}</div><div class="play-preset-copy">${play.desc || 'Load a clean coaching picture.'}</div>`;
      btn.onclick = () => loadPlay(play.id);
      c.appendChild(btn);
    });
  });
}

function loadPlay(id) {
  const play = PLAYS.find(p => p.id === id);
  if (!play) return;
  closeRadialMenu();
  if (applyBoardData(presetToProject(play))) {
    currentPresetId = play.id;
    updatePresetOptionsUI();
    const defaultGroup = S.groups.find(group => group.id === play.defaultGroupId) || null;
    if (defaultGroup) selectGroup(defaultGroup.id);
    document.getElementById('playName').value = play.name;
    syncPlayMetadataTitle();
    setHint(defaultGroup
      ? `Loaded preset "${play.name}". Click the pack, then click again to place it, or unlock it for individual edits.`
      : `Loaded preset "${play.name}".`);
    refreshInteractionUI();
  }
}

function currentPlayTitle() {
  return document.getElementById('playName').value.trim() || 'Untitled Play';
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
    S.highlightedPlayerIds = [];
    S.pendingGroupPlacement = null;
    S.annotationDraft = null;
    S.ballAssignCandidate = null;
    S.pointerTap = null;
    S.animT = 0;
    S.animating = false;
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
  S.highlightedPlayerIds = [];
  S.pendingGroupPlacement = null;
  S.annotationDraft = null;
  S.ballAssignCandidate = null;
  S.pointerTap = null;
  S.animT = 0;
  S.animating = false;
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

function snapshot() {
  persistCurrentPhase();
  S.history.push(cloneData({
    phaseIdx: GamePlan.currentPhase,
    phase: serializePhase(S(), GamePlan.currentPhase),
    gamePlanName: GamePlan.name,
    playMetadata: S.playMetadata,
    projectId: S.projectId,
    projectMeta: S.projectMeta,
    projectPlayback: S.projectPlayback,
  }));
  if (S.history.length > 30) S.history.shift();
  S.future = [];
}
function undo() {
  if (!S.history.length) return;
  persistCurrentPhase();
  S.future.push(cloneData({
    phaseIdx: GamePlan.currentPhase,
    phase: serializePhase(S(), GamePlan.currentPhase),
    gamePlanName: GamePlan.name,
    playMetadata: S.playMetadata,
    projectId: S.projectId,
    projectMeta: S.projectMeta,
    projectPlayback: S.projectPlayback,
  }));
  if (S.future.length > 30) S.future.shift();
  const h = S.history.pop();
  GamePlan.name = h.gamePlanName || GamePlan.name;
  GamePlan.currentPhase = clamp(Number.isFinite(h.phaseIdx) ? h.phaseIdx : GamePlan.currentPhase, 0, Math.max(0, GamePlan.phases.length - 1));
  while (GamePlan.phases.length <= GamePlan.currentPhase) {
    GamePlan.phases.push(normalizePhaseState({ label: `Phase ${GamePlan.phases.length + 1}` }, GamePlan.phases.length));
  }
  GamePlan.phases[GamePlan.currentPhase] = normalizePhaseState(h.phase, GamePlan.currentPhase);
  const phase = GamePlan.phases[GamePlan.currentPhase];
  setLiveBoardFromStep(phase.steps[phase.currentStep] || emptyStepState());
  document.getElementById('playName').value = GamePlan.name || 'Untitled Play';
  S.playMetadata = normalizeProjectMetadata({ name: GamePlan.name || 'Untitled Play' }, h.playMetadata || {});
  S.projectId = h.projectId || null;
  S.projectMeta = h.projectMeta || null;
  S.projectPlayback = normalizePlaybackSettings(h.projectPlayback || {});
  clearSelectedObject();
  clearPassKickState();
  updatePlayMetadataPanel();
  updatePhaseUI();
  rebuildPalette(); refreshInteractionUI();
  render();
}
function redo() {
  if (!S.future.length) return;
  persistCurrentPhase();
  S.history.push(cloneData({
    phaseIdx: GamePlan.currentPhase,
    phase: serializePhase(S(), GamePlan.currentPhase),
    gamePlanName: GamePlan.name,
    playMetadata: S.playMetadata,
    projectId: S.projectId,
    projectMeta: S.projectMeta,
    projectPlayback: S.projectPlayback,
  }));
  if (S.history.length > 30) S.history.shift();
  const h = S.future.pop();
  GamePlan.name = h.gamePlanName || GamePlan.name;
  GamePlan.currentPhase = clamp(Number.isFinite(h.phaseIdx) ? h.phaseIdx : GamePlan.currentPhase, 0, Math.max(0, GamePlan.phases.length - 1));
  while (GamePlan.phases.length <= GamePlan.currentPhase) {
    GamePlan.phases.push(normalizePhaseState({ label: `Phase ${GamePlan.phases.length + 1}` }, GamePlan.phases.length));
  }
  GamePlan.phases[GamePlan.currentPhase] = normalizePhaseState(h.phase, GamePlan.currentPhase);
  const phase = GamePlan.phases[GamePlan.currentPhase];
  setLiveBoardFromStep(phase.steps[phase.currentStep] || emptyStepState());
  document.getElementById('playName').value = GamePlan.name || 'Untitled Play';
  S.playMetadata = normalizeProjectMetadata({ name: GamePlan.name || 'Untitled Play' }, h.playMetadata || {});
  S.projectId = h.projectId || null;
  S.projectMeta = h.projectMeta || null;
  S.projectPlayback = normalizePlaybackSettings(h.projectPlayback || {});
  clearSelectedObject();
  clearPassKickState();
  updatePlayMetadataPanel();
  updatePhaseUI();
  rebuildPalette(); refreshInteractionUI();
  render();
}
window.redo = redo;

//  FIELD RENDERING
function drawField() {
  ctx.clearRect(0, 0, cvW, cvH);

  // ── 1. Background ────────────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, 0, cvH);
  bgGrad.addColorStop(0, '#060d16');
  bgGrad.addColorStop(1, '#091420');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, cvW, cvH);

  const TL = toC(0, F.YMIN), BR = toC(F.W, F.YMAX);
  const FW = BR.x - TL.x, FH = BR.y - TL.y;
  const GL_TOP = toC(0, 0), GL_BOT = toC(F.W, 100);

  // ── 2. Field drop shadow ─────────────────────────────────────────────────
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 28;
  ctx.fillStyle = 'rgba(0,0,0,0.01)';
  ctx.fillRect(TL.x, TL.y, FW, FH);
  ctx.restore();

  // ── 3. Base grass — radial centre-bright ─────────────────────────────────
  const grassGrad = ctx.createRadialGradient(
    TL.x + FW * 0.5, TL.y + FH * 0.5, FH * 0.04,
    TL.x + FW * 0.5, TL.y + FH * 0.5, FH * 0.76
  );
  grassGrad.addColorStop(0,    '#3D9326');
  grassGrad.addColorStop(0.38, '#388C21');
  grassGrad.addColorStop(1,    '#287016');
  ctx.fillStyle = grassGrad;
  ctx.fillRect(TL.x, TL.y, FW, FH);

  // ── 4. Mow stripes — 16 crisp bands, more contrast ──────────────────────
  const N_STRIPES = 16;
  const bandW = FW / N_STRIPES;
  ctx.save();
  ctx.beginPath(); ctx.rect(TL.x, TL.y, FW, FH); ctx.clip();
  for (let si = 0; si < N_STRIPES; si++) {
    const bx = TL.x + si * bandW;
    const sg = ctx.createLinearGradient(bx, 0, bx + bandW, 0);
    if (si % 2 === 0) {
      sg.addColorStop(0,    'rgba(255,255,255,0.000)');
      sg.addColorStop(0.28, 'rgba(255,255,255,0.062)');
      sg.addColorStop(0.72, 'rgba(255,255,255,0.062)');
      sg.addColorStop(1,    'rgba(255,255,255,0.000)');
    } else {
      sg.addColorStop(0,    'rgba(0,0,0,0.000)');
      sg.addColorStop(0.28, 'rgba(0,0,0,0.068)');
      sg.addColorStop(0.72, 'rgba(0,0,0,0.068)');
      sg.addColorStop(1,    'rgba(0,0,0,0.000)');
    }
    ctx.fillStyle = sg;
    ctx.fillRect(bx, TL.y, bandW, FH);
  }
  ctx.restore();

  // ── 5. Noise texture ─────────────────────────────────────────────────────
  const tile = getGrassTile();
  if (tile) {
    const pat = ctx.createPattern(tile, 'repeat');
    if (pat) {
      ctx.save();
      ctx.globalAlpha = 0.055;
      ctx.beginPath(); ctx.rect(TL.x, TL.y, FW, FH); ctx.clip();
      ctx.fillStyle = pat;
      ctx.fillRect(TL.x, TL.y, FW, FH);
      ctx.restore();
    }
  }

  // ── 6. In-goal areas — darker overlay for visual separation ──────────────
  const igH_top = GL_TOP.y - TL.y;
  const igH_bot = BR.y - GL_BOT.y;
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(TL.x, TL.y, FW, igH_top);
  ctx.fillRect(GL_BOT.x, GL_BOT.y, FW, igH_bot);

  // ── 7. Vignette ──────────────────────────────────────────────────────────
  const vig = ctx.createRadialGradient(
    TL.x + FW * 0.5, TL.y + FH * 0.5, Math.min(FW, FH) * 0.26,
    TL.x + FW * 0.5, TL.y + FH * 0.5, Math.max(FW, FH) * 0.78
  );
  vig.addColorStop(0, 'rgba(0,0,0,0.00)');
  vig.addColorStop(1, 'rgba(0,0,0,0.20)');
  ctx.fillStyle = vig;
  ctx.fillRect(TL.x, TL.y, FW, FH);

  // ── 8. Line helpers — pixel-aligned for crisp rendering ──────────────────
  function hline(fy, color, lw, dash = [], x0 = 0, x1 = F.W, glow = 0) {
    const p = toC(x0, fy), q = toC(x1, fy);
    const py = Math.round(p.y) + 0.5;
    ctx.save();
    if (glow > 0) { ctx.shadowColor = `rgba(255,255,255,${glow})`; ctx.shadowBlur = 5; }
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    if (dash.length) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(Math.round(p.x), py);
    ctx.lineTo(Math.round(q.x), py);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function vline(fx, color, lw, fy0 = F.YMIN, fy1 = F.YMAX, dash = [], glow = 0) {
    const p = toC(fx, fy0), q = toC(fx, fy1);
    const px = Math.round(p.x) + 0.5;
    ctx.save();
    if (glow > 0) { ctx.shadowColor = `rgba(255,255,255,${glow})`; ctx.shadowBlur = 5; }
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    if (dash.length) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(px, Math.round(p.y));
    ctx.lineTo(px, Math.round(q.y));
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
    const top = toC(0, F.YMIN);
    ctx.fillStyle = 'rgba(34,197,94,0.07)';
    ctx.fillRect(p0.x, top.y, p1.x - p0.x, p0.y - top.y);

    const bot = toC(68, F.YMAX);
    ctx.fillStyle = 'rgba(239,68,68,0.07)';
    ctx.fillRect(p0.x, p0.y, p1.x - p0.x, bot.y - p0.y);

    ctx.save();
    ctx.strokeStyle = 'rgba(251,191,36,0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([sc * 1.2, sc * 0.6]);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
    ctx.stroke(); ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(251,191,36,0.8)';
    ctx.font = `bold ${Math.max(9, sc * 0.75)}px "Barlow Condensed"`;
    ctx.textAlign = 'right';
    ctx.fillText('GAINLINE', toC(67, GAINLINE_Y).x, p0.y - 4);
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
      const px = Math.round(toC(fx, 0).x) + 0.5;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth   = lw;
      ctx.lineCap     = 'butt';
      ctx.setLineDash([dashPx, gapPx]);
      for (let i = 0; i < ANCHORS.length - 1; i++) {
        const y0 = Math.round(toC(fx, ANCHORS[i]).y);
        const y1 = Math.round(toC(fx, ANCHORS[i + 1]).y);
        // Center a dash exactly at y0 (the anchor intersection)
        ctx.lineDashOffset = -dashPx / 2;
        ctx.beginPath();
        ctx.moveTo(px, y0);
        ctx.lineTo(px, y1);
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
  fieldLabel(34, -5,  'IN-GOAL', 0.48);
  fieldLabel(34, 105, 'IN-GOAL', 0.48);

  // ── 16. Goal posts ────────────────────────────────────────────────────────
  drawPosts(34, 0, 'top');
  drawPosts(34, 100, 'bot');
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
  const r = R();
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
  const cpx  = (p1.x+p2.x)/2 - (p2.y-p1.y)*0.28;
  const cpy  = (p1.y+p2.y)/2 + (p2.x-p1.x)*0.28;
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
  const fontSize = Math.max(11, sc * 1.25);
  ctx.save();
  ctx.font = `700 ${fontSize}px ${NOTE_FONT}`;
  const width = Math.max(sc * 5.2, ctx.measureText(note.text || ANNOTATION_NOTE_DEFAULT).width + 18);
  ctx.restore();
  return { fontSize, width, height: fontSize + 12 };
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
  const left = Math.min(box.x, box.x + box.w);
  const right = Math.max(box.x, box.x + box.w);
  const top = Math.min(box.y, box.y + box.h);
  const bottom = Math.max(box.y, box.y + box.h);
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1.5, right - left),
    height: Math.max(1.5, bottom - top),
  };
}

function boxAnnotationCorners(box) {
  const bounds = boxAnnotationBounds(box);
  return {
    nw: { x: bounds.left, y: bounds.top },
    ne: { x: bounds.right, y: bounds.top },
    sw: { x: bounds.left, y: bounds.bottom },
    se: { x: bounds.right, y: bounds.bottom },
  };
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
  const width = Math.max(1.5, Math.abs(box.w));
  const height = Math.max(1.5, Math.abs(box.h));
  const x = clamp(box.x, F.XMIN, F.XMAX - width);
  const y = clamp(box.y, F.YMIN, F.YMAX - height);
  box.x = x;
  box.y = y;
  box.w = Math.min(width, F.XMAX - x);
  box.h = Math.min(height, F.YMAX - y);
  return box;
}

function drawNoteAnnotation(note, selected = false) {
  const p = toC(note.x, note.y);
  const box = noteMetrics(note);
  const width = box.width;
  const height = box.height;
  const opacity = Number(note.opacity) || 1;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = 'rgba(3,8,14,0.82)';
  roundRect(ctx, p.x - width / 2, p.y - height / 2, width, height, 12);
  ctx.fill();
  ctx.restore();

  ctx.save();
  if (selected) {
    ctx.shadowColor = 'rgba(251,191,36,0.22)';
    ctx.shadowBlur = 18;
  }
  ctx.strokeStyle = selected ? '#fbbf24' : (note.color || 'rgba(217,180,108,0.68)');
  ctx.lineWidth = selected ? 2 : 1.2;
  roundRect(ctx, p.x - width / 2, p.y - height / 2, width, height, 12);
  ctx.stroke();
  ctx.fillStyle = '#f7fafc';
  ctx.font = `700 ${box.fontSize}px ${NOTE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(note.text || ANNOTATION_NOTE_DEFAULT, p.x, p.y + 0.5);
  ctx.restore();

  if (selected) {
    ctx.save();
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#0b1420';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawArrowAnnotation(arrow, selected = false, preview = false) {
  const color = preview ? 'rgba(217,180,108,0.72)' : (arrow.color || annotationColor('arrow'));
  const opacity = preview ? 1 : (Number(arrow.opacity) || 1);
  const start = toC(arrow.start.x, arrow.start.y);
  const end = toC(arrow.end.x, arrow.end.y);
  const ang = Math.atan2(end.y - start.y, end.x - start.x);
  const head = Math.max(9, sc * 1.6);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = 'rgba(7,16,24,0.46)';
  ctx.lineWidth = 5.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.restore();

  if (selected) {
    ctx.save();
    ctx.strokeStyle = 'rgba(251,191,36,0.42)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = preview ? 2.6 : 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

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
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = preview ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.14)';
  ctx.strokeStyle = selected ? '#fbbf24' : (zone.color || annotationColor('zone'));
  ctx.lineWidth = selected ? 2.4 : 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
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
  const bounds = boxAnnotationBounds(box);
  const topLeft = toC(bounds.left, bounds.top);
  const bottomRight = toC(bounds.right, bounds.bottom);
  const width = bottomRight.x - topLeft.x;
  const height = bottomRight.y - topLeft.y;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = preview ? 'rgba(217,180,108,0.09)' : 'rgba(217,180,108,0.13)';
  ctx.strokeStyle = selected ? '#fbbf24' : (box.color || annotationColor('box'));
  ctx.lineWidth = selected ? 2.4 : 2;
  roundRect(ctx, topLeft.x, topLeft.y, width, height, 14);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  if (selected) {
    const corners = boxAnnotationCorners(box);
    ctx.save();
    ctx.strokeStyle = 'rgba(251,191,36,0.24)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    roundRect(ctx, topLeft.x - 4, topLeft.y - 4, width + 8, height + 8, 16);
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
  }
}

function renderAnnotations(layer, annotations = S.annotations) {
  annotations.forEach(annotation => {
    const selected = annotations === S.annotations && selectedAnnotationId() === annotation.id;
    if (layer === 'zones' && annotation.type === 'zone') drawZoneAnnotation(annotation, selected);
    if (layer === 'zones' && annotation.type === 'box') drawBoxAnnotation(annotation, selected);
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
    frame.players.forEach(pl => drawPlayer(pl.x, pl.y, pl.num, pl.team, false, samePlayerRef(playerRef(pl), frame.ballOwner), playerColorPalette(pl)));
    if (frame.ball) drawBall(frame.ball.x, frame.ball.y, false);
    frame.players.forEach(pl => {
      if (samePlayerRef(playerRef(pl), frame.ballOwner)) drawBallCarrierHighlight(pl.x, pl.y);
    });
    renderAnnotations('notes', frame.annotations);
    closeRadialMenu();
    return;
  }

  const t = S.animT;
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

  S.players.forEach(pl => {
    const pos = animPos(pl, t);
    const sel = isPlayerSelected(pl.id);
    drawPlayer(pos.x, pos.y, pl.num, pl.team, sel, pl.isBC, playerColorPalette(pl));
  });
  if (S.ball) {
    drawBall(S.ball.x, S.ball.y, isBallSelected());
  }
  S.players.forEach(pl => {
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
      const box = noteMetrics(ann);
      const halfW = (box.width / sc) / 2 + 0.8;
      const halfH = (box.height / sc) / 2 + 0.8;
      if (Math.abs(fp.x - ann.x) <= halfW && Math.abs(fp.y - ann.y) <= halfH) {
        return { id: ann.id, part: 'move' };
      }
    }
    if (ann.type === 'arrow') {
      if (d2(fp, ann.start) <= 2.8) return { id: ann.id, part: 'start' };
      if (d2(fp, ann.end) <= 2.8) return { id: ann.id, part: 'end' };
      if (pointSegDist(fp, ann.start, ann.end) <= 2.4) return { id: ann.id, part: 'move' };
    }
    if (ann.type === 'zone') {
      const handle = { x: ann.x + ann.r, y: ann.y };
      const center = { x: ann.x, y: ann.y };
      if (d2(fp, handle) <= 2.8) return { id: ann.id, part: 'radius' };
      if (d2(fp, center) <= ann.r + 1.1) return { id: ann.id, part: 'move' };
    }
    if (ann.type === 'box') {
      const bounds = boxAnnotationBounds(ann);
      const corners = boxAnnotationCorners(ann);
      if (d2(fp, corners.nw) <= 2.8) return { id: ann.id, part: 'nw' };
      if (d2(fp, corners.ne) <= 2.8) return { id: ann.id, part: 'ne' };
      if (d2(fp, corners.sw) <= 2.8) return { id: ann.id, part: 'sw' };
      if (d2(fp, corners.se) <= 2.8) return { id: ann.id, part: 'se' };
      if (
        fp.x >= bounds.left - 0.8 && fp.x <= bounds.right + 0.8 &&
        fp.y >= bounds.top - 0.8 && fp.y <= bounds.bottom + 0.8
      ) {
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

function handlePointerDown(e) {
  const fp = getF(e);
  const clampedFieldPoint = clampFieldPoint(fp);
  const canvasPoint = getPx(e);

  if (S.tool === 'move') {
    const pl = hitPlayer(fp);
    const ballHit = !pl && hitBall(fp);
    const annHit = !pl && !ballHit ? hitAnnotation(fp) : null;
    const clickedPendingMember = pl && S.pendingGroupPlacement
      ? S.pendingGroupPlacement.startPositions?.some(member => member.id === pl.id)
      : false;
    if (S.pendingGroupPlacement && !clickedPendingMember && !annHit) {
      snapshot();
      placeGroupAtPoint(S.pendingGroupPlacement, clampedFieldPoint);
      const group = selectedGroup() || S.groups.find(item => item.id === S.pendingGroupPlacement?.id) || null;
      clearPendingGroupPlacement();
      updateBallOwnerFromPosition();
      setHint(group ? `${group.label} placed. Click the pack again to reposition it.` : 'Pack placed.');
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
      snapshot();
      clearDragPlayer();
      clearPassKickState();
      selectAnnotationById(annHit.id);
      S.ballAssignCandidate = null;
      const ann = findAnnotationById(annHit.id);
      const dragOff = ann && (ann.type === 'note' || ann.type === 'zone' || ann.type === 'box')
        ? { x: fp.x - ann.x, y: fp.y - ann.y }
        : { x: 0, y: 0 };
      S.dragging = {
        type:'annotation',
        id:annHit.id,
        part:annHit.part,
        anchor:{ x:fp.x, y:fp.y },
        dragOff,
        startSnapshot: ann ? cloneData(ann) : null,
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
    if (pl) {
      clearDragPlayer();
      clearPassKickState();
      selectPlayer(pl.id);
      S.drawing = { pid:pl.id, pts:[{x:pl.x, y:pl.y}], last:{x:fp.x, y:fp.y} };
      try { cv.setPointerCapture(e.pointerId); } catch(_) {}
      setHint('Draw the run path, then release to finish.');
      refreshInteractionUI();
    } else {
      setHint('Click a player first to start their run path.');
    }
  }

  else if (S.tool === 'note') {
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
      S.annotations.push(annotation);
      selectAnnotationById(annotation.id);
      setHint('Note placed. Drag it in Move or update the text from Selection.');
      refreshInteractionUI();
      render();
      focusSelectedNoteInput(true);
    }
  }

  else if (S.tool === 'arrow') {
    S.annotationDraft = normalizeAnnotation({
      id: mkAnnotationId(),
      type: 'arrow',
      start: { x: fp.x, y: fp.y },
      end: { x: fp.x, y: fp.y },
      color: annotationColor('arrow'),
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
    S.annotationDraft = normalizeAnnotation({
      id: mkAnnotationId(),
      type: 'zone',
      x: clampedFieldPoint.x,
      y: clampedFieldPoint.y,
      r: 0.1,
      color: annotationColor('zone'),
    });
    try { cv.setPointerCapture(e.pointerId); } catch(_) {}
    setHint('Drag outward to size the highlight zone.');
    refreshInteractionUI();
  }

  else if (S.tool === 'box') {
    if (!isInsidePitch(fp)) {
      setHint('Start the box highlight inside the pitch. Switch to MOVE to edit existing highlights.');
      refreshInteractionUI();
      render();
      return;
    }
    S.annotationDraft = normalizeAnnotation({
      id: mkAnnotationId(),
      type: 'box',
      x: clampedFieldPoint.x,
      y: clampedFieldPoint.y,
      w: 1.5,
      h: 1.5,
      color: annotationColor('box'),
    });
    S.annotationDraft.anchor = { x: clampedFieldPoint.x, y: clampedFieldPoint.y };
    try { cv.setPointerCapture(e.pointerId); } catch(_) {}
    setHint('Drag outward to size the box highlight.');
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
        clearPassKickState();
        clearSelectedObject();
        setHint(S.tool === 'pass' ? 'Pass added.' : 'Kick to player added.');
        refreshInteractionUI();
      } else {
        // Clicked same player again: cancel
        clearPassKickState();
        clearSelectedObject();
        setHint(HINTS[S.tool] || '');
        refreshInteractionUI();
      }
      render();
    } else if (S.tool === 'kick' && activeWorkflowPlayerId() && isInsidePitch(fp)) {
      // Kick to field target (no receiver player)
      S.passes.push({ from: activeWorkflowPlayerId(), to: null, targetX: clampedFieldPoint.x, targetY: clampedFieldPoint.y, style: 'kick' });
      clearPassKickState();
      clearSelectedObject();
      setHint('Kick to field drawn.');
      refreshInteractionUI();
      render();
    }
  }

  else if (S.tool === 'erase') {
    snapshot();
    let removed = false;

    // 1. Try to erase a path near the click point
    S.paths = S.paths.filter(path => {
      if (removed) return true;
      const close = path.pts.some(pt => d2(fp, pt) < 3.5);
      if (close) { removed = true; return false; }
      return true;
    });

    // 2. Try to erase a pass arc near the click point
    if (!removed) {
      const before = S.passes.length;
      S.passes = S.passes.filter(pass => {
        const fp2 = S.players.find(p => p.id === pass.from);
        const tp  = S.players.find(p => p.id === pass.to);
        if (!fp2 || !tp) return false;
        const mx = (fp2.x + tp.x) / 2, my = (fp2.y + tp.y) / 2;
        return d2(fp, { x: mx, y: my }) > 4;
      });
      if (S.passes.length < before) removed = true;
    }

    // 3. Only remove player or ball if nothing else was hit
    if (!removed) {
      const pl = hitPlayer(fp);
      if (pl) removePlayer(pl.id);
      else if (hitBall(fp)) { S.ball = null; clearSelectedObject(); }
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
  const fp = getF(e);
  const fieldPoint = clampFieldPoint(fp);
  updatePointerTapMovement(e);

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
        pl.x = clamp(fp.x - S.dragOff.x, -2, 70);
        pl.y = clamp(fp.y - S.dragOff.y, -11, 111);
        if (pl.isBC && S.ball) {
          S.ball.x = pl.x;
          S.ball.y = pl.y;
        }
        const path = S.paths.find(p => p.pid === pl.id);
        if (path && path.pts.length) path.pts[0] = {x:pl.x, y:pl.y};
        if (S.ballAttached && samePlayerRef(playerRef(pl), S.ballOwner)) {
          S.ball = attachedBallPositionForPlayer(pl);
          applyBallOwnershipVisualState();
        } else if (samePlayerRef(playerRef(pl), S.ballOwner)) {
          updateBallOwnerFromPosition();
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
          live.x = start.x + dx;
          live.y = start.y + dy;
          const path = S.paths.find(pathItem => pathItem.pid === live.id);
          if (path && path.pts.length) path.pts[0] = { x: live.x, y: live.y };
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
    } else if (S.dragging.type === 'annotation') {
      const ann = findAnnotationById(S.dragging.id);
      if (ann) {
        if (ann.type === 'note') {
          ann.x = fp.x - (S.dragging.dragOff?.x || 0);
          ann.y = fp.y - (S.dragging.dragOff?.y || 0);
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
          } else {
            const base = S.dragging.startSnapshot || ann;
            const baseBounds = boxAnnotationBounds(base);
            let left = baseBounds.left;
            let right = baseBounds.right;
            let top = baseBounds.top;
            let bottom = baseBounds.bottom;
            if (S.dragging.part === 'nw' || S.dragging.part === 'sw') left = fieldPoint.x;
            if (S.dragging.part === 'ne' || S.dragging.part === 'se') right = fieldPoint.x;
            if (S.dragging.part === 'nw' || S.dragging.part === 'ne') top = fieldPoint.y;
            if (S.dragging.part === 'sw' || S.dragging.part === 'se') bottom = fieldPoint.y;
            setBoxFromBounds(ann, left, top, right, bottom);
          }
          clampBoxAnnotation(ann);
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

  if (S.annotationDraft && (S.tool === 'arrow' || S.tool === 'zone' || S.tool === 'box')) {
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
    const onPath = pl || bl || ann || hitRunPath(fp) !== null || hitPassLine(fp) !== -1 || hitKickPath(fp) !== -1;
    cv.style.cursor = onPath ? 'grab' : 'default';
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
  const tap = consumePointerTap(e?.pointerId);
  if (tap && !tap.moved && S.tool === 'move') {
    if (tap.payload.type === 'player' && isPlayerSelected(tap.payload.id)) {
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
        setHint(`${group.label} selected. Click again on the field to place the pack.`);
      }
      refreshInteractionUI();
      render();
      return;
    }
  }

  if (S.dragging) {
    if (S.dragging.type === 'ball' || S.dragging.type === 'player' || S.dragging.type === 'group') updateBallOwnerFromPosition();
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
  if (S.annotationDraft && (S.tool === 'arrow' || S.tool === 'zone' || S.tool === 'box')) finishAnnotationDraft();
}
cv.addEventListener('pointerup', onPointerUp);
cv.addEventListener('pointercancel', onPointerUp);
cv.addEventListener('touchstart',  e => handlePointerDown(normEvent(e)), { passive: false });
cv.addEventListener('touchmove',   e => handlePointerMove(normEvent(e)), { passive: false });
cv.addEventListener('touchend',    e => onPointerUp(normEvent(e)),       { passive: false });
cv.addEventListener('touchcancel', e => onPointerUp(normEvent(e)),       { passive: false });

function finishDraw() {
  if (!S.drawing) return;
  if (S.drawing.pts.length >= 3) {
    snapshot();
    const simplified = dpSimplify(S.drawing.pts, 0.8);
    const pl  = S.players.find(p => p.id === S.drawing.pid);
    const col = pl?.team === 'A' ? '#60a5fa' : '#f87171';
    S.paths = S.paths.filter(p => p.pid !== S.drawing.pid);
    S.paths.push({ pid:S.drawing.pid, pts:simplified, color:col });
  }
  S.drawing = null;
  setHint('Run path saved. Choose the next action.');
  refreshInteractionUI();
  render();
}

function finishAnnotationDraft() {
  if (!S.annotationDraft) return;
  if (S.annotationDraft.type === 'zone') clampZoneAnnotation(S.annotationDraft);
  if (S.annotationDraft.type === 'box') clampBoxAnnotation(S.annotationDraft);
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
  snapshot();
  S.annotations.push(draft);
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
  const used = team === 'A' ? S.atkUsed : S.defUsed;
  if (used.has(num)) return; // already on field
  snapshot();
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
  used.add(num);
  completeFirstUseTutorial();
  rebuildPalette();
  setTool('move');
  selectPlayer(S.players[S.players.length - 1].id);
  S.ballAssignCandidate = S.selectedPlayerId;
  setHint(`${team === 'A' ? 'Attack' : 'Defence'} #${num} added. Drag to position.`);
  refreshInteractionUI();
  render();
}

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

function duplicateSelected() {
  const ann = selectedAnnotation();
  if (!ann) return;
  snapshot();
  const copy = cloneData(ann);
  copy.id = mkAnnotationId();
  if (copy.type === 'note') {
    copy.x = clamp(copy.x + 2, F.XMIN, F.XMAX);
    copy.y = clamp(copy.y + 2, F.YMIN, F.YMAX);
  } else if (copy.type === 'arrow') {
    copy.start = { ...copy.start };
    copy.end = { ...copy.end };
    copy.start.x = clamp(copy.start.x + 2, F.XMIN, F.XMAX);
    copy.start.y = clamp(copy.start.y + 2, F.YMIN, F.YMAX);
    copy.end.x = clamp(copy.end.x + 2, F.XMIN, F.XMAX);
    copy.end.y = clamp(copy.end.y + 2, F.YMIN, F.YMAX);
  } else if (copy.type === 'zone') {
    copy.x = clamp(copy.x + 2, F.XMIN + copy.r, F.XMAX - copy.r);
    copy.y = clamp(copy.y + 2, F.YMIN + copy.r, F.YMAX - copy.r);
  } else if (copy.type === 'box') {
    copy.x = clamp(copy.x + 2, F.XMIN, F.XMAX - Math.abs(copy.w));
    copy.y = clamp(copy.y + 2, F.YMIN, F.YMAX - Math.abs(copy.h));
  }
  S.annotations.push(copy);
  selectAnnotationById(copy.id);
  refreshInteractionUI();
  render();
}
window.duplicateSelected = duplicateSelected;

function setSelectedAnnotationOpacity(value) {
  const ann = selectedAnnotation();
  if (!ann) return;
  const opacity = Number(value);
  if (!Number.isFinite(opacity)) return;
  snapshot();
  ann.opacity = clamp(opacity, 0.2, 1);
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

function sequenceDurationSeconds() {
  return sequenceSegmentCount() * DEFAULT_PLAYBACK_DURATION;
}

function currentStepStartProgress() {
  const steps = sequenceStepCount();
  if (steps <= 1) return 0;
  const lastPlayable = Math.max(0, steps - 2);
  return Math.min(lastPlayable, S.currentStep) / (steps - 1);
}

function stopPlayback(resetProgress = false) {
  S.animating = false;
  S.lastTs = null;
  if (resetProgress) S.animT = 0;
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

function buildSequenceFrame(progress) {
  persistCurrentStep();
  ensureSteps();
  if (S.steps.length < 2) {
    const only = cloneStepState(S.steps[0]);
    return { ...only, segmentIndex: 0, localT: 0 };
  }
  const segments = S.steps.length - 1;
  const scaled = clamp(progress, 0, 1) * segments;
  const segmentIndex = Math.min(segments - 1, Math.floor(scaled));
  const localT = Math.min(1, scaled - segmentIndex);
  const from = cloneStepState(S.steps[segmentIndex]);
  const to = cloneStepState(S.steps[Math.min(S.steps.length - 1, segmentIndex + 1)]);
  const fromLookup = buildStepLookup(from.players);
  const toLookup = buildStepLookup(to.players);
  const allKeys = new Set([...fromLookup.keys(), ...toLookup.keys()]);
  const players = Array.from(allKeys).map(key => {
    const a = fromLookup.get(key) || toLookup.get(key);
    const b = toLookup.get(key) || fromLookup.get(key);
    return {
      num: b.num,
      team: b.team,
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
    annotations: cloneData(localT < 0.5 ? from.annotations : to.annotations),
    paths: cloneData(localT < 0.5 ? from.paths : to.paths),
    passes: cloneData(localT < 0.5 ? from.passes : to.passes),
    segmentIndex,
    localT,
  };
}

function shouldRenderSequencePreview() {
  return sequenceStepCount() > 1 && S.animating;
}

function gotoStep(index, { snapshotBefore = false } = {}) {
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
  snapshot();
  persistCurrentStep();
  const next = cloneStepState(S.steps[S.currentStep] || liveBoardToStepState());
  S.steps.splice(S.currentStep + 1, 0, next);
  S.currentStep += 1;
  stopPlayback(true);
  setLiveBoardFromStep(next);
  setHint(`Step ${S.currentStep + 1} added. The previous step was duplicated so you can build the next action from it.`);
  rebuildPalette();
  refreshInteractionUI();
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

function updateSequenceUI() {
  const stepStatus = document.getElementById('stepStatus');
  const stepStatusCopy = document.getElementById('stepStatusCopy');
  const prevBtn = document.getElementById('seqPrevBtn');
  const nextBtn = document.getElementById('seqNextBtn');
  const deleteBtn = document.getElementById('seqDeleteBtn');
  const playBtn = document.getElementById('playBtn');
  const tlPlayBtn = document.getElementById('tlPlayBtn');
  const rail = document.getElementById('stepRail');
  const count = sequenceStepCount();
  const owner = normalizePlayerRef(S.ballOwner);
  if (stepStatus) stepStatus.textContent = `Step ${S.currentStep + 1} of ${count}`;
  if (stepStatusCopy) {
    const ownerText = owner ? `Ball: ${owner.team === 'A' ? 'A' : 'D'} #${owner.num}` : (S.ball ? 'Ball: Loose' : 'Ball: Off board');
    stepStatusCopy.textContent = `${ownerText} • ${count < STEP_MIN_COUNT ? `Build toward ${STEP_MIN_COUNT}+ phases` : 'Sequence ready'}`;
  }
  if (prevBtn) prevBtn.disabled = S.currentStep === 0;
  if (nextBtn) nextBtn.disabled = S.currentStep >= count - 1;
  if (deleteBtn) deleteBtn.disabled = count <= 1 && !S.players.length && !S.ball && !S.annotations.length;
  if (playBtn) playBtn.disabled = count < 2;
  if (tlPlayBtn) tlPlayBtn.disabled = count < 2;
  if (rail) {
    rail.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const btn = document.createElement('button');
      btn.className = `seq-chip${i === S.currentStep ? ' active' : ''}`;
      btn.textContent = String(i + 1);
      btn.title = `Go to Step ${i + 1}`;
      btn.onclick = () => gotoStep(i);
      rail.appendChild(btn);
    }
  }
}

//  ANIMATION
function togglePlay() {
  persistCurrentStep();
  if (S.animating) {
    S.animating = false;
    S.lastTs = null;
    if (sequenceStepCount() > 1) {
      S.currentStep = clamp(Math.round(S.animT * (sequenceStepCount() - 1)), 0, sequenceStepCount() - 1);
      setLiveBoardFromStep(S.steps[S.currentStep]);
    }
    S.animT = 0;
    setPlayBtnState();
    refreshInteractionUI();
    updateTL();
    render();
    return;
  }
  if (sequenceStepCount() < 2) {
    stopPlayback(false);
    setHint('Add another step to animate the sequence.');
    refreshInteractionUI();
    return;
  }
  S.currentStep = 0;
  S.animT = 0;
  setLiveBoardFromStep(S.steps[0]);
  S.animating = true;
  const isPlay = S.animating;
  syncPlayButtons();
  if (isPlay) { S.lastTs = null; requestAnimationFrame(animLoop); }
}
function animLoop(ts) {
  if (!S.animating) return;
  const DUR = sequenceDurationSeconds();
  if (S.lastTs !== null) {
    S.animT = Math.min(1, S.animT + (ts - S.lastTs) / 1000 * S.animSpd / DUR);
    if (S.animT >= 1) {
      S.animT = 0;
      S.animating = false;
      S.currentStep = Math.max(0, sequenceStepCount() - 1);
      setLiveBoardFromStep(S.steps[S.currentStep]);
      setPlayBtnState();
      refreshInteractionUI();
    }
  }
  S.lastTs = ts;
  render(); updateTL();
  if (S.animating) requestAnimationFrame(animLoop);
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
  document.getElementById('spdLabel').textContent = fmtSpd(S.animSpd);
}
function updateTL() {
  const pct = S.animT * 100;
  document.getElementById('trackFill').style.width = pct + '%';
  document.getElementById('trackThumb').style.left = pct + '%';
  const duration = sequenceDurationSeconds();
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
HINTS.zone  = 'CIRCLE – drag to place a highlight circle.';
MODE_LABELS.note  = 'Note';
MODE_LABELS.arrow = 'Arrow';
MODE_LABELS.zone  = 'Circle Highlight';

HINTS.tele = 'TELESTRATOR - draw live ink that fades in 3 seconds.';
MODE_LABELS.tele = 'Telestrator';

const MOBILE_DRAWER_IDS = ['selection', 'annotations', 'notes', 'files'];

function isMobileViewport() {
  return window.matchMedia('(max-width: 768px)').matches;
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
  document.getElementById('spdLabel').textContent = fmtSpd(S.animSpd);
  [0.25, 0.5, 1, 2].forEach(v => {
    const chip = document.getElementById('mspd-' + v);
    if (chip) chip.classList.toggle('active', v === S.animSpd);
  });
}
window.setMobileSpd = setMobileSpd;

function isCompactViewport() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function syncResponsiveToolbarLabels() {
  const compact = isCompactViewport();
  document.querySelectorAll('[data-label-desktop]').forEach((btn) => {
    const desktopLabel = btn.getAttribute('data-label-desktop') || '';
    const mobileLabel = btn.getAttribute('data-label-mobile') || desktopLabel;
    btn.innerHTML = compact ? mobileLabel : desktopLabel;
  });
}

function syncPlayButtons() {
  const compact = isCompactViewport();
  const count = sequenceStepCount();
  const label = S.animating ? (compact ? '||' : 'PAUSE') : (compact ? '\u25b6' : 'PLAY');
  const playBtn = document.getElementById('playBtn');
  const tlPlayBtn = document.getElementById('tlPlayBtn');
  if (playBtn) {
    playBtn.textContent = label;
    playBtn.disabled = count < 2;
  }
  if (tlPlayBtn) {
    tlPlayBtn.textContent = S.animating ? 'Pause' : 'Play';
    tlPlayBtn.disabled = count < 2;
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
  const mobileBoardName = document.getElementById('mobileBoardName');
  const mobilePlayBtn = document.getElementById('mobilePlayBtn');
  const mobileSequencePlayBtn = document.getElementById('mobileSequencePlayBtn');
  const mobilePrevStepBtn = document.getElementById('mobilePrevStepBtn');
  const mobileNextStepBtn = document.getElementById('mobileNextStepBtn');
  const mobileAddStepBtn = document.getElementById('mobileAddStepBtn');
  const mobileAddAttackBtn = document.getElementById('mobileAddAttackBtn');
  const mobileAddDefenceBtn = document.getElementById('mobileAddDefenceBtn');
  const mobileBoardSummary = document.getElementById('mobileBoardSummary');
  const count = sequenceStepCount();
  const owner = normalizePlayerRef(S.ballOwner);
  const ownerText = owner ? `Ball: ${owner.team === 'A' ? 'A' : 'D'} #${owner.num}` : (S.ball ? 'Ball: Loose' : 'Ball: Off board');

  syncResponsiveToolbarLabels();
  syncPlayButtons();
  if (mobileBoardName) mobileBoardName.textContent = currentPlayTitle();
  if (mobilePlayBtn) {
    mobilePlayBtn.textContent = S.animating ? 'Pause' : 'Play';
    mobilePlayBtn.disabled = count < 2;
  }
  if (mobileSequencePlayBtn) {
    mobileSequencePlayBtn.textContent = S.animating ? '⏸ Pause' : '▶ Play';
    mobileSequencePlayBtn.disabled = count < 2;
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
  if (mobileAddStepBtn) mobileAddStepBtn.disabled = false;
  if (mobileAddAttackBtn) mobileAddAttackBtn.disabled = S.atkUsed.size >= 15;
  if (mobileAddDefenceBtn) mobileAddDefenceBtn.disabled = S.defUsed.size >= 15;

  ['move', 'run', 'pass', 'kick', 'tele', 'zone', 'box', 'erase', 'note', 'arrow'].forEach(tool => {
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
      return { title: 'Tactical Note', meta: 'Move it on the board or update the note text below.' };
    }
    if (ann.type === 'arrow') {
      return { title: 'Free Arrow', meta: 'Drag the line or either endpoint in Move to refine the arrow.' };
    }
    if (ann.type === 'zone') {
      return { title: 'Circle Highlight', meta: 'Drag the circle to move it or drag the outer handle to resize it.' };
    }
    if (ann.type === 'box') {
      return { title: 'Box Highlight', meta: 'Drag inside the box to move it or drag any corner handle to resize it.' };
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

  if (atkTabCount) atkTabCount.textContent = `${atkCount} / 15`;
  if (defTabCount) defTabCount.textContent = `${defCount} / 15`;
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
  const tutorial = document.getElementById('firstUseTutorial');
  const toolbarMode = document.getElementById('toolbarModeInline');
  const gainlineBtn = document.getElementById('gainlineToggleBtn');
  const count = sequenceStepCount();
  const owner = normalizePlayerRef(S.ballOwner);
  const ownerText = owner ? `Ball: ${owner.team === 'A' ? 'A' : 'D'} #${owner.num}` : (S.ball ? 'Ball: Loose' : 'Ball: Off board');
  const summary = `Mode: ${MODE_LABELS[S.tool] || 'Board'} · Step ${S.currentStep + 1} of ${count} · ${ownerText}`;
  if (mode) mode.textContent = MODE_LABELS[S.tool] || 'Board';
  if (text) text.textContent = summary;
  if (toolbarMode) toolbarMode.textContent = `Mode: ${MODE_LABELS[S.tool] || 'Board'}`;
  if (gainlineBtn) gainlineBtn.classList.toggle('active', showGainline);
  if (empty) empty.classList.toggle('hidden', !!S.players.length || !!S.ball || !!S.annotations.length);
  if (tutorial) tutorial.classList.toggle('hidden', !shouldShowFirstUseTutorial());
}

function toggleGainline() {
  showGainline = !showGainline;
  closeRadialMenu();
  setHint(showGainline ? 'Gainline visible. Drag it in Move mode to reposition it.' : 'Gainline hidden.');
  refreshInteractionUI();
  render();
}
window.toggleGainline = toggleGainline;

function updateAnnotationPanel() {
  const copy = document.getElementById('annotationCopy');
  const input = document.getElementById('annotationText');
  if (!copy || !input) return;
  if (S.tool === 'note') {
    copy.textContent = 'Click the field to place a premium note card. The input above sets the default note text.';
  } else if (S.tool === 'arrow') {
    copy.textContent = 'Drag on the field to draw a free tactical arrow.';
  } else if (S.tool === 'zone') {
    copy.textContent = 'Drag on the field to size a circle highlight for space, support, or defensive gaps.';
  } else if (S.tool === 'box') {
    copy.textContent = 'Drag on the field to size a box highlight for channels, pressure areas, or field zones.';
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
  if (titleValue) titleValue.textContent = metadata.title || 'Untitled Play';

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
}

function focusSelectedNoteInput(selectAll = false) {
  const ann = selectedAnnotation();
  const noteInput = document.getElementById('selNoteInput');
  if (!ann || ann.type !== 'note' || !noteInput) return;
  requestAnimationFrame(() => {
    noteInput.focus();
    if (selectAll) noteInput.select();
  });
}

function updateSelectedNoteText(value) {
  const ann = selectedAnnotation();
  if (!ann || ann.type !== 'note') return;
  ann.text = (value || '').trim() || ANNOTATION_NOTE_DEFAULT;
  refreshInteractionUI();
  render();
}

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

  const isAnnotationTool = S.tool === 'note' || S.tool === 'arrow' || S.tool === 'zone' || S.tool === 'box';
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
}
function closeMobileDrawer() {
  const panel    = document.getElementById('smartPanel');
  const backdrop = document.getElementById('spMobileBackdrop');
  const toggle   = document.getElementById('spMobileToggle');
  if (panel) panel.classList.remove('sp-drawer-open');
  if (backdrop) backdrop.classList.remove('open');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}
window.toggleMobileDrawer = toggleMobileDrawer;
window.closeMobileDrawer  = closeMobileDrawer;

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
  const isOpen = section.classList.contains('sp-acc-open');
  section.classList.toggle('sp-acc-open', !isOpen);
  const trigger = section.querySelector('.sp-acc-trigger');
  if (trigger) trigger.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
  try { localStorage.setItem('sp-acc-' + id, isOpen ? '0' : '1'); } catch(e) {}
}
window.toggleAccordion = toggleAccordion;

function setAnnotationColor(color) {
  const ann = selectedAnnotation();
  if (ann) {
    snapshot();
    ann.color = color;
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
}

function setTool(t) {
  S.tool = t;
  if (t !== 'run')           S.drawing = null;
  if (t !== 'arrow' && t !== 'zone' && t !== 'box') S.annotationDraft = null;
  if (t !== 'tele') teleDrawing = null;
  if (t !== 'pass' && t !== 'kick') clearPassKickState();
  if (t !== 'move') clearDragPlayer();
  if (t !== 'move') clearPendingGroupPlacement();
  S.selectedPathPid = null;
  S.selectedPassIdx = null;
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`[data-tool="${t}"]`).forEach(b => b.classList.add('active'));
  cv.style.cursor = t === 'move' ? 'default' : 'crosshair';
  setHint(HINTS[t] || '');
  updateAnnotationPanel();
  refreshInteractionUI();
  render();
}
function setHint(txt) { document.getElementById('hint').textContent = txt; }

function clearPaths()  { snapshot(); S.paths=[]; S.passes=[]; S.drawing=null; setHint('Paths cleared. Choose the next action.'); refreshInteractionUI(); render(); }
function clearSelection() {
  clearSelectedObject();
  S.selectedPassIdx = null;
  S.selectedPathPid = null;
  S.ballAssignCandidate = null;
  S.pointerTap = null;
  S.dragging = null;
  clearDragPlayer();
  clearPassKickState();
  S.drawing = null;
  S.annotationDraft = null;
  setHint('Selection cleared. Choose the next action.');
  updatePresetOptionsUI();
  updateAnnotationPanel();
  refreshInteractionUI();
  render();
}
window.clearSelection = clearSelection;

function cancelActiveBoardInteraction() {
  closeMobileToolsDropdown();
  if (S.annotationDraft) {
    S.annotationDraft = null;
    S.dragging = null;
    S.pointerTap = null;
    setHint(`${MODE_LABELS[S.tool] || 'Tool'} cancelled.`);
    updateAnnotationPanel();
    refreshInteractionUI();
    render();
    return true;
  }
  if (S.drawing) {
    S.drawing = null;
    S.dragging = null;
    S.pointerTap = null;
    setHint('Run path cancelled.');
    refreshInteractionUI();
    render();
    return true;
  }
  if (teleDrawing) {
    teleDrawing = null;
    S.dragging = null;
    S.pointerTap = null;
    clearHighlightedPlayers();
    setHint('Telestrator cancelled.');
    refreshInteractionUI();
    render();
    return true;
  }
  if (activeWorkflowPlayerId()) {
    clearPassKickState();
    clearSelectedObject();
    clearDragPlayer();
    S.pointerTap = null;
    setHint(`${MODE_LABELS[S.tool] || 'Tool'} cancelled.`);
    refreshInteractionUI();
    render();
    return true;
  }
  if (S.selectedPlayerId !== null || S.selectedGroupId !== null || isBallSelected() || selectedAnnotationId() || S.selectedPassIdx !== null || S.selectedPathPid !== null) {
    clearSelection();
    return true;
  }
  closeMobileToolsDropdown();
  return false;
}
function clearAll() {
  snapshot();
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
  S.drawing=null; S.passFrom=null; S.annotationDraft=null; S.selected=null; S.selectedPlayerId=null; S.selectedPlayerIds=[]; S.selectedGroupId=null; S.selectedAnnotationIdValue=null; S.selectedObjectType=null; S.dragPlayerId=null; S.activePasserId=null; S.activeKickerId=null; S.highlightedPlayerIds=[]; S.ballAssignCandidate=null; S.selectedPathPid=null; S.selectedPassIdx=null; S.pendingGroupPlacement=null;
  S.animT=0; S.animating=false;
  S.animSpd=1; spdIdx=2;
  S.nextId=1;
  S.steps=[emptyStepState()]; S.currentStep=0;
  S.atkUsed=new Set(); S.defUsed=new Set();
  document.getElementById('playName').value='New Play';
  setHint('Board reset. Start by adding players from the left.');
  document.getElementById('spdLabel').textContent = '1×';
  updateAnnotationPanel();
  updatePhaseUI();
  setPlayBtnState(); rebuildPalette(); refreshInteractionUI(); updateTL(); render();
}

function updateSelInfo() {
  const box = document.getElementById('selInfo');
  const meta = document.getElementById('selMeta');
  const clearBtn = document.getElementById('selClearBtn');
  const deleteBtn = document.getElementById('selDeleteBtn');
  const giveBallBtn = document.getElementById('selGiveBallBtn');
  const groupActions = document.getElementById('spGroupActions');
  const groupModeBtn = document.getElementById('selGroupModeBtn');
  const regroupBtn = document.getElementById('selRegroupBtn');
  const editWrap = document.getElementById('selEditWrap');
  const editLabel = document.getElementById('selEditLabel');
  const noteInput = document.getElementById('selNoteInput');
  const summary = getSelectedSummary();
  const ann = selectedAnnotation();
  const group = selectedGroup();
  const selectedPlayer = S.selectedPlayerId !== null
    ? S.players.find(player => player.id === S.selectedPlayerId) || null
    : null;
  const playerGroup = !group && selectedPlayer ? groupForPlayer(selectedPlayer) : null;
  document.getElementById('selName').textContent = summary.title;
  if (meta) meta.textContent = summary.meta;
  box.classList.toggle('visible', summary.title !== '-');
  box.classList.toggle('annotation-selected', !!ann && S.selectedPassIdx === null && S.selectedPathPid === null);
  if (editWrap) editWrap.classList.toggle('visible', ann?.type === 'note');
  if (editLabel) editLabel.textContent = ann?.type === 'note' ? 'Note Text' : 'Details';
  if (noteInput) {
    noteInput.value = ann?.type === 'note' ? ann.text : '';
    noteInput.disabled = ann?.type !== 'note';
    noteInput.placeholder = ann?.type === 'note' ? 'Refine the coaching cue' : 'Update note text';
  }
  const giveBallTarget = manualBallAssignmentTarget();
  if (giveBallBtn) {
    giveBallBtn.hidden = !giveBallTarget;
    giveBallBtn.disabled = !giveBallTarget;
    giveBallBtn.onclick = giveBallToSelectedPlayer;
    if (giveBallTarget) {
      giveBallBtn.textContent = `Give Ball to ${giveBallTarget.team === 'A' ? 'A' : 'D'} #${giveBallTarget.num}`;
    }
  }
  const colorPicker = document.getElementById('spColorPicker');
  if (colorPicker) {
    colorPicker.hidden = !ann && !group && !selectedPlayer;
    if (ann || group || selectedPlayer) {
      const currentColor = ann
        ? (ann.color || annotationColor(ann.type))
        : group
          ? (group.color || PRESET_GROUP_ATTACK)
          : (selectedPlayer?.colorOverride || playerColorPalette(selectedPlayer).fill);
      colorPicker.querySelectorAll('.sp-color-swatch').forEach(sw => {
        sw.classList.toggle('active', sw.dataset.color === currentColor);
      });
    }
  }
  const shapeActions = document.getElementById('spShapeActions');
  const shapeOpacity = document.getElementById('shapeOpacity');
  if (shapeActions) {
    shapeActions.hidden = !ann;
    if (ann && shapeOpacity) {
      shapeOpacity.value = String(Number(ann.opacity) || 1);
    }
  }
  const hasAnySelection = !!S.selectedPlayerId || !!group || isBallSelected() || !!ann || S.selectedPassIdx !== null || S.selectedPathPid !== null;
  if (groupActions) {
    const canUnlock = !!group && group.active;
    const canRegroup = !!playerGroup && playerGroup.active === false;
    groupActions.hidden = !canUnlock && !canRegroup;
    if (groupModeBtn) {
      groupModeBtn.hidden = !canUnlock;
      groupModeBtn.onclick = editSelectedPackIndividuals;
    }
    if (regroupBtn) {
      regroupBtn.hidden = !canRegroup;
      regroupBtn.onclick = regroupSelectedPack;
      if (canRegroup) regroupBtn.textContent = `Regroup ${playerGroup.label}`;
    }
  }
  if (deleteBtn) {
    deleteBtn.onclick = deleteSelected;
    if (S.selectedPathPid !== null) deleteBtn.textContent = 'Remove Run Path';
    else if (S.selectedPassIdx !== null) {
      const pass = S.passes[S.selectedPassIdx];
      deleteBtn.textContent = pass?.style === 'pass' ? 'Remove Pass' : 'Remove Kick';
    }
    else if (isBallSelected()) deleteBtn.textContent = 'Remove Ball';
    else if (ann) deleteBtn.textContent = `Remove ${MODE_LABELS[ann.type] || 'Item'}`;
    else if (S.selectedPlayerId !== null) {
      const pl = S.players.find(p => p.id === S.selectedPlayerId);
      deleteBtn.textContent = pl ? 'Remove from Field' : 'Remove Player';
    } else {
      deleteBtn.textContent = 'Remove Player';
    }
    deleteBtn.disabled = !hasAnySelection || !!group;
  }
  if (clearBtn) {
    clearBtn.onclick = clearSelection;
    clearBtn.textContent = hasAnySelection ? 'Clear Selection' : 'No Selection';
    clearBtn.disabled = !hasAnySelection;
  }
  const carrier = S.players.find(p => p.isBC);
  if (carrier) updateGainDisplayForY(carrier.y);
  else updateGainDisplayForY(GAINLINE_Y);
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
  const attackRow = document.getElementById('attackPlayerRow');
  const defenceRow = document.getElementById('defencePlayerRow');
  if (grid) grid.innerHTML = '';
  if (attackRow) attackRow.innerHTML = '';
  if (defenceRow) defenceRow.innerHTML = '';

  [
    { key: 'atk', team: 'A', used: S.atkUsed, target: attackRow },
    { key: 'def', team: 'D', used: S.defUsed, target: defenceRow },
  ].forEach(({ key, team, used, target }) => {
    if (!target) return;
    for (let n = 1; n <= 15; n++) {
      const existing = S.players.find((player) => player.num === n && player.team === team) || null;
      const isSelected = !!existing && isPlayerSelected(existing.id);
      const btn = document.createElement('button');
      btn.className = `player-token ${key}${used.has(n) ? ' on' : ''}${isSelected ? ' active' : ''}`;
      btn.textContent = n;
      btn.title = used.has(n)
        ? `${isSelected ? 'Deselect' : 'Select'} ${team==='A'?'Attack':'Defence'} #${n}`
        : `Add ${team==='A'?'Attack':'Defence'} #${n}`;
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      btn.onclick = (event) => togglePalettePlayer(n, team, event);
      target.appendChild(btn);
    }
  });
  updatePaletteSummary();
}

function makeBoardData(nameOverride) {
  return makeProjectRecord(nameOverride);
}

function applyBoardData(play, { snapshotBefore = true } = {}) {
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
}

function refreshSavedPlayList() {
  const wrap = document.getElementById('savedPlayList');
  if (!wrap) return;
  const saved = getSavedPlays();
  wrap.innerHTML = '';
  if (!saved.length) {
    wrap.innerHTML = '<div class="saved-play-empty">No local saves yet. Save the current board to keep building from it later.</div>';
    return;
  }
  saved.forEach(item => {
    const card = document.createElement('div');
    card.className = 'saved-play-card';
    const savedDate = item.savedAt ? new Date(item.savedAt).toLocaleString() : 'Saved locally';
    card.innerHTML = `<div class="saved-play-main">
      <div>
        <div class="saved-play-name">${item.name}</div>
        <div class="saved-play-meta">${savedDate}<br>${item.steps?.length || 1} step${(item.steps?.length || 1) === 1 ? '' : 's'} · ${item.players?.length || 0} players · ${(item.paths||[]).length} paths · ${(item.passes||[]).length} passes</div>
      </div>
    </div>
    <div class="saved-play-actions">
      <button class="saved-play-btn" data-action="load">Load</button>
      <button class="saved-play-btn" data-action="export">Export</button>
      <button class="saved-play-btn danger" data-action="delete">Delete</button>
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
  const project = normalizeProjectRecord(play) || makeBoardData();
  const payload = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectType: PROJECT_TYPE,
    exportedAt: nowIso(),
    project: {
      name: project.name,
      currentPhase: project.currentPhase,
      phases: project.phases,
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = (project.name || 'untitled-play').replace(/[^\w-]+/g, '_');
  link.href = url;
  link.download = `${safeName}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setHint(`Exported "${project.name}" as JSON.`);
  refreshInteractionUI();
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
}
window.exportPDF = exportPDF;

function exportCurrentPlay() {
  const play = serializePlay();
  const blob = new Blob([JSON.stringify(play, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = (play.meta.name || 'untitled-play').replace(/[^\w-]+/g, '_');
  link.href = url;
  link.download = `${safeName}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setHint(`Exported "${play.meta.name}" as JSON.`);
  refreshInteractionUI();
}

function triggerImportPlay() {
  const input = document.getElementById('importPlayInput');
  if (input) input.click();
}

function importPlayFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(reader.result);
      const play = migratePlay(raw);
      deserializePlay(play);
      setTool('move');
      setHint(`Imported "${play.meta?.name || 'Untitled Play'}" from JSON.`);
      refreshInteractionUI();
    } catch (err) {
      console.error('Import failed:', err);
      setHint(`Import failed: ${err.message}`);
      refreshInteractionUI();
    }
  };
  reader.readAsText(file);
}


document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const k = e.key.toLowerCase();
  const map = {v:'move',r:'run',p:'pass',k:'kick',e:'erase',t:'tele',c:'zone',b:'box'};
  if (map[k])           { setTool(map[k]); return; }
  if (k===' ')          { e.preventDefault(); togglePlay(); return; }
  if (k === 'arrowleft') { e.preventDefault(); prevStep(); return; }
  if (k === 'arrowright') { e.preventDefault(); nextStep(); return; }
  if (k==='escape')     {
    e.preventDefault();
    if (radialMenu) {
      closeRadialMenu();
      render();
      return;
    }
    cancelActiveBoardInteraction();
    return;
  }
  if (k==='z'&&(e.ctrlKey||e.metaKey)&&e.shiftKey) { e.preventDefault(); redo(); return; }
  if (k==='z'&&(e.ctrlKey||e.metaKey)) { e.preventDefault(); undo(); }
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
  refreshInteractionUI();
});
window.serializePlay = serializePlay;
window.deserializePlay = deserializePlay;
window.migratePlay = migratePlay;

document.addEventListener('pointerdown', e => {
  if (!radialMenu) return;
  const menu = document.getElementById('radialMenu');
  if (menu && !menu.contains(e.target)) {
    closeRadialMenu();
    render();
  }
});
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
  if (e.key === 'Enter') {
    e.preventDefault();
    e.target.blur();
  }
  if (e.key === 'Escape') {
    const ann = selectedAnnotation();
    if (ann?.type === 'note') {
      e.target.value = ann.text;
    }
    e.target.blur();
  }
});
document.getElementById('importPlayInput').addEventListener('change', e => {
  importPlayFromFile(e.target.files?.[0]);
  e.target.value = '';
});
window.addEventListener('resize', resize);
resize();
loadPlay('scrum_left');
setHint('MOVE - drag the scrum pack as one unit, or switch to individual edits when you need detail.');
refreshInteractionUI();

(function initAccordions() {
  ['accPurpose', 'accDecision', 'accCoaching', 'accMistakes'].forEach(function(id) {
    try {
      if (localStorage.getItem('sp-acc-' + id) === '1') {
        var section = document.getElementById(id);
        if (section) {
          section.classList.add('sp-acc-open');
          var trigger = section.querySelector('.sp-acc-trigger');
          if (trigger) trigger.setAttribute('aria-expanded', 'true');
        }
      }
    } catch(e) {}
  });
})();

document.addEventListener('pointerdown', e => {
  const dropdown = document.getElementById('mobileToolsDropdown');
  const btn = document.getElementById('mobileToolsBtn');
  if (!dropdown || !dropdown.classList.contains('is-open')) return;
  if (!dropdown.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
    closeMobileToolsDropdown();
  }
}, { capture: true });

