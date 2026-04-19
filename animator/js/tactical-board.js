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
  rebuildPalette(); updateSelInfo();
  render();
}

// ════════════════════════════════════════════════════════════
//  FIELD RENDERING
// ════════════════════════════════════════════════════════════
function drawField() {
  ctx.clearRect(0, 0, cvW, cvH);

  // Canvas bg
  ctx.fillStyle = '#0a1310';
  ctx.fillRect(0, 0, cvW, cvH);

  const TL = toC(0, F.YMIN), BR = toC(F.W, F.YMAX);
  const FW = BR.x - TL.x, FH = BR.y - TL.y;

  // ── Grass bands ──────────────────────────────────────────
  const nBands = 14;
  for (let i = 0; i < nBands; i++) {
    const fy0 = F.YMIN + (F.YMAX - F.YMIN) / nBands * i;
    const fy1 = F.YMIN + (F.YMAX - F.YMIN) / nBands * (i + 1);
    const p0 = toC(0, fy0), p1 = toC(68, fy1);
    ctx.fillStyle = i % 2 === 0 ? '#1e6e22' : '#228026';
    ctx.fillRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y + 1);
  }

  // ── In-goal tints ────────────────────────────────────────
  const igTop = toC(0, F.YMIN), igTopEnd = toC(68, 0);
  ctx.fillStyle = 'rgba(255,255,255,0.028)';
  ctx.fillRect(igTop.x, igTop.y, FW, igTopEnd.y - igTop.y);

  const igBot = toC(0, 100), igBotEnd = toC(68, F.YMAX);
  ctx.fillStyle = 'rgba(255,255,255,0.028)';
  ctx.fillRect(igBot.x, igBot.y, FW, igBotEnd.y - igBot.y);

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
  hline(F.YMIN, 'rgba(255,255,255,0.22)', 1.2);
  hline(F.YMAX, 'rgba(255,255,255,0.22)', 1.2);
  // Try lines
  hline(0,   '#ffffff', 2.5);
  hline(100, '#ffffff', 2.5);
  // 22m lines
  hline(22, 'rgba(255,255,255,0.82)', 2);
  hline(78, 'rgba(255,255,255,0.82)', 2);
  // 10m lines (dashed)
  hline(10, 'rgba(255,255,255,0.55)', 1.8, [sc * 0.8, sc * 0.4]);
  hline(90, 'rgba(255,255,255,0.55)', 1.8, [sc * 0.8, sc * 0.4]);
  // Halfway
  hline(50, 'rgba(255,255,255,0.9)', 2.2);

  // Touchlines
  function vline(fx, color, lw, fy0 = F.YMIN, fy1 = F.YMAX) {
    const p = toC(fx, fy0), q = toC(fx, fy1);
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    ctx.restore();
  }
  vline(0,  'rgba(255,255,255,0.65)', 2);
  vline(68, 'rgba(255,255,255,0.65)', 2);

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
    ticks(fy, 'rgba(255,255,255,0.55)');
  });

  // Touchline ticks at major lines
  [5, 10, 22, 50, 78, 90, 95].forEach(fy => {
    const tl = toC(0, fy), tr = toC(68, fy);
    const tLen = 4 * sc;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(tl.x + tLen, tl.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x - tLen, tr.y); ctx.stroke();
    ctx.restore();
  });

  // Centre spot + circle
  const hw = toC(34, 50);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
  ctx.setLineDash([sc * 0.5, sc * 0.4]);
  ctx.beginPath(); ctx.arc(hw.x, hw.y, 10 * sc, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(hw.x, hw.y, 2, 0, Math.PI * 2); ctx.fill();

  // ── Field labels ─────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.font = `bold ${Math.max(8, sc * 0.85)}px "Barlow Condensed"`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const lblX = toC(0.8, 0).x;
  [[-5,'IN-GOAL'],[0,'TRY'],[10,'10m'],[22,'22m'],[50,'HALFWAY'],[78,'22m'],[90,'10m'],[100,'TRY'],[105,'IN-GOAL']].forEach(([fy, lbl]) => {
    ctx.fillText(lbl, lblX, toC(0, fy).y);
  });
  ctx.restore();

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
  ctx.strokeStyle = 'rgba(250,250,250,0.9)';
  ctx.lineWidth = Math.max(2, sc * 0.2);
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 3;

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
  ctx.strokeStyle = color;
  ctx.lineWidth   = lw;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  if (dashed) ctx.setLineDash([sc * 0.7, sc * 0.4]);

  // Sample Catmull-Rom spline
  const STEPS = Math.max(40, pts.length * 12);
  const drawSteps = Math.floor(progress * STEPS);

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

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = thick ? 2.2 : 1.8;
  ctx.setLineDash([sc*0.6, sc*0.35]);
  ctx.lineCap = 'round';

  ctx.beginPath(); ctx.moveTo(p1.x, p1.y);
  const STEPS = 30;
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
    updateSelInfo(); render();
  }

  else if (S.tool === 'path') {
    const pl = hitPlayer(fp);
    if (pl) {
      S.drawing = { pid:pl.id, pts:[{x:pl.x, y:pl.y}], last:{x:fp.x, y:fp.y} };
      setHint('Drag to draw the run path · Release to finish');
    }
  }

  else if (S.tool === 'pass' || S.tool === 'kick') {
    const pl = hitPlayer(fp);
    if (pl) {
      if (!S.passFrom) {
        S.passFrom = pl.id; S.selected = pl.id;
        setHint(`${S.tool === 'kick' ? 'Kick' : 'Pass'} from #${pl.num} — click target player`);
      } else if (pl.id !== S.passFrom) {
        snapshot();
        const dup = S.passes.find(p => p.from === S.passFrom && p.to === pl.id);
        if (!dup) S.passes.push({ from:S.passFrom, to:pl.id, style:S.tool });
        S.passFrom = null; S.selected = null;
        setHint(S.tool === 'pass' ? 'PASS — click passer then receiver' : 'KICK — click kicker then target');
      } else {
        S.passFrom = null; S.selected = null;
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
  rebuildPalette(); setTool('move'); render();
}

function addBall() {
  if (!S.ball) snapshot();
  S.ball = { x:34, y:50 };
  setTool('move'); render();
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
  rebuildPalette(); updateSelInfo(); render();
}

function deleteSelected() {
  if (S.selected && S.selected !== '__ball__') removePlayer(S.selected);
  else if (S.selected === '__ball__') { snapshot(); S.ball=null; S.selected=null; }
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

function setTool(t) {
  S.tool = t;
  if (t !== 'path')          S.drawing = null;
  if (t !== 'pass' && t !== 'kick') { S.passFrom=null; S.selected=null; }
  document.querySelectorAll('.t-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('t-' + t);
  if (el) el.classList.add('active');
  cv.style.cursor = t === 'move' ? 'default' : 'crosshair';
  setHint(HINTS[t] || '');
  render();
}
function setHint(txt) { document.getElementById('hint').textContent = txt; }

function clearPaths()  { snapshot(); S.paths=[]; S.passes=[]; S.drawing=null; render(); }
function clearAll() {
  snapshot();
  S.players=[]; S.ball=null; S.paths=[]; S.passes=[];
  S.drawing=null; S.passFrom=null; S.selected=null;
  S.animT=0; S.animating=false;
  S.atkUsed=new Set(); S.defUsed=new Set();
  document.getElementById('playName').value='New Play';
  setPlayBtnState(); rebuildPalette(); updateSelInfo(); updateTL(); render();
}

function updateSelInfo() {
  const box = document.getElementById('selInfo');
  if (S.selected && S.selected !== '__ball__') {
    const pl = S.players.find(p=>p.id===S.selected);
    if (pl) {
      box.classList.add('visible');
      document.getElementById('selName').textContent =
        `${pl.team==='A'?'Attack':'Defence'} #${pl.num}`;
      return;
    }
  }
  box.classList.remove('visible');
}

// ─── Palette ─────────────────────────────────────────────────
let palTab = 'atk';

function setTab(tab) {
  palTab = tab;
  document.querySelectorAll('.pal-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  rebuildPalette();
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
    btn.title = `${team==='A'?'Attacker':'Defender'} #${n}`;
    if (!used.has(n)) btn.onclick = () => addPlayerByNum(n, team);
    grid.appendChild(btn);
  }
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
    btn.style.cssText='width:100%;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.02);color:var(--text);cursor:pointer;text-align:left;margin-bottom:4px;transition:all .15s;';
    btn.onmouseover = ()=>btn.style.borderColor='var(--accent)';
    btn.onmouseleave= ()=>btn.style.borderColor='var(--border)';
    btn.innerHTML=`<div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:.85rem;">${play.name}</div>
      <div style="font-size:.6rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-top:2px;">${play.cat}</div>`;
    btn.onclick = () => loadPlay(play.id);
    c.appendChild(btn);
  });
}

function loadPlay(id) {
  const play = PLAYS.find(p=>p.id===id);
  if (!play) return;
  snapshot();
  const p = JSON.parse(JSON.stringify(play));

  S.players = p.players.map(pl => ({...pl, id:S.nextId++, isBC:false}));
  S.atkUsed = new Set(S.players.filter(pl=>pl.team==='A').map(pl=>pl.num));
  S.defUsed = new Set(S.players.filter(pl=>pl.team==='D').map(pl=>pl.num));
  S.ball    = p.ball || null;
  S.animT   = 0; S.animating = false;
  S.selected=null; S.drawing=null; S.passFrom=null;

  // Build paths
  S.paths = p.paths.map(path => {
    const pl  = S.players.find(q => q.num===path.num && q.team===path.team);
    const col = path.team==='A'?'#60a5fa':'#f87171';
    return { pid: pl?.id, pts:path.pts, color:col };
  }).filter(p=>p.pid!==undefined);

  // Build passes
  S.passes = (p.passes||[]).map(pass => {
    const fp = S.players.find(q=>q.num===pass.fromNum&&q.team===pass.fromT);
    const tp = S.players.find(q=>q.num===pass.toNum&&q.team===pass.toT);
    return fp&&tp ? {from:fp.id,to:tp.id,style:pass.style} : null;
  }).filter(Boolean);

  document.getElementById('playName').value = play.name;
  setPlayBtnState(); rebuildPalette(); updateSelInfo(); updateTL(); render();
  setTool('move');
}

// ─── Keyboard shortcuts ──────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  const map = {v:'move',r:'path',p:'pass',k:'kick',e:'erase'};
  if (map[k])           { setTool(map[k]); return; }
  if (k===' ')          { e.preventDefault(); togglePlay(); return; }
  if (k==='escape')     { S.passFrom=null;S.drawing=null;S.selected=null; updateSelInfo(); render(); }
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
window.addEventListener('resize', resize);
resize();
loadPlay('launch_fly');
setHint('MOVE — drag any player or ball freely on the pitch');