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

// Canvas scaling
const FIELD_X_STRETCH = 1.7;
let cvW=0, cvH=0, sc=1, sx=1, sy=1, ox=0, oy=0;
const cv  = document.getElementById('field');
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

const S = {
  tool: 'move',
  tab:  'atk',          // active palette tab
  players: [],          // { id, num, team:'A'|'D', x, y, isBC:false }
  ball: null,           // { x, y }
  ballOwner: null,      // { num, team } for the starting ball carrier
  ballAttached: false,  // manual carrier assignment keeps the ball attached to the owner
  paths: [],            // { pid, pts:[{x,y}], color }
  passes: [],           // { from, to, style:'pass'|'kick' }
  projectId: null,
  projectMeta: null,
  playMetadata: null,
  projectPlayback: null,
  annotations: [],
  annotationDraft: null,
  selected: null,       // player id
  dragging: null,       // { type:'player'|'ball', id? }
  dragOff: { x:0, y:0 },
  drawing: null,        // { pid, pts:[], last:{x,y} }
  passFrom: null,
  history: [],          // undo stack (snapshots)
  animT: 0,
  animating: false,
  animSpd: 1,
  raf: null,
  lastTs: null,
  steps: [],
  currentStep: 0,
  nextId: 1,
  atkUsed: new Set(),   // which numbers are on field
  defUsed: new Set(),
  ballAssignCandidate: null,
  pointerTap: null,
  selectedPassIdx: null,
  selectedPathPid: null,
};
const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3];
let   spdIdx = 2;
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

function normalizePlayerRef(ref) {
  if (!ref || typeof ref !== 'object') return null;
  const team = ref.team === 'D' ? 'D' : ref.team === 'A' ? 'A' : null;
  const num = Number(ref.num);
  if (!team || !Number.isFinite(num)) return null;
  return { num, team };
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
      const team = pl?.team === 'D' ? 'D' : pl?.team === 'A' ? 'A' : null;
      const num = Number(pl?.num);
      const x = Number(pl?.x);
      const y = Number(pl?.y);
      if (!team || !Number.isFinite(num) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { num, team, x, y };
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

function cloneStepState(step) {
  return normalizeStepState(cloneData(step), step?.players || []);
}

function emptyStepState() {
  return { players: [], ball: null, ballOwner: null, ballAttached: false, paths: [], passes: [], annotations: [] };
}

function liveBoardToStepState() {
  return normalizeStepState({
    players: S.players.map(({ num, team, x, y }) => ({ num, team, x, y })),
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

function setLiveBoardFromStep(step, { keepSelection = false } = {}) {
  const normalized = normalizeStepState(step);
  const selected = keepSelection ? S.selected : null;
  S.players = normalized.players.map(pl => ({ ...pl, id: S.nextId++, isBC: false }));
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

  S.selected = keepSelection ? selected : null;
  if (S.ballAttached && S.ballOwner) syncAttachedBallToOwner();
  else if (S.ball && !S.ballOwner) updateBallOwnerFromPosition();
  else applyBallOwnershipVisualState();
}

function createCarryForwardStep(step) {
  const next = cloneStepState(step);
  next.paths = [];
  next.passes = [];
  return next;
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
  return typeof S.selected === 'string' && S.selected.startsWith('ann:') ? S.selected.slice(4) : null;
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
  if (S.selected && S.selected !== '__ball__') {
    return S.players.find(p => p.id === S.selected) || null;
  }
  if (S.selected === '__ball__' && S.ballAssignCandidate) {
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
  S.selected = player.id;
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

function currentPlayTitle() {
  return document.getElementById('playName').value.trim() || 'Untitled Play';
}

function buildPlayMetadata() {
  const current = normalizeProjectMetadata({ name: currentPlayTitle() }, S.playMetadata || {});
  return {
    ...current,
    title: currentPlayTitle(),
  };
}

function syncPlayMetadataTitle() {
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
  persistCurrentStep();
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
  const currentStepData = cloneStepState(S.steps[S.currentStep] || liveBoardToStepState());
  const steps = S.steps.map(step => cloneStepState(step));

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectType: PROJECT_TYPE,
    id: S.projectId || mkProjectId(),
    name: title,
    cat: 'Saved Board',
    metadata: meta,
    playback,
    currentStepIndex: S.currentStep,
    steps,
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
  persistCurrentStep();
  S.history.push(cloneData({
    steps: S.steps,
    currentStep: S.currentStep,
    playMetadata: S.playMetadata,
    projectId: S.projectId,
    projectMeta: S.projectMeta,
    projectPlayback: S.projectPlayback,
  }));
  if (S.history.length > 30) S.history.shift();
}
function undo() {
  if (!S.history.length) return;
  const h = S.history.pop();
  S.steps = Array.isArray(h.steps) && h.steps.length ? h.steps.map(step => normalizeStepState(step)) : [emptyStepState()];
  S.currentStep = clamp(Number.isFinite(h.currentStep) ? h.currentStep : 0, 0, S.steps.length - 1);
  setLiveBoardFromStep(S.steps[S.currentStep]);
  S.playMetadata = normalizeProjectMetadata({ name: currentPlayTitle() }, h.playMetadata || {});
  S.projectId = h.projectId || null;
  S.projectMeta = h.projectMeta || null;
  S.projectPlayback = normalizePlaybackSettings(h.projectPlayback || {});
  S.atkUsed = new Set(S.players.filter(p=>p.team==='A').map(p=>p.num));
  S.defUsed = new Set(S.players.filter(p=>p.team==='D').map(p=>p.num));
  S.selected = null;
  updatePlayMetadataPanel();
  rebuildPalette(); refreshInteractionUI();
  render();
}

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

  // ── 4. Mow stripes — 16 clean bands ─────────────────────────────────────
  const N_STRIPES = 16;
  const bandW = FW / N_STRIPES;
  ctx.save();
  ctx.beginPath(); ctx.rect(TL.x, TL.y, FW, FH); ctx.clip();
  for (let si = 0; si < N_STRIPES; si++) {
    const bx = TL.x + si * bandW;
    const sg = ctx.createLinearGradient(bx, 0, bx + bandW, 0);
    if (si % 2 === 0) {
      sg.addColorStop(0,    'rgba(255,255,255,0.000)');
      sg.addColorStop(0.28, 'rgba(255,255,255,0.038)');
      sg.addColorStop(0.72, 'rgba(255,255,255,0.038)');
      sg.addColorStop(1,    'rgba(255,255,255,0.000)');
    } else {
      sg.addColorStop(0,    'rgba(0,0,0,0.000)');
      sg.addColorStop(0.28, 'rgba(0,0,0,0.044)');
      sg.addColorStop(0.72, 'rgba(0,0,0,0.044)');
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
  function hline(fy, color, lw, dash = [], x0 = 0, x1 = F.W) {
    const p = toC(x0, fy), q = toC(x1, fy);
    const py = Math.round(p.y) + 0.5;
    ctx.save();
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

  function vline(fx, color, lw, fy0 = F.YMIN, fy1 = F.YMAX, dash = []) {
    const p = toC(fx, fy0), q = toC(fx, fy1);
    const px = Math.round(p.x) + 0.5;
    ctx.save();
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

  // ── 9. Tier 1: Boundary, goal lines, halfway ──────────────────────────────
  hline(F.YMIN, T1_C, T1_W);   // top dead-ball
  hline(F.YMAX, T1_C, T1_W);   // bottom dead-ball
  hline(0,   T1_C, T1_W);      // top goal line
  hline(100, T1_C, T1_W);      // bottom goal line
  hline(50,  T1_C, T1_W);      // halfway — same visual tier as goal lines

  // Touchlines: full field height
  vline(0,  T1_C, T1_W);
  vline(68, T1_C, T1_W);

  // ── 10. Tier 2: 22m lines ────────────────────────────────────────────────
  hline(22, T2_C, T2_W);
  hline(78, T2_C, T2_W);

  // ── 11. Tier 3: 10m dashed lines ─────────────────────────────────────────
  hline(40, T3_C, T3_W, D_10M);
  hline(60, T3_C, T3_W, D_10M);

  // ── 12. Tier 4: 5m lines from touchline (inside field, goal line to goal line) ──
  vline(5,  T4_C, T4_W, 0, 100, D_5M);
  vline(63, T4_C, T4_W, 0, 100, D_5M);

  // 15m lineout guide — dashed vertical, goal line to goal line
  const T4_15M = 'rgba(255,255,255,0.36)';
  vline(15, T4_15M, T4_W, 0, 100, D_5M);
  vline(53, T4_15M, T4_W, 0, 100, D_5M);

  // ── 13. Lineout guides at 15m from touch ─────────────────────────────────
  // Short perpendicular ticks at all major yard lines — broadcast standard
  const TICK_ROWS = [0, 22, 40, 50, 60, 78, 100];
  const tickHalf = Math.max(3.5, sx * 1.5); // half-width in canvas px

  TICK_ROWS.forEach(fy => {
    const pL = toC(15, fy), pR = toC(53, fy);
    const py = Math.round(pL.y) + 0.5;
    const isMajor = (fy === 0 || fy === 50 || fy === 100);
    const isSec   = (fy === 22 || fy === 78);
    const alpha   = isMajor ? 0.62 : isSec ? 0.50 : 0.36;
    const lw      = isMajor ? T2_W : T4_W;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = lw;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(pL.x - tickHalf, py); ctx.lineTo(pL.x + tickHalf, py);
    ctx.moveTo(pR.x - tickHalf, py); ctx.lineTo(pR.x + tickHalf, py);
    ctx.stroke();
    ctx.restore();
  });

  // ── 14. Center mark ───────────────────────────────────────────────────────
  const cm = toC(34, 50);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.90)';
  ctx.beginPath();
  ctx.arc(cm.x, cm.y, Math.max(2.6, sc * 0.25), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 15. Field labels — minimal, high contrast ────────────────────────────
  function fieldLabel(fx, fy, text, alpha = 0.24) {
    const p = toC(fx, fy);
    const fs = Math.max(9, sc * 0.98);
    ctx.save();
    ctx.font = `600 ${fs}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillText(text, p.x, p.y);
    ctx.restore();
  }

  // 50 label — slightly above center mark so mark is visible
  fieldLabel(34, 47.5, '50', 0.30);

  // 22m labels — inside field, just below/above the line
  fieldLabel(4.6, 20.8, '22', 0.30);
  fieldLabel(63.4, 20.8, '22', 0.30);
  fieldLabel(4.6, 79.2, '22', 0.30);
  fieldLabel(63.4, 79.2, '22', 0.30);

  // 10m labels
  fieldLabel(4.6, 38.8, '10', 0.22);
  fieldLabel(63.4, 38.8, '10', 0.22);
  fieldLabel(4.6, 61.2, '10', 0.22);
  fieldLabel(63.4, 61.2, '10', 0.22);

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

  // Shadow pass — drawn first for depth
  ctx.strokeStyle = 'rgba(0,0,0,0.50)';
  ctx.lineWidth = postW + 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(leftX + 1, tryLineY + dir);  ctx.lineTo(leftX + 1, crossbarY + dir);
  ctx.moveTo(rightX + 1, tryLineY + dir); ctx.lineTo(rightX + 1, crossbarY + dir);
  ctx.moveTo(leftX + 1, crossbarY + dir); ctx.lineTo(rightX + 1, crossbarY + dir);
  ctx.moveTo(leftX + 1, crossbarY);  ctx.lineTo(leftX + 1, postTopY);
  ctx.moveTo(rightX + 1, crossbarY); ctx.lineTo(rightX + 1, postTopY);
  ctx.stroke();

  // Main post — base stems thicker for grounding
  ctx.strokeStyle = 'rgba(252,252,252,0.40)';
  ctx.lineWidth = baseW;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(leftX,  tryLineY); ctx.lineTo(leftX,  crossbarY);
  ctx.moveTo(rightX, tryLineY); ctx.lineTo(rightX, crossbarY);
  ctx.stroke();

  // Main post — uprights + crossbar
  ctx.strokeStyle = 'rgba(252,252,252,0.94)';
  ctx.lineWidth = postW;
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  // Crossbar
  ctx.moveTo(leftX,  crossbarY); ctx.lineTo(rightX, crossbarY);
  // Uprights (crossbar to top)
  ctx.moveTo(leftX,  crossbarY); ctx.lineTo(leftX,  postTopY);
  ctx.moveTo(rightX, crossbarY); ctx.lineTo(rightX, postTopY);
  ctx.stroke();

  // Post base dots — where uprights meet the goal line
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  const dotR = Math.max(2.2, sc * 0.22);
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
function drawPlayer(fx, fy, num, team, selected, isBallCarrier) {
  const p = toC(fx, fy);
  const r = R();
  const isAtk = team === 'A';
  const fill   = isAtk ? '#2563eb' : '#dc2626';
  const border = isAtk ? '#93c5fd' : '#fca5a5';
  const glow   = isAtk ? '#3b82f6' : '#ef4444';

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
  ctx.shadowColor = '#fbbf24';
  ctx.shadowBlur = isMobileBoardViewport() ? 12 : 20;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r + (isMobileBoardViewport() ? 4 : 5), 0, Math.PI * 2);
  ctx.strokeStyle = isMobileBoardViewport() ? 'rgba(251,191,36,0.24)' : 'rgba(251,191,36,0.34)';
  ctx.lineWidth = isMobileBoardViewport() ? 1.6 : 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

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
    frame.players.forEach(pl => drawPlayer(pl.x, pl.y, pl.num, pl.team, false, samePlayerRef(playerRef(pl), frame.ballOwner)));
    if (frame.ball) drawBall(frame.ball.x, frame.ball.y, false);
    frame.players.forEach(pl => {
      if (samePlayerRef(playerRef(pl), frame.ballOwner)) drawBallCarrierHighlight(pl.x, pl.y);
    });
    renderAnnotations('notes', frame.annotations);
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
  renderAnnotations('lines');

  if (S.drawing && S.drawing.pts.length >= 2) {
    const pl  = S.players.find(p => p.id === S.drawing.pid);
    const col = pl?.team === 'A' ? 'rgba(96,165,250,0.7)' : 'rgba(248,113,113,0.7)';
    drawRunPath(S.drawing.pts, col, 2.2, 1, true);
  }
  renderAnnotationDraft();

  if (S.passFrom) {
    const fp = S.players.find(p => p.id === S.passFrom);
    if (fp) {
      const p = toC(fp.x, fp.y), r = R() + 6;
      ctx.save();
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  S.players.forEach(pl => {
    const pos = animPos(pl, t);
    const sel = S.selected === pl.id;
    drawPlayer(pos.x, pos.y, pl.num, pl.team, sel, pl.isBC);
  });
  if (S.ball) {
    drawBall(S.ball.x, S.ball.y, S.selected === '__ball__');
  }
  S.players.forEach(pl => {
    if (pl.isBC) drawBallCarrierHighlight(pl.x, pl.y);
  });
  renderAnnotations('notes');
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
  return S.players.find(p => d2(fp, {x:p.x, y:p.y}) < PRT());
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
  if (selectedAnnotationId() === id) S.selected = null;
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

cv.addEventListener('pointerdown', e => {
  const fp = getF(e);
  const clampedFieldPoint = clampFieldPoint(fp);

  if (S.tool === 'move') {
    const pl = hitPlayer(fp);
    const ballHit = !pl && hitBall(fp);
    const previousSelectedPlayer = S.selected && S.selected !== '__ball__'
      ? S.players.find(p => p.id === S.selected)
      : null;
    const annHit = !pl && !ballHit ? hitAnnotation(fp) : null;
    if (pl) {
      const wasSelected = S.selected === pl.id;
      snapshot();
      S.selected = pl.id;
      S.ballAssignCandidate = pl.id;
      S.dragging  = { type:'player', id:pl.id };
      S.dragOff   = { x:fp.x - pl.x, y:fp.y - pl.y };
      beginPointerTap(e.pointerId, { type:'player', id:pl.id, wasSelected }, e);
      cv.setPointerCapture(e.pointerId);
    } else if (ballHit) {
      const wasSelected = S.selected === '__ball__';
      snapshot();
      S.selected = '__ball__';
      S.ballAssignCandidate = previousSelectedPlayer ? previousSelectedPlayer.id : null;
      S.dragging  = { type:'ball' };
      S.dragOff   = { x:fp.x - S.ball.x, y:fp.y - S.ball.y };
      if (S.ballAttached) S.ballAttached = false;
      beginPointerTap(e.pointerId, { type:'ball', wasSelected }, e);
      cv.setPointerCapture(e.pointerId);
    } else if (annHit) {
      const wasSelected = selectedAnnotationId() === annHit.id;
      snapshot();
      S.selected = annotationSelection(annHit.id);
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
      cv.setPointerCapture(e.pointerId);
    } else {
      const kickIdx = hitKickPath(fp);
      const passIdx = hitPassLine(fp);
      const runPid  = hitRunPath(fp);
      if (kickIdx !== -1) {
        S.selectedPassIdx = kickIdx;
        S.selectedPathPid = null;
        S.selected = null;
        S.ballAssignCandidate = null;
        S.pointerTap = null;
      } else if (passIdx !== -1) {
        S.selectedPassIdx = passIdx;
        S.selectedPathPid = null;
        S.selected = null;
        S.ballAssignCandidate = null;
        S.pointerTap = null;
      } else if (runPid !== null) {
        S.selectedPathPid = runPid;
        S.selectedPassIdx = null;
        S.selected = null;
        S.ballAssignCandidate = null;
        S.pointerTap = null;
      } else {
        S.selectedPassIdx = null;
        S.selectedPathPid = null;
        S.selected = null;
        S.ballAssignCandidate = null;
        S.pointerTap = null;
      }
    }
    refreshInteractionUI(); render();
  }

  else if (S.tool === 'run') {
    const pl = hitPlayer(fp);
    if (pl) {
      S.drawing = { pid:pl.id, pts:[{x:pl.x, y:pl.y}], last:{x:fp.x, y:fp.y} };
      S.selected = pl.id;
      cv.setPointerCapture(e.pointerId);
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
      S.selected = annotationSelection(annotation.id);
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
    cv.setPointerCapture(e.pointerId);
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
    cv.setPointerCapture(e.pointerId);
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
    cv.setPointerCapture(e.pointerId);
    setHint('Drag outward to size the box highlight.');
    refreshInteractionUI();
  }

  else if (S.tool === 'pass' || S.tool === 'kick') {
    const pl = hitPlayer(fp);
    if (pl) {
      if (!S.passFrom) {
        // First click: arm passer/kicker and auto-assign ball to them
        snapshot();
        S.passFrom = pl.id;
        S.selected = pl.id;
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
      } else if (pl.id !== S.passFrom) {
        // Second click: complete the pass/kick
        const dup = S.passes.find(p => p.from === S.passFrom && p.to === pl.id);
        if (!dup) S.passes.push({ from: S.passFrom, to: pl.id, style: S.tool });
        S.passFrom = null; S.selected = null;
        setHint(S.tool === 'pass' ? 'Pass added.' : 'Kick to player added.');
        refreshInteractionUI();
      } else {
        // Clicked same player again: cancel
        S.passFrom = null; S.selected = null;
        setHint(HINTS[S.tool] || '');
        refreshInteractionUI();
      }
      render();
    } else if (S.tool === 'kick' && S.passFrom && isInsidePitch(fp)) {
      // Kick to field target (no receiver player)
      S.passes.push({ from: S.passFrom, to: null, targetX: clampedFieldPoint.x, targetY: clampedFieldPoint.y, style: 'kick' });
      S.passFrom = null; S.selected = null;
      setHint('Kick to field drawn.');
      refreshInteractionUI();
      render();
    }
  }

  else if (S.tool === 'erase') {
    snapshot();
    const pl = hitPlayer(fp);
    if (pl) {
      removePlayer(pl.id);
    } else if (hitBall(fp)) {
      S.ball = null;
      S.ballOwner = null;
      applyBallOwnershipVisualState();
    } else {
      const annHit = hitAnnotation(fp);
      if (annHit) {
        removeAnnotation(annHit.id);
        refreshInteractionUI();
        render();
        return;
      }
      // Erase nearest path segment
      let removed = false;
      S.paths = S.paths.filter(path => {
        if (removed) return true;
        const close = path.pts.some(pt => d2(fp, pt) < 3.5);
        if (close) { removed = true; return false; }
        return true;
      });
      // Erase nearest pass
      if (!removed) {
        S.passes = S.passes.filter(pass => {
          const fp2 = S.players.find(p=>p.id===pass.from);
          const tp  = S.players.find(p=>p.id===pass.to);
          if (!fp2||!tp) return false;
          const mx = (fp2.x+tp.x)/2, my = (fp2.y+tp.y)/2;
          return d2(fp, {x:mx,y:my}) > 4;
        });
      }
    }
    refreshInteractionUI();
    render();
  }
});

cv.addEventListener('pointermove', e => {
  const fp = getF(e);
  const fieldPoint = clampFieldPoint(fp);
  updatePointerTapMovement(e);

  // Drag
  if (S.dragging) {
    cv.style.cursor = 'grabbing';
    if (S.dragging.type === 'player') {
      const pl = S.players.find(p => p.id === S.dragging.id);
      if (pl) {
        pl.x = clamp(fp.x - S.dragOff.x, -2, 70);
        pl.y = clamp(fp.y - S.dragOff.y, -11, 111);
        const path = S.paths.find(p => p.pid === pl.id);
        if (path && path.pts.length) path.pts[0] = {x:pl.x, y:pl.y};
        if (S.ballAttached && samePlayerRef(playerRef(pl), S.ballOwner)) {
          S.ball = attachedBallPositionForPlayer(pl);
          applyBallOwnershipVisualState();
        } else if (samePlayerRef(playerRef(pl), S.ballOwner)) {
          updateBallOwnerFromPosition();
        }
      }
    } else if (S.dragging.type === 'ball' && S.ball) {
      S.ball.x = clamp(fp.x - S.dragOff.x, -2, 70);
      S.ball.y = clamp(fp.y - S.dragOff.y, -11, 111);
      updateBallOwnerFromPosition();
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
    render(); return;
  }

  // Freehand draw
  if (S.drawing && S.tool === 'run') {
    if (d2(fp, S.drawing.last) > 1.2) {
      S.drawing.pts.push({x:fp.x, y:fp.y});
      S.drawing.last = {x:fp.x, y:fp.y};
      render();
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
    render();
    return;
  }

  // Cursor
  const pl = hitPlayer(fp), bl = hitBall(fp), ann = hitAnnotation(fp);
  if (S.tool === 'move') {
    const onPath = pl || bl || ann || hitRunPath(fp) !== null || hitPassLine(fp) !== -1 || hitKickPath(fp) !== -1;
    cv.style.cursor = onPath ? 'grab' : 'default';
  } else if (S.tool === 'erase') {
    cv.style.cursor = 'crosshair';
  } else if (S.tool === 'run') {
    cv.style.cursor = pl ? 'crosshair' : 'default';
  } else {
    cv.style.cursor = pl ? 'pointer' : 'default';
  }
});

function onPointerUp(e) {
  const tap = consumePointerTap(e?.pointerId);
  if (tap && !tap.moved && S.tool === 'move') {
    if (tap.payload.type === 'player' && tap.payload.wasSelected && S.selected === tap.payload.id) {
      clearSelection();
      render();
      return;
    }
    if (tap.payload.type === 'ball' && tap.payload.wasSelected && S.selected === '__ball__') {
      clearSelection();
      render();
      return;
    }
    if (tap.payload.type === 'annotation' && tap.payload.wasSelected && selectedAnnotationId() === tap.payload.id) {
      clearSelection();
      render();
      return;
    }
  }

  if (S.dragging) {
    if (S.dragging.type === 'ball' || S.dragging.type === 'player') updateBallOwnerFromPosition();
    S.dragging = null;
    refreshInteractionUI();
    render();
  }
  if (S.drawing && S.tool === 'run') finishDraw();
  if (S.annotationDraft && (S.tool === 'arrow' || S.tool === 'zone' || S.tool === 'box')) finishAnnotationDraft();
}
cv.addEventListener('pointerup', onPointerUp);
cv.addEventListener('pointercancel', onPointerUp);

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
  S.selected = annotationSelection(draft.id);
  completeFirstUseTutorial();
  setHint(`${MODE_LABELS[draft.type] || 'Annotation'} placed — selected. Press Delete to remove, or click it again to reposition.`);
  refreshInteractionUI();
  render();
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
let _atkCount = 0, _defCount = 0;

function addPlayerByNum(num, team) {
  const used = team === 'A' ? S.atkUsed : S.defUsed;
  if (used.has(num)) return; // already on field
  snapshot();
  // Smart placement: stagger across field
  const existing = S.players.filter(p => p.team === team);
  const idx = existing.length;
  const cols = 6, spacingX = 10, spacingY = 12;
  const startX = team === 'A' ? 10 : 10;
  const startY = team === 'A' ? 15 : 55;
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
  S.selected = S.players[S.players.length - 1].id;
  S.ballAssignCandidate = S.selected;
  setHint(`${team === 'A' ? 'Attack' : 'Defence'} #${num} added. Drag to position.`);
  refreshInteractionUI();
  render();
}

function togglePalettePlayer(num, team) {
  const existing = S.players.find((player) => player.num === num && player.team === team) || null;

  if (existing) {
    if (S.selected === existing.id) {
      clearSelection();
      setHint(`${team === 'A' ? 'Attack' : 'Defence'} #${num} deselected.`);
      refreshInteractionUI();
      render();
      return;
    }

    setTool('move');
    S.selected = existing.id;
    S.ballAssignCandidate = existing.id;
    setHint(`${team === 'A' ? 'Attack' : 'Defence'} #${num} selected.`);
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
  const selectedPlayer = S.selected && S.selected !== '__ball__'
    ? S.players.find(p => p.id === S.selected)
    : null;
  if (selectedPlayer) {
    setTool('move');
    assignBallToPlayer(selectedPlayer, { snapshotBefore: !S.ball, source: 'place' });
    return;
  }
  if (!S.ball) snapshot();
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
  if (S.selected === id) S.selected = null;
  if (S.ballAssignCandidate === id) S.ballAssignCandidate = null;
  applyBallOwnershipVisualState();
  setHint(`${pl.team === 'A' ? 'Attack' : 'Defence'} #${pl.num} removed. That number is available again.`);
  rebuildPalette(); refreshInteractionUI(); render();
}

function deleteSelected() {
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
  else if (S.selected && S.selected !== '__ball__') {
    snapshot();
    removePlayer(S.selected);
  }
  else if (S.selected === '__ball__') { snapshot(); S.ball=null; S.ballOwner=null; S.ballAttached=false; S.ballAssignCandidate=null; S.selected=null; applyBallOwnershipVisualState(); setHint('Ball removed from the board.'); }
  refreshInteractionUI();
  render();
}

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
  S.selected = annotationSelection(copy.id);
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
  S.passFrom = null;
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
  const lbl = S.animSpd + 'x';
  document.getElementById('spdLabel').textContent  = S.animSpd + 'x';
  document.getElementById('spdLabel2').textContent = S.animSpd + 'x';
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
  path:  'Run',
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
  const lbl = S.animSpd + 'x';
  document.getElementById('spdLabel').textContent  = lbl;
  document.getElementById('spdLabel2').textContent = lbl;
  [1, 1.5, 2, 3].forEach(v => {
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
  [1, 1.5, 2, 3].forEach(v => {
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

  ['move', 'run', 'pass', 'kick', 'zone', 'box', 'erase', 'note', 'arrow'].forEach(tool => {
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
  if (S.selected === '__ball__') {
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
  if (S.selected) {
    const pl = S.players.find(p => p.id === S.selected);
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
  if (!S.players.length && !S.ball && !S.annotations.length) return 'Add players from the left, place the ball, then choose how to build the picture.';
  if (S.dragging?.type === 'player') {
    const pl = S.players.find(p => p.id === S.dragging.id);
    return pl ? `Dragging ${pl.team==='A'?'Attack':'Defence'} #${pl.num}. Release to place.` : 'Dragging player.';
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
  if (S.passFrom) {
    const pl = S.players.find(p => p.id === S.passFrom);
    return pl ? `${MODE_LABELS[S.tool]} armed from ${pl.team==='A'?'Attack':'Defence'} #${pl.num}. Choose the target.` : 'Choose the target.';
  }
  if (S.annotationDraft) return `Drawing ${MODE_LABELS[S.annotationDraft.type] || 'annotation'}. Release to place it.`;
  if (S.selected === '__ball__') return 'Ball selected. Move it, or switch tools to build around it.';
  const ann = selectedAnnotation();
  if (ann) return `${MODE_LABELS[ann.type] || 'Annotation'} selected. Use Move to adjust it or Delete to remove it.`;
  if (S.selected) {
    const pl = S.players.find(p => p.id === S.selected);
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
  const count = sequenceStepCount();
  const owner = normalizePlayerRef(S.ballOwner);
  const ownerText = owner ? `Ball: ${owner.team === 'A' ? 'A' : 'D'} #${owner.num}` : (S.ball ? 'Ball: Loose' : 'Ball: Off board');
  const summary = `Mode: ${MODE_LABELS[S.tool] || 'Board'} · Step ${S.currentStep + 1} of ${count} · ${ownerText}`;
  if (mode) mode.textContent = MODE_LABELS[S.tool] || 'Board';
  if (text) text.textContent = summary;
  if (toolbarMode) toolbarMode.textContent = `Mode: ${MODE_LABELS[S.tool] || 'Board'}`;
  if (empty) empty.classList.toggle('hidden', !!S.players.length || !!S.ball || !!S.annotations.length);
  if (tutorial) tutorial.classList.toggle('hidden', !shouldShowFirstUseTutorial());
}

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
  if (kickStep1) kickStep1.classList.toggle('active', isKick && !S.passFrom);
  if (kickStep2) kickStep2.classList.toggle('active', isKick && !!S.passFrom);

  const isAnnotationTool = S.tool === 'note' || S.tool === 'arrow' || S.tool === 'zone' || S.tool === 'box';
  const defaultState = document.getElementById('spDefaultState');
  const hasSelection = !!S.selected || !!selectedAnnotationId();
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
  if (!ann) return;
  snapshot();
  ann.color = color;
  refreshInteractionUI();
  render();
}
window.setAnnotationColor = setAnnotationColor;

function refreshInteractionUI() {
  persistCurrentStep();
  updateSelInfo();
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
  if (t !== 'pass' && t !== 'kick') { S.passFrom=null; S.selected=null; }
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
  S.selected = null;
  S.selectedPassIdx = null;
  S.selectedPathPid = null;
  S.ballAssignCandidate = null;
  S.pointerTap = null;
  S.dragging = null;
  S.passFrom = null;
  S.drawing = null;
  S.annotationDraft = null;
  setHint('Selection cleared. Choose the next action.');
  updateAnnotationPanel();
  refreshInteractionUI();
  render();
}

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
  if (S.passFrom) {
    S.passFrom = null;
    S.selected = null;
    S.pointerTap = null;
    setHint(`${MODE_LABELS[S.tool] || 'Tool'} cancelled.`);
    refreshInteractionUI();
    render();
    return true;
  }
  if (S.selected || S.selectedPassIdx !== null || S.selectedPathPid !== null) {
    clearSelection();
    return true;
  }
  closeMobileToolsDropdown();
  return false;
}
function clearAll() {
  snapshot();
  S.players=[]; S.ball=null; S.ballOwner=null; S.ballAttached=false; S.paths=[]; S.passes=[];
  S.projectId = null;
  S.projectMeta = null;
  S.playMetadata = emptyPlayMetadata('New Play');
  S.projectPlayback = null;
  S.annotations = [];
  S.drawing=null; S.passFrom=null; S.annotationDraft=null; S.selected=null; S.ballAssignCandidate=null; S.selectedPathPid=null; S.selectedPassIdx=null;
  S.animT=0; S.animating=false;
  S.animSpd=1; spdIdx=2;
  S.steps=[emptyStepState()]; S.currentStep=0;
  S.atkUsed=new Set(); S.defUsed=new Set();
  document.getElementById('playName').value='New Play';
  setHint('Board reset. Start by adding players from the left.');
  document.getElementById('spdLabel').textContent = '1x';
  document.getElementById('spdLabel2').textContent = '1x';
  updateAnnotationPanel();
  document.getElementById('spdLabel').textContent = '1x';
  document.getElementById('spdLabel2').textContent = '1x';
  document.getElementById('spdLabel').textContent = '1x';
  document.getElementById('spdLabel2').textContent = '1x';
  setPlayBtnState(); rebuildPalette(); refreshInteractionUI(); updateTL(); render();
}

function updateSelInfo() {
  const box = document.getElementById('selInfo');
  const meta = document.getElementById('selMeta');
  const clearBtn = document.getElementById('selClearBtn');
  const deleteBtn = document.getElementById('selDeleteBtn');
  const giveBallBtn = document.getElementById('selGiveBallBtn');
  const editWrap = document.getElementById('selEditWrap');
  const editLabel = document.getElementById('selEditLabel');
  const noteInput = document.getElementById('selNoteInput');
  const summary = getSelectedSummary();
  const ann = selectedAnnotation();
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
    if (giveBallTarget) {
      giveBallBtn.textContent = `Give Ball to ${giveBallTarget.team === 'A' ? 'A' : 'D'} #${giveBallTarget.num}`;
    }
  }
  const colorPicker = document.getElementById('spColorPicker');
  if (colorPicker) {
    colorPicker.hidden = !ann;
    if (ann) {
      const currentColor = ann.color || annotationColor(ann.type);
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
  const hasAnySelection = !!S.selected || S.selectedPassIdx !== null || S.selectedPathPid !== null;
  if (deleteBtn) {
    if (S.selectedPathPid !== null) deleteBtn.textContent = 'Remove Run Path';
    else if (S.selectedPassIdx !== null) {
      const pass = S.passes[S.selectedPassIdx];
      deleteBtn.textContent = pass?.style === 'pass' ? 'Remove Pass' : 'Remove Kick';
    }
    else if (S.selected === '__ball__') deleteBtn.textContent = 'Remove Ball';
    else if (ann) deleteBtn.textContent = `Remove ${MODE_LABELS[ann.type] || 'Item'}`;
    else if (S.selected) {
      const pl = S.players.find(p => p.id === S.selected);
      deleteBtn.textContent = pl ? 'Remove from Field' : 'Remove Player';
    } else {
      deleteBtn.textContent = 'Remove Player';
    }
    deleteBtn.disabled = !hasAnySelection;
  }
  if (clearBtn) {
    clearBtn.textContent = hasAnySelection ? 'Clear Selection' : 'No Selection';
    clearBtn.disabled = !hasAnySelection;
  }
}

// Palette --------------------------------------------------
let palTab = 'atk';

function setTab(tab) {
  palTab = tab;
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
      const isSelected = !!existing && S.selected === existing.id;
      const btn = document.createElement('button');
      btn.className = `player-token ${key}${used.has(n) ? ' on' : ''}${isSelected ? ' active' : ''}`;
      btn.textContent = n;
      btn.title = used.has(n)
        ? `${isSelected ? 'Deselect' : 'Select'} ${team==='A'?'Attack':'Defence'} #${n}`
        : `Add ${team==='A'?'Attack':'Defence'} #${n}`;
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      btn.onclick = () => togglePalettePlayer(n, team);
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
  S.steps = Array.isArray(p.steps) && p.steps.length ? p.steps.map(step => normalizeStepState(step)) : [normalizeStepState(p)];
  S.currentStep = clamp(Number.isFinite(p.currentStepIndex) ? p.currentStepIndex : 0, 0, S.steps.length - 1);
  setLiveBoardFromStep(S.steps[S.currentStep]);
  S.animT = 0;
  S.animating = false;
  S.selected = null;
  S.drawing = null;
  S.annotationDraft = null;
  S.passFrom = null;
  S.projectId = p.id;
  S.projectMeta = p.metadata;
  S.playMetadata = normalizeProjectMetadata({ name: p.name }, p.metadata);
  S.projectPlayback = p.playback;
  S.animSpd = S.projectPlayback?.currentSpeed || 1;
  spdIdx = Math.max(0, SPEEDS.indexOf(S.animSpd));
  document.getElementById('playName').value = p.name || 'Untitled Play';
  syncPlayMetadataTitle();
  setPlayBtnState();
  document.getElementById('spdLabel').textContent = S.animSpd + 'x';
  document.getElementById('spdLabel2').textContent = S.animSpd + 'x';
  document.getElementById('spdLabel').textContent = S.animSpd + 'x';
  document.getElementById('spdLabel2').textContent = S.animSpd + 'x';
  document.getElementById('spdLabel').textContent = S.animSpd + 'x';
  document.getElementById('spdLabel2').textContent = S.animSpd + 'x';
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
    project,
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

function exportCurrentPlay() {
  exportPlayData(makeBoardData());
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
      const play = normalizeProjectRecord(raw);
      if (!play || !applyBoardData(play)) throw new Error('Invalid play payload');
      setHint(`Imported "${play.name || 'Untitled Play'}" from JSON.`);
      refreshInteractionUI();
    } catch {
      setHint('Import failed. Check the JSON structure and try again.');
      refreshInteractionUI();
    }
  };
  reader.readAsText(file);
}


document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const k = e.key.toLowerCase();
  const map = {v:'move',r:'run',p:'pass',k:'kick',e:'erase',c:'zone',b:'box'};
  if (map[k])           { setTool(map[k]); return; }
  if (k===' ')          { e.preventDefault(); togglePlay(); return; }
  if (k === 'arrowleft') { e.preventDefault(); prevStep(); return; }
  if (k === 'arrowright') { e.preventDefault(); nextStep(); return; }
  if (k==='escape')     { e.preventDefault(); cancelActiveBoardInteraction(); return; }
  if (k==='z'&&(e.ctrlKey||e.metaKey)) { e.preventDefault(); undo(); }
  if (k==='delete'||k==='backspace') {
    if (S.selected || selectedAnnotationId() || S.selectedPassIdx !== null || S.selectedPathPid !== null) {
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

//  INIT
rebuildPalette();
refreshSavedPlayList();
S.playMetadata = emptyPlayMetadata('New Play');
S.steps = [emptyStepState()];
S.currentStep = 0;
firstUseTutorialDismissed = hasSeenFirstUseTutorial();
updateAnnotationPanel();
updatePlayMetadataPanel();
document.getElementById('playName').addEventListener('input', () => {
  syncPlayMetadataTitle();
  refreshInteractionUI();
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
setHint('MOVE - drag any player or ball freely on the pitch');
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
