# Coordinate System Audit

**Date:** 20 May 2026
**Context:** Investigating whether the pitch can be rotated 90Â° for mobile portrait without breaking the data model.
**Tool used:** Claude Code audit, scoped prompt, no code changes.
**Status:** Audit 2 of 2.
**Companion audit:** `2026-05-mobile-layout-diagnosis.md`

---

## Headline answer

**Yes â€” visual rotation is possible without touching stored coordinates.** The schema is field-space (meters-like, orientation-agnostic). Every transform between storage and pixels goes through exactly two functions: `toC()` and `frC()`. Rotation can be applied at the transform layer, leaving the ~40 downstream functions untouched.

---

## Diagnosis

### 1. How player positions are stored

Player positions are stored in **field-space units**, not pixels and not normalized 0..1.

Evidence:
- Field model declared at top of `environments/animator/js/tactical-board.js` (line 4):
  - `x: 0..68` across pitch width
  - `y: -10..110` across total pitch length including in-goal
- Constants:
  - `F.XMIN = 0, F.XMAX = 68`
  - `F.YMIN = -10, F.YMAX = 110`
  - `tactical-board.js` (line 13)
- How they appear in live state:
  - `S.players` entries carry `x` and `y` directly in that field-space, validated numerically in `normalizeStepPlayers()` at line 445.
  - New players are created with field coordinates in `addPlayerByNum()`:
    - `x = startX + ...`
    - `y = startY + ...`
    - then clamped to `x: 2..66, y: -8..108`
    - `tactical-board.js` (line 4409)

So:
- Storage space is rugby-field units
- Horizontal axis: meters-like field width scale 0..68
- Vertical axis: meters-like field length scale -10..110

### 2. How paths and passes are stored

**Paths:**
- Stored in the same field-space as players.
- `normalizeStepPath()` expects `pts: [{x, y}, ...]` and validates numeric coordinates directly at line 476.
- `liveBoardToStepState()` serializes them as `{ num, team, pts }` with pts copied directly from live path points at line 582.
- When rehydrated by `setLiveBoardFromStep()`, they become live paths `{ pid, pts, color }`, still in field-space, at line 667.

**Passes:**
- Player-to-player passes store player references, not coordinates: `{ fromNum, fromT, toNum, toT, style }` â€” `normalizeStepPass()` (line 493).
- Field-target kicks store explicit target coordinates in the same field-space: `{ fromNum, fromT, targetX, targetY, style:'kick' }` (line 501).
- Live `S.passes` rehydrates to:
  - `{ from: playerId, to: playerId, style }` for player-target links
  - `{ from: playerId, to: null, targetX, targetY, style:'kick' }` for field-target kicks
  - line 673

**Ball:**
- Stored as `{ x, y }` in the same field-space via `normalizeBallPosition()` at line 468.

### 3. What transforms happen between storage and screen coordinates

**Core transform pair:**

Field to canvas:
```js
toC(fx, fy) => { x: ox + (fx - F.DX0) * sx, y: oy + (fy - F.DY0) * sy }
// line 57
```

Canvas to field:
```js
frC(cx, cy) => { x: (cx - ox) / sx + F.DX0, y: (cy - oy) / sy + F.DY0 }
// line 58
```

**Where the scale/offset come from:**

`resize()` measures actual canvas pixel size:
```js
cvW = cv.clientWidth || wrap.clientWidth
cvH = cv.clientHeight || wrap.clientHeight
// line 146
```

It computes a uniform base scale from width and height constraints:
```js
baseFromWidth = (cvW - padX * 2) / (FVW * FIELD_X_STRETCH)
baseFromHeight = (cvH - padY * 2) / FVH
sc = Math.min(baseFromWidth, baseFromHeight)
// line 151
```

Then applies non-uniform stretch:
```js
sx = sc * FIELD_X_STRETCH
sy = sc
// line 154
```

And centers the field inside the canvas:
```js
ox = (cvW - FVW * sx) / 2
oy = (cvH - FVH * sy) / 2
// line 156
```

**Important detail:** `FIELD_X_STRETCH = 1.7` at line 39, so stored field `x` is visually widened relative to `y`.

**Trace: one player from `S.players[0]` to rendered position**

Assume `const pl = S.players[0]`.

1. Live state object: `pl` has field-space coordinates `pl.x, pl.y` â€” same space used everywhere else in live board state.
2. Render loop: `render()` iterates players in line 3537.
   - For each player: `const pos = animPos(pl, t); drawPlayer(pos.x, pos.y, ...)` (line 3538).
3. `animPos(pl, t)`:
   - If the player has a path, it returns interpolated field coordinates along `path.pts`
   - Otherwise it returns the player's own field coordinates
   - It stays in field-space throughout
   - This is inferred from the downstream use and path interpolation via `catmullRom()` in field coordinates around line 3577.
4. `drawPlayer(fx, fy, ...)`:
   - Converts field-space to canvas pixels immediately: `const p = toC(fx, fy);` (line 2711).
5. `toC()` applies:
   - `canvasX = ox + (fx - F.DX0) * sx`
   - `canvasY = oy + (fy - F.DY0) * sy`
6. Actual pixel drawing: `ctx.arc(p.x, p.y, r, ...)` and `ctx.fillText(String(num), p.x, p.y + 0.5)` â€” lines 2739 and 2753.

**So the trace is:**
```
S.players[0].x/y
-> optional path interpolation in field-space
-> drawPlayer(fx, fy)
-> toC(fx, fy)
-> pixel center {p.x, p.y}
-> CanvasRenderingContext2D.arc/fillText
```

### 4. If the pitch were rendered rotated 90Â° on mobile, what would need to change

Many functions touch coordinate transforms. Almost all are in one file: `environments/animator/js/tactical-board.js`. Plus `environments/animator/index.html` and `environments/animator/css/tactical-board.css`.

**The coordinate-transform-sensitive functions in `tactical-board.js`:**

**Core transform layer:**
- `toC()` [57]
- `frC()` [58]
- `resize()` [144]
- `getF()` [3580]
- `getPx()` [3581]

**Field rendering primitives:**
- `drawField()` [2311]
- `drawFieldLabel()` [2661]

**Entity rendering:**
- `drawPlayer()` [2710]
- `drawBall()` [2759]
- `drawBallCarrierHighlight()` [2802]

**Path/pass rendering:**
- `drawRunPath()` [2835]
- `drawKickLine()` [2988]
- `drawKickToTarget()` [3025]
- `drawArc()` [3048]

**Annotation rendering:**
- `drawNoteAnnotation()` [3192]
- `drawArrowAnnotation()` [3237]
- `drawZoneAnnotation()` [3304]
- `drawBoxAnnotation()` [3355]
- `renderAnnotations()` [3399]
- `renderAnnotationDraft()` [3409]

**Main render composition:**
- `render()` [3430]

**Hit-testing and input-space conversion:**
- `hitPlayer()` [3584]
- `hitBall()` [3596]
- `hitAnnotation()` [3609]
- `hitKickPath()` [2934]
- `hitRunPath()` [2956]
- `hitPassLine()` [2972]
- `handlePointerDown()` [3683]
- `handlePointerMove()` [4055]
- `onPointerUp()` [4253]

**Field-space helpers that would matter because they assume current axes:**
- `attachedBallPositionForPlayer()` [1327]
- `syncAttachedBallToOwner()` [1334]
- `updateBallOwnerFromPosition()` [2071]
- `catmullRom()` [2905]
- `lerp()` [4652]
- `buildSequenceFrame()` and animated ball helpers around [4688], [4728], [4747]

**Schema/state rehydration functions that preserve field coordinates:**
- `normalizeStepPlayers()` [445]
- `normalizeStepPath()` [476]
- `normalizeStepPass()` [493]
- `normalizeStepState()` [512]
- `normalizePhaseState()` [526]
- `liveBoardToStepState()` [573]
- `serializePhase()` [611]
- `setLiveBoardFromStep()` [646]
- `serializePlay()` [1860]
- `deserializePlay()` [1893]

**What `index.html` and CSS would affect:**
- `index.html` hosts the fixed `<canvas id="field">` and overlay DOM
- `tactical-board.css` determines available canvas size and orientation envelope
- If rotation is visual-only inside the same canvas, CSS still matters because `cvW`/`cvH` come from the actual laid-out element size in `resize()`

### 5. Is it possible to rotate the visual rendering without rotating the stored coordinates?

**Yes.**

**Reasoning:**
- Stored positions, paths, ball, and field-target kick coordinates are already abstract field coordinates, not pixel coordinates.
- The render pipeline already separates storage-space from screen-space through `toC()` / `frC()`.
- That means you can keep the serialized/live schema unchanged and remap field coordinates to a rotated canvas presentation.

**But "possible" does not mean "isolated."**

To make that work correctly, you would need both:
- **Render-space rotation:** field-space â†’ rotated canvas-space
- **Inverse input rotation:** pointer/click/drag canvas-space â†’ field-space

If only rendering rotates and input doesn't, hit-testing and dragging break. If only the field art rotates and overlays/path math don't, the board becomes internally inconsistent.

**So the answer is:**
- Yes, it is possible to rotate the visual rendering without rotating stored coordinates.
- The stored schema does not force portrait-vs-landscape.
- The work would live in transform, render, and input conversion layers, not in the saved data model itself.

---

## Decision

Rotate at the transform layer (`toC()` and `frC()`) gated by a `MOBILE_PORTRAIT` flag set in `resize()`. Combined with Option 1 from the layout diagnosis audit.
