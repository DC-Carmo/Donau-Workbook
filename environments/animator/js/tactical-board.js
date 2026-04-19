// ════════════════════════════════════════════════════════════
//  RUGBY TACTICAL BOARD — Complete Implementation
//  Rugby Union Donau / Coach Mato Design Language
// ════════════════════════════════════════════════════════════

// ─── FIELD COORDINATE SYSTEM ───────────────────────────────
// Full field, portrait orientation
//   x: 0–68  (left touchline → right touchline, field width)
//   y: –10–110 (dead ball line top → dead ball line bottom)
//   y=0:  top try line     y=100: bottom try line
//   y=22: top 22m line     y=78:  bottom 22m line
//   y=10: top 10m          y=90:  bottom 10m
//   y=50: halfway line
//   Posts: x=34, y=0 (top) and x=34, y=100 (bottom)

const F = { // Field constants
  W: 68, IG: 10, LEN: 100,
  YMIN: -10, YMAX: 110,  // including in-goals
  XMIN: 0,   XMAX: 68,
  // Display bounds (with small margin)
  DX0: -1.5, DX1: 69.5,
  DY0: -12,  DY1: 112,
};
const FVW = F.DX1 - F.DX0; // 71
const FVH = F.DY1 - F.DY0; // 124

// Canvas scaling
let cvW=0, cvH=0, sc=1, ox=0, oy=0;
const cv  = document.getElementById('field');
const ctx = cv.getContext('2d');

function toC(fx, fy) { return { x: ox + (fx - F.DX0) * sc, y: oy + (fy - F.DY0) * sc }; }
function frC(cx, cy) { return { x: (cx - ox) / sc + F.DX0, y: (cy - oy) / sc + F.DY0 }; }
function d2(a, b)    { return Math.hypot(a.x - b.x, a.y - b.y); }

function resize() {
  const wrap = document.getElementById('canvasWrap');
  cvW = wrap.clientWidth; cvH = wrap.clientHeight;
  cv.width = cvW; cv.height = cvH;
  const pad = 20;
  const scX = (cvW - pad * 2) / FVW;
  const scY = (cvH - pad * 2) / FVH;
  sc = Math.min(scX, scY);
  ox = (cvW - FVW * sc) / 2;
  oy = (cvH - FVH * sc) / 2;
  render();
}

// ─── STATE ─────────────────────────────────────────────────
const S = {
  tool: 'move',
  tab:  'atk',          // active palette tab
  players: [],          // { id, num, team:'A'|'D', x, y, isBC:false }
  ball: null,           // { x, y }
  paths: [],            // { pid, pts:[{x,y}], color }
  passes: [],           // { from, to, style:'pass'|'kick' }
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
  nextId: 1,
  atkUsed: new Set(),   // which numbers are on field
  defUsed: new Set(),
};
const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3];
let   spdIdx = 2;
const SAVED_PLAYS_KEY = 'coachmato.animator.savedPlays.v1';

// ─── PLAYER RADIUS (px on canvas) ─────────────────────────
const R = () => Math.max(11, Math.min(18, sc * 1.3));

// ─── UNDO ──────────────────────────────────────────────────
function snapshot() {
  S.history.push(JSON.parse(JSON.stringify({
    players: S.players, ball: S.ball, paths: S.paths, passes: S.passes
  })));
  if (S.history.length > 30) S.history.shift();
}
function undo() {
  if (!S.history.length) return;
  const h = S.history.pop();
  S.players = h.players; S.ball = h.ball;
  S.paths = h.paths;     S.passes = h.passes;
  S.atkUsed = new Set(S.players.filter(p=>p.team==='A').map(p=>p.num));
  S.defUsed = new Set(S.players.filter(p=>p.team==='D').map(p=>p.num));
  S.selected = null;
  rebuildPalette(); refreshInteractionUI();
  render();
}

// ════════════════════════════════════════════════════════════
//  FIELD RENDERING
// ════════════════════════════════════════════════════════════
function drawField() {
  ctx.clearRect(0, 0, cvW, cvH);

  // Canvas bg
  const bgGrad = ctx.createLinearGradient(0, 0, 0, cvH);
  bgGrad.addColorStop(0, '#071018');
  bgGrad.addColorStop(1, '#0b1620');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, cvW, cvH);

  const TL = toC(0, F.YMIN), BR = toC(F.W, F.YMAX);
  const FW = BR.x - TL.x, FH = BR.y - TL.y;
  const fieldTop = toC(0, 0), fieldBottom = toC(F.W, 100);
  const mainFieldH = fieldBottom.y - fieldTop.y;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 28;
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(TL.x, TL.y, FW, FH);
  ctx.restore();

  const fieldGrad = ctx.createLinearGradient(TL.x, TL.y, BR.x, BR.y);
  fieldGrad.addColorStop(0, '#184d28');
  fieldGrad.addColorStop(0.45, '#1f6930');
  fieldGrad.addColorStop(1, '#184726');
  ctx.fillStyle = fieldGrad;
  ctx.fillRect(TL.x, TL.y, FW, FH);

  const playGrad = ctx.createLinearGradient(fieldTop.x, fieldTop.y, fieldBottom.x, fieldBottom.y);
  playGrad.addColorStop(0, 'rgba(60,150,82,0.18)');
  playGrad.addColorStop(0.5, 'rgba(255,255,255,0.03)');
  playGrad.addColorStop(1, 'rgba(31,94,52,0.16)');
  ctx.fillStyle = playGrad;
  ctx.fillRect(fieldTop.x, fieldTop.y, FW, mainFieldH);

  // ── Grass bands ──────────────────────────────────────────
  const nBands = 14;
  for (let i = 0; i < nBands; i++) {
    const fy0 = F.YMIN + (F.YMAX - F.YMIN) / nBands * i;
    const fy1 = F.YMIN + (F.YMAX - F.YMIN) / nBands * (i + 1);
    const p0 = toC(0, fy0), p1 = toC(68, fy1);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.032)' : 'rgba(0,0,0,0.045)';
    ctx.fillRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y + 1);
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  for (let x = TL.x + 8; x < BR.x; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, TL.y);
    ctx.lineTo(x, BR.y);
    ctx.stroke();
  }
  ctx.restore();

  // ── In-goal tints ────────────────────────────────────────
  const igTop = toC(0, F.YMIN), igTopEnd = toC(68, 0);
  const igGradTop = ctx.createLinearGradient(0, igTop.y, 0, igTopEnd.y);
  igGradTop.addColorStop(0, 'rgba(10,23,34,0.55)');
  igGradTop.addColorStop(1, 'rgba(255,255,255,0.04)');
  ctx.fillStyle = igGradTop;
  ctx.fillRect(igTop.x, igTop.y, FW, igTopEnd.y - igTop.y);

  const igBot = toC(0, 100), igBotEnd = toC(68, F.YMAX);
  const igGradBot = ctx.createLinearGradient(0, igBot.y, 0, igBotEnd.y);
  igGradBot.addColorStop(0, 'rgba(255,255,255,0.04)');
  igGradBot.addColorStop(1, 'rgba(10,23,34,0.55)');
  ctx.fillStyle = igGradBot;
  ctx.fillRect(igBot.x, igBot.y, FW, igBotEnd.y - igBot.y);

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(TL.x, TL.y, FW, FH);
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.strokeRect(fieldTop.x, fieldTop.y, FW, mainFieldH);
  ctx.restore();

  // ── Helper: horizontal line ──────────────────────────────
  function hline(fy, color, lw, dash = []) {
    const p = toC(0, fy), q = toC(68, fy);
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.setLineDash(dash); ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Dead ball lines
  hline(F.YMIN, 'rgba(255,255,255,0.18)', 1.2);
  hline(F.YMAX, 'rgba(255,255,255,0.18)', 1.2);
  // Try lines
  hline(0,   'rgba(255,255,255,0.98)', 2.8);
  hline(100, 'rgba(255,255,255,0.98)', 2.8);
  // 22m lines
  hline(22, 'rgba(255,255,255,0.72)', 1.9);
  hline(78, 'rgba(255,255,255,0.72)', 1.9);
  // 10m lines (dashed)
  hline(10, 'rgba(255,255,255,0.4)', 1.5, [sc * 0.7, sc * 0.55]);
  hline(90, 'rgba(255,255,255,0.4)', 1.5, [sc * 0.7, sc * 0.55]);
  // Halfway
  hline(50, 'rgba(255,255,255,0.88)', 2.2);

  // Touchlines
  function vline(fx, color, lw, fy0 = F.YMIN, fy1 = F.YMAX) {
    const p = toC(fx, fy0), q = toC(fx, fy1);
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    ctx.restore();
  }
  vline(0,  'rgba(255,255,255,0.72)', 2.2);
  vline(68, 'rgba(255,255,255,0.72)', 2.2);

  // ── Tick marks ───────────────────────────────────────────
  function ticks(fy, color) {
    // 5m marks at 5, 15, 53, 63 (5m and 15m from each touchline)
    [5, 15, 53, 63].forEach(fx => {
      const p = toC(fx, fy);
      const d = 3.5 * sc;
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - d); ctx.lineTo(p.x, p.y + d); ctx.stroke();
      ctx.restore();
    });
  }
  [0, 10, 22, 50, 78, 90, 100].forEach(fy => {
    ticks(fy, 'rgba(255,255,255,0.42)');
  });

  // Touchline ticks at major lines
  [5, 10, 22, 50, 78, 90, 95].forEach(fy => {
    const tl = toC(0, fy), tr = toC(68, fy);
    const tLen = 4 * sc;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(tl.x + tLen, tl.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x - tLen, tr.y); ctx.stroke();
    ctx.restore();
  });

  // Centre spot + circle
  const hw = toC(34, 50);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
  ctx.setLineDash([sc * 0.5, sc * 0.5]);
  ctx.beginPath(); ctx.arc(hw.x, hw.y, 10 * sc, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(hw.x, hw.y, 2, 0, Math.PI * 2); ctx.fill();

  // ── Field labels ─────────────────────────────────────────
  drawFieldLabel(34, -5, 'IN-GOAL', true);
  drawFieldLabel(34, 105, 'IN-GOAL', true);
  drawFieldLabel(34, 50, 'HALFWAY');
  drawFieldLabel(4.6, 22, '22');
  drawFieldLabel(63.4, 22, '22');
  drawFieldLabel(4.6, 78, '22');
  drawFieldLabel(63.4, 78, '22');
  drawFieldLabel(4.8, 10, '10');
  drawFieldLabel(63.2, 10, '10');
  drawFieldLabel(4.8, 90, '10');
  drawFieldLabel(63.2, 90, '10');
  drawFieldLabel(4.4, 0, 'TRY');
  drawFieldLabel(63.6, 0, 'TRY');
  drawFieldLabel(4.4, 100, 'TRY');
  drawFieldLabel(63.6, 100, 'TRY');

  // ── Goal posts ───────────────────────────────────────────
  drawPosts(34, 0,   'top');
  drawPosts(34, 100, 'bot');
}

function drawPosts(fx, fy, side) {
  const base = toC(fx, fy);
  const halfW = 2.8 * sc;   // 5.6m between posts
  const crossH = sc * 1.4;  // crossbar height above try line
  const postH  = sc * 4.5;  // total post height
  const dir    = side === 'top' ? -1 : 1; // top posts go up (toward in-goal top)

  ctx.save();
  ctx.strokeStyle = 'rgba(252,252,252,0.92)';
  ctx.lineWidth = Math.max(2, sc * 0.2);
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 5;

  // Base stump
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(base.x, base.y + dir * crossH);
  ctx.stroke();
  // Crossbar
  ctx.beginPath();
  ctx.moveTo(base.x - halfW, base.y + dir * crossH);
  ctx.lineTo(base.x + halfW, base.y + dir * crossH);
  ctx.stroke();
  // Left post
  ctx.beginPath();
  ctx.moveTo(base.x - halfW, base.y + dir * crossH);
  ctx.lineTo(base.x - halfW, base.y + dir * postH);
  ctx.stroke();
  // Right post
  ctx.beginPath();
  ctx.moveTo(base.x + halfW, base.y + dir * crossH);
  ctx.lineTo(base.x + halfW, base.y + dir * postH);
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

// ════════════════════════════════════════════════════════════
//  PLAYER RENDERING
// ════════════════════════════════════════════════════════════
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

  // Glow for ball carrier
  if (isBallCarrier) {
    ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(251,191,36,0.3)'; ctx.lineWidth = 2;
    ctx.stroke(); ctx.shadowBlur = 0;
  }
  // Selection ring
  if (selected) {
    ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5;
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
  ctx.lineWidth   = selected ? 2.5 : 1.8;
  ctx.stroke();

  // Number
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.max(8, r * 0.78)}px "Barlow Condensed"`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowBlur = 0;
  ctx.fillText(String(num), p.x, p.y + 0.5);

  // Ball carrier tag
  if (isBallCarrier) {
    const bx = p.x + r * 0.65, by = p.y - r * 0.65;
    ctx.beginPath(); ctx.arc(bx, by, r * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24'; ctx.fill();
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 1; ctx.stroke();
  }

  ctx.restore();
}

// ─── Draw rugby ball ────────────────────────────────────────
function drawBall(fx, fy, selected) {
  const p = toC(fx, fy);
  const rx = Math.max(7, sc * 0.7), ry = Math.max(4.5, sc * 0.44);
  ctx.save();
  if (selected) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 14; }

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

// ─── Helpers ────────────────────────────────────────────────
function lighten(hex, amt) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, ((n>>16)&0xff) + amt);
  const g = Math.min(255, ((n>>8)&0xff) + amt);
  const b = Math.min(255, (n&0xff) + amt);
  return `rgb(${r},${g},${b})`;
}

// ════════════════════════════════════════════════════════════
//  PATH RENDERING
// ════════════════════════════════════════════════════════════
function drawRunPath(pts, color, lw, progress = 1, dashed = false) {
  if (!pts || pts.length < 2) return;
  ctx.save();

  const STEPS = Math.max(40, pts.length * 12);
  const drawSteps = Math.floor(progress * STEPS);

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

// ─── Pass/kick arc ──────────────────────────────────────────
function drawArc(x1, y1, x2, y2, color, progress = 1, thick = false) {
  const p1 = toC(x1, y1), p2 = toC(x2, y2);
  const dist = Math.hypot(p2.x-p1.x, p2.y-p1.y);
  const cpx  = (p1.x+p2.x)/2 - (p2.y-p1.y)*0.28;
  const cpy  = (p1.y+p2.y)/2 + (p2.x-p1.x)*0.28;
  const STEPS = 30;

  ctx.save();
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

// ════════════════════════════════════════════════════════════
//  MAIN RENDER
// ════════════════════════════════════════════════════════════
function render() {
  drawField();

  const t = S.animT;

  // ── Completed passes ────────────────────────────────────
  S.passes.forEach(pass => {
    const fp = S.players.find(p => p.id === pass.from);
    const tp = S.players.find(p => p.id === pass.to);
    if (!fp || !tp) return;
    const fa = animPos(fp, t), ta = animPos(tp, t);
    const col = pass.style === 'kick' ? '#f59e0b' : 'rgba(255,255,255,0.75)';
    drawArc(fa.x, fa.y, ta.x, ta.y, col, 1, pass.style === 'kick');
  });

  // ── Run paths ────────────────────────────────────────────
  S.paths.forEach(path => {
    if (path.pts.length < 2) return;
    drawRunPath(path.pts, path.color, 2.8, t > 0 ? t : 1);
  });

  // ── Freehand draw preview ────────────────────────────────
  if (S.drawing && S.drawing.pts.length >= 2) {
    const pl  = S.players.find(p => p.id === S.drawing.pid);
    const col = pl?.team === 'A' ? 'rgba(96,165,250,0.7)' : 'rgba(248,113,113,0.7)';
    drawRunPath(S.drawing.pts, col, 2.2, 1, true);
  }

  // ── Pass-from indicator ──────────────────────────────────
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

  // ── Ball ─────────────────────────────────────────────────
  if (S.ball) {
    drawBall(S.ball.x, S.ball.y, S.selected === '__ball__');
  }

  // ── Players ──────────────────────────────────────────────
  S.players.forEach(pl => {
    const pos = animPos(pl, t);
    const sel = S.selected === pl.id;
    drawPlayer(pos.x, pos.y, pl.num, pl.team, sel, pl.isBC);
  });
}

// ─── Catmull-Rom position at t ──────────────────────────────
function animPos(pl, t) {
  const path = S.paths.find(p => p.pid === pl.id);
  if (!path || path.pts.length < 2 || t === 0) return { x:pl.x, y:pl.y };
  return catmullRom(path.pts, t);
}

// ════════════════════════════════════════════════════════════
//  MOUSE HANDLING
// ════════════════════════════════════════════════════════════
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

cv.addEventListener('mousedown', e => {
  const fp = getF(e);

  if (S.tool === 'move') {
    const pl = hitPlayer(fp);
    if (pl) {
      snapshot();
      S.selected = pl.id;
      S.dragging  = { type:'player', id:pl.id };
      S.dragOff   = { x:fp.x - pl.x, y:fp.y - pl.y };
    } else if (hitBall(fp)) {
      snapshot();
      S.selected = '__ball__';
      S.dragging  = { type:'ball' };
      S.dragOff   = { x:fp.x - S.ball.x, y:fp.y - S.ball.y };
    } else {
      S.selected = null;
    }
    refreshInteractionUI(); render();
  }

  else if (S.tool === 'path') {
    const pl = hitPlayer(fp);
    if (pl) {
      S.drawing = { pid:pl.id, pts:[{x:pl.x, y:pl.y}], last:{x:fp.x, y:fp.y} };
      S.selected = pl.id;
      setHint('Draw the run path, then release to finish.');
      refreshInteractionUI();
    }
  }

  else if (S.tool === 'pass' || S.tool === 'kick') {
    const pl = hitPlayer(fp);
    if (pl) {
      if (!S.passFrom) {
        S.passFrom = pl.id; S.selected = pl.id;
        setHint(`${S.tool === 'kick' ? 'Kick' : 'Pass'} armed from #${pl.num}. Choose the target.`);
        refreshInteractionUI();
      } else if (pl.id !== S.passFrom) {
        snapshot();
        const dup = S.passes.find(p => p.from === S.passFrom && p.to === pl.id);
        if (!dup) S.passes.push({ from:S.passFrom, to:pl.id, style:S.tool });
        S.passFrom = null; S.selected = null;
        setHint(S.tool === 'pass' ? 'Pass complete. Choose the next action.' : 'Kick complete. Choose the next action.');
        refreshInteractionUI();
      } else {
        S.passFrom = null; S.selected = null;
        setHint(HINTS[S.tool] || '');
        refreshInteractionUI();
      }
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
    } else {
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
    render();
  }
});

cv.addEventListener('mousemove', e => {
  const fp = getF(e);

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
      }
    } else if (S.dragging.type === 'ball' && S.ball) {
      S.ball.x = clamp(fp.x - S.dragOff.x, -2, 70);
      S.ball.y = clamp(fp.y - S.dragOff.y, -11, 111);
    }
    render(); return;
  }

  // Freehand draw
  if (S.drawing && S.tool === 'path') {
    if (d2(fp, S.drawing.last) > 1.2) {
      S.drawing.pts.push({x:fp.x, y:fp.y});
      S.drawing.last = {x:fp.x, y:fp.y};
      render();
    }
    return;
  }

  // Cursor
  const pl = hitPlayer(fp), bl = hitBall(fp);
  if      (S.tool === 'move')  cv.style.cursor = (pl||bl) ? 'grab' : 'default';
  else if (S.tool === 'erase') cv.style.cursor = 'crosshair';
  else if (S.tool === 'path')  cv.style.cursor = pl ? 'crosshair' : 'default';
  else                          cv.style.cursor = pl ? 'pointer' : 'default';
});

cv.addEventListener('mouseup', () => {
  if (S.dragging) { S.dragging = null; render(); }
  if (S.drawing && S.tool === 'path') finishDraw();
});
cv.addEventListener('mouseleave', () => {
  if (S.dragging) S.dragging = null;
  if (S.drawing)  finishDraw();
});

// ─── Finish freehand draw ────────────────────────────────────
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

// ════════════════════════════════════════════════════════════
//  PLAYER MANAGEMENT
// ════════════════════════════════════════════════════════════
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
  rebuildPalette(); setTool('move'); setHint(`${team === 'A' ? 'Attack' : 'Defence'} #${num} added. Drag to position.`); refreshInteractionUI(); render();
}

function addBall() {
  if (!S.ball) snapshot();
  S.ball = { x:34, y:50 };
  setTool('move'); setHint('Ball placed. Drag it to the right spot.'); refreshInteractionUI(); render();
}

function removePlayer(id) {
  const pl = S.players.find(p => p.id === id);
  if (!pl) return;
  if (pl.team === 'A') S.atkUsed.delete(pl.num);
  else                  S.defUsed.delete(pl.num);
  S.players = S.players.filter(p => p.id !== id);
  S.paths   = S.paths.filter(p => p.pid !== id);
  S.passes  = S.passes.filter(p => p.from!==id && p.to!==id);
  if (S.selected === id) S.selected = null;
  setHint(`${pl.team === 'A' ? 'Attack' : 'Defence'} #${pl.num} removed. That number is available again.`);
  rebuildPalette(); refreshInteractionUI(); render();
}

function deleteSelected() {
  if (S.selected && S.selected !== '__ball__') removePlayer(S.selected);
  else if (S.selected === '__ball__') { snapshot(); S.ball=null; S.selected=null; setHint('Ball removed from the board.'); }
  refreshInteractionUI();
  render();
}

// ════════════════════════════════════════════════════════════
//  ANIMATION
// ════════════════════════════════════════════════════════════
function togglePlay() {
  if (S.animT >= 1) S.animT = 0;
  S.animating = !S.animating;
  const isPlay = S.animating;
  document.getElementById('playBtn').textContent   = isPlay ? '⏸ Pause' : '▶ Play';
  document.getElementById('tlPlayBtn').textContent = isPlay ? '⏸' : '▶';
  if (isPlay) { S.lastTs = null; requestAnimationFrame(animLoop); }
}
function animLoop(ts) {
  if (!S.animating) return;
  const DUR = 5;
  if (S.lastTs !== null) {
    S.animT = Math.min(1, S.animT + (ts - S.lastTs) / 1000 * S.animSpd / DUR);
    if (S.animT >= 1) { S.animT=1; S.animating=false; setPlayBtnState(); }
  }
  S.lastTs = ts;
  render(); updateTL();
  if (S.animating) requestAnimationFrame(animLoop);
}
function setPlayBtnState() {
  const lbl = S.animating ? '⏸' : '▶';
  document.getElementById('playBtn').textContent   = S.animating ? '⏸ Pause' : '▶ Play';
  document.getElementById('tlPlayBtn').textContent = lbl;
}
function resetAnim() {
  S.animating=false; S.animT=0; S.lastTs=null;
  setPlayBtnState(); render(); updateTL();
}
function chSpd(d) {
  spdIdx = clamp(spdIdx+d, 0, SPEEDS.length-1);
  S.animSpd = SPEEDS[spdIdx];
  const lbl = S.animSpd + '×';
  document.getElementById('spdLabel').textContent  = lbl;
  document.getElementById('spdLabel2').textContent = lbl;
}
function updateTL() {
  const pct = S.animT * 100;
  document.getElementById('trackFill').style.width = pct + '%';
  document.getElementById('trackThumb').style.left = pct + '%';
  document.getElementById('tlTime').textContent = `${(S.animT*5).toFixed(1)} / 5.0s`;
}
function seekTrack(e) {
  const r = document.getElementById('track').getBoundingClientRect();
  S.animT = clamp((e.clientX-r.left)/r.width, 0, 1);
  updateTL(); render();
}

// ════════════════════════════════════════════════════════════
//  UI
// ════════════════════════════════════════════════════════════
const HINTS = {
  move:  'MOVE — drag any player or ball freely',
  path:  'PATH — click a player and drag to draw their run',
  pass:  'PASS — click passer, then click receiver',
  kick:  'KICK — click kicker, then click target',
  erase: 'ERASE — click player, ball, or path to remove',
};

const MODE_LABELS = {
  move: 'Move',
  path: 'Run Path',
  pass: 'Pass',
  kick: 'Kick',
  erase: 'Erase',
};

function getSelectedSummary() {
  if (S.selected === '__ball__') {
    return { title: 'Ball Selected', meta: 'Drag the ball to a new spot or remove it from the board.' };
  }
  if (S.selected) {
    const pl = S.players.find(p => p.id === S.selected);
    if (pl) {
      return {
        title: `${pl.team==='A'?'Attack':'Defence'} #${pl.num}`,
        meta: S.tool === 'move'
          ? 'Selected and ready to move. Drag on the field to reposition.'
          : `Selected for ${MODE_LABELS[S.tool] || 'interaction'}.`,
      };
    }
  }
  return { title: '-', meta: 'Select a player or ball to inspect it here.' };
}

function getStatusMessage() {
  if (!S.players.length && !S.ball) return 'Add players from the left, place the ball, then choose how to build the picture.';
  if (S.dragging?.type === 'player') {
    const pl = S.players.find(p => p.id === S.dragging.id);
    return pl ? `Dragging ${pl.team==='A'?'Attack':'Defence'} #${pl.num}. Release to place.` : 'Dragging player.';
  }
  if (S.dragging?.type === 'ball') return 'Dragging the ball. Release to place it.';
  if (S.drawing) {
    const pl = S.players.find(p => p.id === S.drawing.pid);
    return pl ? `Drawing run for ${pl.team==='A'?'Attack':'Defence'} #${pl.num}. Release to finish.` : 'Drawing run path.';
  }
  if (S.passFrom) {
    const pl = S.players.find(p => p.id === S.passFrom);
    return pl ? `${MODE_LABELS[S.tool]} armed from ${pl.team==='A'?'Attack':'Defence'} #${pl.num}. Choose the target.` : 'Choose the target.';
  }
  if (S.selected === '__ball__') return 'Ball selected. Move it, or switch tools to build around it.';
  if (S.selected) {
    const pl = S.players.find(p => p.id === S.selected);
    return pl ? `${pl.team==='A'?'Attack':'Defence'} #${pl.num} selected.` : 'Selection active.';
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
  if (ballStatus) ballStatus.textContent = S.ball ? 'Placed' : 'Not Placed';
  if (palCopy) palCopy.textContent = `${activeLabel} numbers ready to place. Used numbers stay dimmed until removed.`;
}

function updateBoardStatus() {
  const mode = document.getElementById('boardModeLabel');
  const text = document.getElementById('boardStatusText');
  const empty = document.getElementById('emptyState');
  if (mode) mode.textContent = MODE_LABELS[S.tool] || 'Board';
  if (text) text.textContent = getStatusMessage();
  if (empty) empty.classList.toggle('hidden', !!S.players.length || !!S.ball);
}

function refreshInteractionUI() {
  updateSelInfo();
  updatePaletteSummary();
  updateBoardStatus();
}

function setTool(t) {
  S.tool = t;
  if (t !== 'path')          S.drawing = null;
  if (t !== 'pass' && t !== 'kick') { S.passFrom=null; S.selected=null; }
  document.querySelectorAll('.t-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('t-' + t);
  if (el) el.classList.add('active');
  cv.style.cursor = t === 'move' ? 'default' : 'crosshair';
  setHint(HINTS[t] || '');
  refreshInteractionUI();
  render();
}
function setHint(txt) { document.getElementById('hint').textContent = txt; }

function clearPaths()  { snapshot(); S.paths=[]; S.passes=[]; S.drawing=null; setHint('Paths cleared. Choose the next action.'); refreshInteractionUI(); render(); }
function clearSelection() {
  S.selected = null;
  S.passFrom = null;
  S.drawing = null;
  setHint('Selection cleared. Choose the next action.');
  refreshInteractionUI();
  render();
}
function clearAll() {
  snapshot();
  S.players=[]; S.ball=null; S.paths=[]; S.passes=[];
  S.drawing=null; S.passFrom=null; S.selected=null;
  S.animT=0; S.animating=false;
  S.atkUsed=new Set(); S.defUsed=new Set();
  document.getElementById('playName').value='New Play';
  setHint('Board reset. Start by adding players from the left.');
  setPlayBtnState(); rebuildPalette(); refreshInteractionUI(); updateTL(); render();
}

function updateSelInfo() {
  const box = document.getElementById('selInfo');
  const meta = document.getElementById('selMeta');
  const clearBtn = document.getElementById('selClearBtn');
  const deleteBtn = document.getElementById('selDeleteBtn');
  const summary = getSelectedSummary();
  document.getElementById('selName').textContent = summary.title;
  if (meta) meta.textContent = summary.meta;
  box.classList.toggle('visible', summary.title !== '-');
  if (clearBtn) clearBtn.textContent = S.selected ? 'Clear Selection' : 'No Selection';
  if (clearBtn) clearBtn.disabled = !S.selected;
  if (deleteBtn) {
    if (S.selected === '__ball__') deleteBtn.textContent = 'Remove Ball';
    else if (S.selected) {
      const pl = S.players.find(p => p.id === S.selected);
      deleteBtn.textContent = pl ? `Remove ${pl.team==='A'?'Attack':'Defence'} #${pl.num}` : 'Remove Player';
    } else {
      deleteBtn.textContent = 'Remove Player';
    }
    deleteBtn.disabled = !S.selected;
  }
}

// ─── Palette ─────────────────────────────────────────────────
let palTab = 'atk';

function setTab(tab) {
  palTab = tab;
  document.querySelectorAll('.pal-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  rebuildPalette();
  refreshInteractionUI();
}

function rebuildPalette() {
  const grid = document.getElementById('palGrid');
  grid.innerHTML = '';
  const team = palTab === 'atk' ? 'A' : 'D';
  const used  = palTab === 'atk' ? S.atkUsed : S.defUsed;
  for (let n=1; n<=15; n++) {
    const btn = document.createElement('button');
    btn.className = `pal-btn ${palTab}${used.has(n)?' on':''}`;
    btn.textContent = n;
    btn.title = used.has(n)
      ? `${team==='A'?'Attack':'Defence'} #${n} is already on the board`
      : `Add ${team==='A'?'Attack':'Defence'} #${n}`;
    if (!used.has(n)) btn.onclick = () => addPlayerByNum(n, team);
    grid.appendChild(btn);
  }
  updatePaletteSummary();
}

function makeBoardData(nameOverride) {
  return {
    id: `saved_${Date.now()}`,
    name: nameOverride || document.getElementById('playName').value.trim() || 'Untitled Play',
    cat: 'Saved Board',
    players: S.players.map(({ num, team, x, y }) => ({ num, team, x, y })),
    ball: S.ball ? { ...S.ball } : null,
    paths: S.paths.map(path => {
      const pl = S.players.find(q => q.id === path.pid);
      return pl ? { num: pl.num, team: pl.team, pts: path.pts.map(pt => ({ ...pt })) } : null;
    }).filter(Boolean),
    passes: S.passes.map(pass => {
      const from = S.players.find(q => q.id === pass.from);
      const to = S.players.find(q => q.id === pass.to);
      return from && to ? {
        fromNum: from.num,
        fromT: from.team,
        toNum: to.num,
        toT: to.team,
        style: pass.style,
      } : null;
    }).filter(Boolean),
  };
}

function applyBoardData(play, { snapshotBefore = true } = {}) {
  if (!play || !Array.isArray(play.players)) return false;
  if (snapshotBefore) snapshot();

  const p = JSON.parse(JSON.stringify(play));
  S.players = p.players.map(pl => ({ ...pl, id: S.nextId++, isBC: false }));
  S.atkUsed = new Set(S.players.filter(pl => pl.team === 'A').map(pl => pl.num));
  S.defUsed = new Set(S.players.filter(pl => pl.team === 'D').map(pl => pl.num));
  S.ball = p.ball || null;
  S.animT = 0;
  S.animating = false;
  S.selected = null;
  S.drawing = null;
  S.passFrom = null;

  S.paths = (p.paths || []).map(path => {
    const pl = S.players.find(q => q.num === path.num && q.team === path.team);
    const col = path.team === 'A' ? '#60a5fa' : '#f87171';
    return { pid: pl?.id, pts: path.pts || [], color: col };
  }).filter(item => item.pid !== undefined);

  S.passes = (p.passes || []).map(pass => {
    const fp = S.players.find(q => q.num === pass.fromNum && q.team === pass.fromT);
    const tp = S.players.find(q => q.num === pass.toNum && q.team === pass.toT);
    return fp && tp ? { from: fp.id, to: tp.id, style: pass.style } : null;
  }).filter(Boolean);

  document.getElementById('playName').value = play.name || 'Untitled Play';
  setPlayBtnState();
  rebuildPalette();
  refreshInteractionUI();
  updateTL();
  render();
  setTool('move');
  return true;
}

function getSavedPlays() {
  try {
    const raw = localStorage.getItem(SAVED_PLAYS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
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
  const entry = { ...board, savedAt: new Date().toISOString() };
  const withoutSameName = saved.filter(item => item.name !== entry.name);
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
        <div class="saved-play-meta">${savedDate}<br>${item.players?.length || 0} players · ${(item.paths||[]).length} paths · ${(item.passes||[]).length} passes</div>
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
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    play,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = (play.name || 'untitled-play').replace(/[^\w-]+/g, '_');
  link.href = url;
  link.download = `${safeName}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setHint(`Exported "${play.name}" as JSON.`);
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
      const play = raw?.play || raw;
      if (!applyBoardData(play)) throw new Error('Invalid play payload');
      setHint(`Imported "${play.name || 'Untitled Play'}" from JSON.`);
      refreshInteractionUI();
    } catch {
      setHint('Import failed. Check the JSON structure and try again.');
      refreshInteractionUI();
    }
  };
  reader.readAsText(file);
}

// ─── Pre-built Plays ──────────────────────────────────────────
const PLAYS = [
  {
    id:'launch_fly', name:'Scrum — Launch Fly', cat:'Attack · Scrum',
    players:[
      {num:1,team:'A',x:31,y:61},{num:2,team:'A',x:34,y:61},{num:3,team:'A',x:37,y:61},
      {num:4,team:'A',x:32,y:63},{num:5,team:'A',x:36,y:63},{num:6,team:'A',x:28,y:64},
      {num:7,team:'A',x:40,y:64},{num:8,team:'A',x:34,y:66},{num:9,team:'A',x:38,y:68},
      {num:10,team:'A',x:46,y:72},{num:11,team:'A',x:8,y:68},{num:12,team:'A',x:54,y:74},
      {num:13,team:'A',x:58,y:77},{num:14,team:'A',x:62,y:68},{num:15,team:'A',x:34,y:78},
      {num:9,team:'D',x:40,y:69},{num:10,team:'D',x:48,y:74},
      {num:12,team:'D',x:56,y:77},{num:13,team:'D',x:62,y:80},
    ],
    ball:{x:34,y:66},
    paths:[
      {num:8,team:'A',  pts:[{x:34,y:66},{x:34,y:62},{x:35,y:59}]},
      {num:9,team:'A',  pts:[{x:38,y:68},{x:40,y:66},{x:44,y:64}]},
      {num:10,team:'A', pts:[{x:46,y:72},{x:48,y:70},{x:56,y:65}]},
      {num:12,team:'A', pts:[{x:54,y:74},{x:56,y:71},{x:62,y:66}]},
      {num:11,team:'A', pts:[{x:8,y:68},{x:12,y:65},{x:18,y:62}]},
      {num:15,team:'A', pts:[{x:34,y:78},{x:38,y:74},{x:46,y:70}]},
    ],
    passes:[{fromNum:8,fromT:'A',toNum:9,toT:'A',style:'pass'},{fromNum:9,fromT:'A',toNum:10,toT:'A',style:'pass'}],
  },
  {
    id:'counter', name:'Counter Attack', cat:'Transition',
    players:[
      {num:15,team:'A',x:34,y:28},{num:11,team:'A',x:10,y:35},{num:14,team:'A',x:58,y:35},
      {num:9,team:'A',x:34,y:44},{num:10,team:'A',x:26,y:52},{num:12,team:'A',x:20,y:58},
      {num:13,team:'A',x:14,y:64},{num:8,team:'A',x:32,y:50},{num:6,team:'A',x:36,y:47},
      {num:10,team:'D',x:26,y:60},{num:12,team:'D',x:20,y:66},{num:13,team:'D',x:14,y:72},
      {num:9,team:'D',x:32,y:58},{num:15,team:'D',x:34,y:72},
    ],
    ball:{x:34,y:28},
    paths:[
      {num:15,team:'A',pts:[{x:34,y:28},{x:32,y:36},{x:30,y:42}]},
      {num:11,team:'A',pts:[{x:10,y:35},{x:14,y:42},{x:20,y:48}]},
      {num:9,team:'A', pts:[{x:34,y:44},{x:32,y:52},{x:28,y:58}]},
      {num:10,team:'A',pts:[{x:26,y:52},{x:24,y:58},{x:20,y:64}]},
      {num:8,team:'A', pts:[{x:32,y:50},{x:30,y:57},{x:28,y:62}]},
    ],
    passes:[{fromNum:15,fromT:'A',toNum:9,toT:'A',style:'pass'},{fromNum:9,fromT:'A',toNum:10,toT:'A',style:'pass'}],
  },
  {
    id:'hammer_def', name:'Defence — HAMMER', cat:'Defence · Blitz',
    players:[
      {num:9,team:'A',x:34,y:57},{num:10,team:'A',x:26,y:63},{num:12,team:'A',x:18,y:67},
      {num:13,team:'A',x:12,y:71},{num:11,team:'A',x:6,y:67},{num:14,team:'A',x:60,y:67},
      {num:15,team:'A',x:52,y:60},{num:8,team:'A',x:34,y:61},
      {num:14,team:'D',x:62,y:54},{num:13,team:'D',x:54,y:58},{num:12,team:'D',x:46,y:58},
      {num:10,team:'D',x:38,y:58},{num:9,team:'D',x:30,y:56},{num:11,team:'D',x:18,y:58},
      {num:7,team:'D',x:32,y:60},{num:6,team:'D',x:36,y:63},{num:8,team:'D',x:34,y:58},
    ],
    ball:{x:34,y:57},
    paths:[
      {num:14,team:'D',pts:[{x:62,y:54},{x:55,y:59}]},
      {num:13,team:'D',pts:[{x:54,y:58},{x:47,y:63}]},
      {num:12,team:'D',pts:[{x:46,y:58},{x:39,y:63}]},
      {num:10,team:'D',pts:[{x:38,y:58},{x:31,y:63}]},
      {num:9,team:'D', pts:[{x:30,y:56},{x:23,y:61}]},
      {num:11,team:'D',pts:[{x:18,y:58},{x:11,y:63}]},
      {num:7,team:'D', pts:[{x:32,y:60},{x:25,y:65}]},
      {num:6,team:'D', pts:[{x:36,y:63},{x:29,y:68}]},
    ],
    passes:[],
  },
  {
    id:'lineout_maul', name:'Lineout — Maul Drive', cat:'Attack · Set Piece',
    players:[
      {num:2,team:'A',x:2,y:82},{num:4,team:'A',x:2,y:86},{num:5,team:'A',x:2,y:90},
      {num:6,team:'A',x:2,y:94},{num:1,team:'A',x:2,y:78},{num:3,team:'A',x:2,y:98},
      {num:7,team:'A',x:2,y:102},{num:8,team:'A',x:5,y:104},{num:9,team:'A',x:10,y:96},
      {num:10,team:'A',x:20,y:92},{num:11,team:'A',x:18,y:84},{num:12,team:'A',x:28,y:96},
      {num:13,team:'A',x:34,y:100},{num:14,team:'A',x:50,y:92},{num:15,team:'A',x:40,y:94},
      {num:1,team:'D',x:8,y:85},{num:2,team:'D',x:8,y:90},{num:3,team:'D',x:8,y:95},
      {num:4,team:'D',x:8,y:99},
    ],
    ball:{x:2,y:82},
    paths:[
      {num:4,team:'A',pts:[{x:2,y:86},{x:6,y:87},{x:10,y:88}]},
      {num:5,team:'A',pts:[{x:2,y:90},{x:6,y:91},{x:10,y:92}]},
      {num:6,team:'A',pts:[{x:2,y:94},{x:6,y:95},{x:10,y:96}]},
      {num:1,team:'A',pts:[{x:2,y:78},{x:6,y:80},{x:10,y:82}]},
      {num:3,team:'A',pts:[{x:2,y:98},{x:6,y:99},{x:10,y:100}]},
      {num:8,team:'A',pts:[{x:5,y:104},{x:8,y:102},{x:12,y:98}]},
    ],
    passes:[],
  },
];

function buildPlayList() {
  const c = document.getElementById('playList');
  c.innerHTML = '';
  PLAYS.forEach(play => {
    const btn = document.createElement('button');
    btn.className = 'play-card';
    btn.innerHTML = `<div class="play-card-name">${play.name}</div>
      <div class="play-card-meta">${play.cat}</div>`;
    btn.onclick = () => loadPlay(play.id);
    c.appendChild(btn);
  });
}

function loadPlay(id) {
  const play = PLAYS.find(p=>p.id===id);
  if (!play) return;
  applyBoardData(play);
  setHint(`Loaded "${play.name}".`);
  refreshInteractionUI();
}

// ─── Keyboard shortcuts ──────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  const map = {v:'move',r:'path',p:'pass',k:'kick',e:'erase'};
  if (map[k])           { setTool(map[k]); return; }
  if (k===' ')          { e.preventDefault(); togglePlay(); return; }
  if (k==='escape')     { S.passFrom=null;S.drawing=null;S.selected=null; setHint(HINTS[S.tool] || ''); refreshInteractionUI(); render(); }
  if (k==='z'&&(e.ctrlKey||e.metaKey)) { e.preventDefault(); undo(); }
  if (k==='delete'||k==='backspace') { if(S.selected){e.preventDefault();deleteSelected();} }
});

// ─── Track seek drag ─────────────────────────────────────────
let trackDrag = false;
document.getElementById('trackThumb').addEventListener('mousedown',()=>trackDrag=true);
document.addEventListener('mousemove',e=>{
  if(!trackDrag) return;
  const r=document.getElementById('track').getBoundingClientRect();
  S.animT=clamp((e.clientX-r.left)/r.width,0,1);
  updateTL(); render();
});
document.addEventListener('mouseup',()=>trackDrag=false);

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════
buildPlayList();
rebuildPalette();
refreshSavedPlayList();
document.getElementById('importPlayInput').addEventListener('change', e => {
  importPlayFromFile(e.target.files?.[0]);
  e.target.value = '';
});
window.addEventListener('resize', resize);
resize();
loadPlay('launch_fly');
setHint('MOVE — drag any player or ball freely on the pitch');
refreshInteractionUI();
