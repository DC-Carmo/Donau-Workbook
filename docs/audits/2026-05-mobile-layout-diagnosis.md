# Mobile Layout Diagnosis Audit

**Date:** 20 May 2026
**Context:** Mobile board renders pitch at ~40% viewport width. Planning Phase 2c work.
**Tool used:** Claude Code audit, scoped prompt, no code changes.
**Status:** Audit 1 of 2.
**Companion audit:** `2026-05-coordinate-system-audit.md`

---

## Diagnosis

### 1. How the pitch is rendered

Hybrid, with the pitch itself rendered in **Canvas2D**.

Evidence:
- The board HTML contains a real `<canvas id="field"></canvas>` in `environments/animator/index.html` (line 210).
- JS grabs a 2D context with `const ctx = cv.getContext('2d')` in `environments/animator/js/tactical-board.js` (line 55).
- The actual pitch is painted procedurally in `drawField()` using gradients, `fillRect`, `lineTo`, `arc`, and `drawImage` in `tactical-board.js` (line 2311), especially the grass/stripe/line work around lines 2333â€“2418.
- Overlays and controls are HTML/CSS: `#radialMenu`, `#boardStatus`, tutorial, empty state, topbar, smart panel, bottom toolbar in `environments/animator/index.html` (line 211).

So:
- **Pitch, players, paths, passes, field markings:** Canvas2D
- **Menus/status/toolbars/panels:** HTML/CSS
- **Not SVG**

There are no JS module imports inside `environments/animator/js/tactical-board.js`. Rendering dependencies come from the page shell in `environments/animator/index.html` (line 1): CSS, this JS file, shared access scripts, and external jspdf / qrcode-generator.

### 2. Current responsive strategy

#### (a) Pitch container

**Intended strategy:**
- An earlier mobile block tries to switch `#workspace` to a vertical mobile stack and make `#canvasWrap` full-width/flex-column at `tactical-board.css` (line 1309) and 1316.
- It also tries to give `#field` a mobile height clamp at line 1329.

**Actual current strategy after cascade:**
- The later base layout wins.
- `#workspace` is a 2-column grid: `220px minmax(0, 1fr)` in `tactical-board.css` (line 1845).
- `#canvasWrap` is forced into grid column 2 in line 1855.
- `#field` is `width:100%; height:100%` in line 1877, with mobile only adding `min-height:65vh` later in line 2339 and `min-height:67vh` at line 2401.

**Net effect:** On mobile, the pitch container is still using the desktop 2-column grid shell. The canvas only gets column 2, not the full screen.

#### (b) Topbar

**Actual strategy:**
- Desktop-first flex topbar with wrapping in `tactical-board.css` (line 42).
- At `max-width:1180px`, it stretches more and hides the corner brand in line 1175.
- At 768pxâ€“1023px, it reduces gaps, shrinks the play name, and lets clusters wrap to full width in line 1184.
- At `max-width:768px`, the actual live topbar is still the same DOM, just compressed:
  - hides `.desktop-only`, `.tb-title-label`, `.tb-brand-sub`
  - shrinks `#playName`
  - tightens button sizing
  - line 2304

**Important note:** There is an earlier alternate "mobile topbar" system in CSS at line 1240, but that markup does not exist in the current HTML. So it is not the active strategy.

#### (c) Left panel

**Actual strategy:**
- **Desktop:** `#smartPanel` is the fixed left column, width 220px, occupying grid column 1 / rows 1â€“2 in `tactical-board.css` (line 2422).
- **Tablet desktop:** shrinks to 180px only between 769px and 1080px in line 3022.
- **Mobile:** the panel becomes an off-canvas fixed drawer at `max-width:768px`:
  - `position: fixed`
  - `left: -290px`
  - `width 280px`
  - slides in with `.sp-drawer-open`
  - line 2978

**Important bug in the strategy:** The panel becomes fixed/off-canvas, but the workspace grid still reserves the desktop left column.

#### (d) Bottom toolbar

**Actual strategy:**
- Desktop/mobile shared bottom rail, not a nav replacement.
- `#bottomPanel` sits in grid row 2 / column 2 in line 1861.
- `#compactToolbar` is a horizontally scrollable flex row in line 2020.
- `#playerSelector` is a second fixed-height strip below it in line 2204.
- At `max-width:768px`, it trims padding and hides `.tool-btn` entirely in line 2352.
- At `max-width:480px`, it mostly just keeps the same structure with slightly smaller tokens in line 2405.

### 3. CSS breakpoints and what they actually do

Live media queries found:

- `@media (max-width: 1180px)` at line 1175 â€” Stretches topbar items, hides corner brand, relaxes fixed min-width assumptions.
- `@media (min-width: 768px) and (max-width: 1023px)` at line 1184 â€” Tablet topbar compaction. Makes topbar/action groups full-width and more wrappable.
- `@media (max-width: 768px)` at line 1230 â€” **Intended mobile redesign**: vertical workspace, full-width canvas stack, custom mobile topbar and controls, mobile palette section. Large parts of this are effectively overridden later by later base rules and later mobile rules, or depend on markup that is not present.
- `@media (max-width: 430px)` at line 1603 â€” Smaller topbar sizing. Sets `#field` to `min-height:360px; height:clamp(360px, 60vh, 480px)`. But later `#field` base rules partially interfere with this.
- `@media (max-width: 900px) and (orientation: landscape)` at line 1641 â€” Landscape mobile/tablet adjustments: field height clamp, reduced canvas padding, palette tweaks.
- `@media (min-width: 1024px)` at line 2289 â€” Just enlarges `.player-token` a bit.
- `@media (max-width: 1024px)` at line 2298 â€” Hides `#toolbarModeInline`.
- `@media (max-width: 768px)` at line 2304 â€” **This is the later active mobile override**: tighter topbar, hides some desktop labels/buttons, tweaks `#canvasWrap`, gives `#field` `min-height:65vh`, trims bottom toolbar, hides `.tool-btn`.
- `@media (max-width: 480px)` at line 2379 â€” Slight topbar compaction. `#field` `min-height:67vh`. Slightly smaller player tokens.
- `@media (max-width: 768px)` at line 2978 â€” Converts `#smartPanel` into a fixed off-canvas drawer. Shows the floating drawer toggle button.
- `@media (min-width: 769px) and (max-width: 1080px)` at line 3022 â€” Reduces desktop left column from 220px to 180px.

**The most important "actual behavior" point:** The stylesheet contains two different responsive systems layered in one file. The later desktop/grid rules around line 1845 override a meaningful part of the earlier mobile stack defined at line 1230.

### 4. Viewport meta tag

Set in `environments/animator/index.html` (line 10).

Current value:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

### 5. Why the pitch renders at about 40% of viewport width on mobile

This comes from the CSS layout shell first, then JS scales to whatever width that shell gives it.

**Exact path:**

1. `#workspace` is defined later in the file as a desktop grid with a fixed left column: `grid-template-columns: 220px minmax(0, 1fr);` â€” `tactical-board.css` (line 1845)
2. `#canvasWrap` is explicitly placed in column 2: `tactical-board.css` (line 1855)
3. `#bottomPanel` is also placed in column 2: `tactical-board.css` (line 1861)
4. `#smartPanel` is the left-column item, width 220px: `tactical-board.css` (line 2422)
5. On mobile, `#smartPanel` is changed to `position: fixed` and moved off-canvas: `left: -290px; width: 280px;` â€” `tactical-board.css` (line 2978)
6. **But mobile never collapses the later grid back to one column.** There is an earlier attempt to do that at line 1309, where `#workspace` becomes `display:flex; flex-direction:column;`. That rule loses in the cascade because the later base `#workspace` rule at line 1845 has the same specificity and appears later.

**Result:**
- Mobile viewport might be ~375px wide.
- Grid still reserves 220px for column 1.
- Column 2 gets the remainder: about 375 âˆ’ 220 = 155px.
- 155 / 375 = 41.3%.
- On 390px wide phones, 390 âˆ’ 220 = 170px, which is 43.6%.
- That matches the "~40% of viewport width" symptom.

JS then faithfully sizes the canvas to that reduced width:
```js
cvW = cv.clientWidth || wrap.clientWidth;
// tactical-board.js (line 146)
```

The scale is computed from that reduced width:
```js
baseFromWidth = (cvW - padX * 2) / (FVW * FIELD_X_STRETCH);
// tactical-board.js (line 151)
```

The field is then centered within the already-narrow canvas:
```js
ox = (cvW - FVW * sx) / 2;
// tactical-board.js (line 156)
```

So the root cause is **not** the pitch drawing code. The root cause is:
- the mobile layout intends to become single-column,
- but the later desktop grid reasserts itself,
- while the smart panel becomes fixed/off-canvas,
- leaving a phantom 220px desktop column reserved on mobile.

### 6. Architectural options for making mobile layout work

#### Option 1: Single-shell, true mobile override of the existing grid
- Keep one HTML page and one general CSS file.
- On mobile, fully collapse `#workspace` to one column and make `#canvasWrap` / `#bottomPanel` span full width.
- Keep `#smartPanel` as a true overlay drawer detached from layout.

**Tradeoffs:**
- Smallest conceptual change to the current architecture.
- Lowest duplication of markup and behavior.
- Still requires careful cascade cleanup because the current file has overlapping responsive systems.
- Future regressions are likely if desktop and mobile rules stay interleaved in one large stylesheet.

#### Option 2: Split desktop and mobile board shells
- Keep one rendering engine, but use separate layout shells for desktop and mobile.
- Same board logic, different DOM/CSS wrappers around it.

**Tradeoffs:**
- Much clearer responsive behavior and less cascade conflict.
- Easier to reason about mobile independently.
- Higher markup/CSS duplication.
- More maintenance burden when adding controls, because both shells must stay functionally aligned.

#### Option 3: Decouple the pitch stage from surrounding UI
- Treat the board canvas as a standalone "stage" with its own explicit aspect-ratio and sizing contract.
- Surrounding UI becomes independently docked: overlay topbar, overlay drawer, bottom rail, etc.
- JS layout code can read stage bounds separately from app chrome.

**Tradeoffs:**
- Strongest long-term architecture for a tool-like app.
- Makes pitch sizing deterministic and independent of sidebar/grid accidents.
- Requires more structural refactoring than a CSS-only correction.
- Highest upfront complexity, but best separation between rendering and layout chrome.

---

## Decision

**Option 1 selected.** Matches the actual problem (CSS cascade bug + secondary debt), avoids over-engineering, preserves single-source-of-truth maintenance.

Combined with portrait rotation at the transform layer (see companion coordinate system audit).
