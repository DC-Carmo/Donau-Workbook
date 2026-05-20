# Codex Prompt â€” Mobile Layout + Portrait Rotation (Phase 2c Week 2)

Copy everything between the lines below into Codex.

---

## Goal

Make the tactical board work properly on mobile in portrait orientation. The pitch must fill the viewport width. The pitch must rotate 90Â° so the long axis is vertical (behind-the-posts perspective). All existing interactions must continue working on desktop unchanged.

## Context

Read these audit files first before writing any code:
- `docs/audits/2026-05-mobile-layout-diagnosis.md`
- `docs/audits/2026-05-coordinate-system-audit.md`

These document the current rendering pipeline, the CSS cascade bug causing the pitch to render at ~40% viewport width on mobile, and the coordinate-system structure that makes rotation safe at the transform layer.

Files in scope:
- `environments/animator/js/tactical-board.js`
- `environments/animator/css/tactical-board.css`
- `environments/animator/index.html` (only viewport meta and minor structural tweaks if needed)

Files explicitly out of scope (do not modify):
- Any schema/serialization code (`normalizeStep*`, `serializePlay`, `deserializePlay`, etc.) â€” the data model stays untouched
- Any other environment (`austria-u18`, `donau`, landing page)
- Any other JS file

## Changes required, in order

### 1. CSS cascade fix â€” collapse `#workspace` to single column on mobile

The pitch currently renders at ~40% viewport width because `#workspace` keeps its desktop `grid-template-columns: 220px minmax(0, 1fr)` rule on mobile (defined at line 1845 of `tactical-board.css`). The earlier mobile rule at line 1309 loses the cascade.

Fix: ensure that at `max-width: 768px`, `#workspace` becomes a single column where `#canvasWrap` and `#bottomPanel` span the full viewport width. `#smartPanel` should remain a fixed off-canvas drawer (already implemented at line 2978), but it must no longer reserve a grid column.

Choose the cleanest approach (move the mobile rule after line 1845, increase specificity, or use a different selector). Document the choice in a code comment.

### 2. Add mobile portrait orientation detection

In `resize()` in `tactical-board.js`, add:

```js
const MOBILE_PORTRAIT = window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
```

Store this on the module-level state object (or a clearly-scoped variable accessible to `toC()` and `frC()`). Recompute on every `resize()` call.

### 3. Rotate transforms at the transform layer

Modify `toC()` (line 57) and `frC()` (line 58) so that when `MOBILE_PORTRAIT` is true, the field is rendered with its long axis vertical (try line at top of screen, own goal at bottom â€” behind-the-posts perspective).

Direction:
- In landscape (desktop): field x (0..68 width) maps to screen x, field y (-10..110 length) maps to screen y.
- In portrait (mobile): field y (-10..110 length) maps to screen y inverted so attacking try line is at top; field x (0..68 width) maps to screen x.

Equivalent to a 90Â° rotation plus possible axis flip to get behind-posts orientation. Verify visually by loading a saved play with players in field positions and confirming the attack pod appears upfield from the defenders.

Important: `frC()` must be the exact inverse of `toC()`. If you change one, you must change the other consistently. Hit-testing depends on this.

### 4. Flip the `FIELD_X_STRETCH` axis when in portrait

`FIELD_X_STRETCH = 1.7` at line 39 currently widens the horizontal axis. In portrait, the long axis becomes vertical, so the stretch must apply to the vertical axis instead. Otherwise the pitch will look squat instead of properly tall.

In `resize()`, compute `sx` and `sy` based on the orientation mode:
- Landscape: `sx = sc * FIELD_X_STRETCH; sy = sc;` (current behavior)
- Portrait: `sx = sc; sy = sc * FIELD_X_STRETCH;` (rotated)

Or apply equivalently inside `toC()` / `frC()`. Pick whichever is cleaner.

### 5. Update `resize()` for rotated canvas dimensions

The `baseFromWidth` / `baseFromHeight` calculation at line 151 currently assumes the field width is the FVW dimension. In portrait, the field length (FVH) becomes the wider visible dimension. Recompute `sc`, `ox`, `oy` so the rotated field fills the available canvas area with appropriate padding.

### 6. Topbar cleanup on mobile

At `max-width: 768px`, the topbar should show:
- Logo only (left)
- Phase counter (center) â€” keep
- Hamburger menu icon (right) that opens a sheet/menu containing: PORTAL, SAVE, EXPORT PDF, EXPORT JSON, IMPORT

Hide the other topbar buttons that currently overflow. The hamburger menu can reuse existing button handlers â€” just relocate them into a dropdown/sheet.

### 7. Bottom toolbar simplification on mobile

At `max-width: 768px`, the bottom toolbar should show 5 primary tools visible: MOVE, RUN, PASS, KICK, ERASE. All other controls (SPEED, GAINLINE, UNDO, REDO, CIRCLE, BOX, ARROW, NOTE, TELE, BALL, +ATTACK, +DEFENCE, CLEAR, PLAY, PLAY ALL, prev/next phase) collapse behind a "MORE" expander button that opens a sheet/menu.

Keep all existing button handlers â€” just relocate them.

### 8. Token minimum size

On mobile (`max-width: 768px`), player tokens must render at a minimum diameter of 32px regardless of computed field scale. Find where token radius is calculated in `drawPlayer()` (line 2710) and add a minimum-pixel-size floor when on mobile.

### 9. Drawer behavior

`#smartPanel` is already an off-canvas drawer on mobile. Verify it still opens/closes correctly after the grid fix. If it slides in from the left and now covers the full-width pitch, that is acceptable for this iteration.

## Out of scope â€” do not implement

- Touch gesture upgrades (long-press, double-tap, etc.) â€” that is Week 3
- 40px invisible hitboxes â€” that is Week 3
- Bezier smoothing â€” that is Week 3
- Pinch/zoom â€” that is Week 3
- Any new feature, button, or interaction
- Any animation polish
- Any change to schema, serialization, or save/load
- Any change to desktop layout or behavior

## QA checklist â€” Codex must run these mentally and report results

Desktop (viewport >1024px):
- [ ] Pitch renders at full size as before
- [ ] All toolbar buttons visible and clickable
- [ ] Smart panel docked on left
- [ ] Drag a player â€” works
- [ ] Draw a run path â€” works
- [ ] Add a pass â€” works
- [ ] Add a kick to a field target â€” works
- [ ] Play multi-phase animation â€” works
- [ ] Save and reload a play â€” players, paths, passes restored correctly

Mobile portrait (viewport â‰¤768px, height > width):
- [ ] Pitch fills the viewport width
- [ ] Pitch long axis is vertical, try line at top
- [ ] Topbar shows logo + phase counter + hamburger
- [ ] Bottom toolbar shows 5 primary tools + MORE
- [ ] Smart panel opens as drawer
- [ ] Players visible and at least 32px diameter
- [ ] Tap and drag a player â€” works in rotated space
- [ ] Hit-testing works (tapping a player selects it, not empty space)
- [ ] Loading a saved play places players in correct field-space positions visually
- [ ] No console errors

Mobile landscape (viewport â‰¤768px, width > height):
- [ ] Acceptable layout (does not need to be perfect, but should not break)

## Failure modes to watch for

- If `toC()` and `frC()` become inconsistent, hit-testing will detect the wrong player or empty space. Test this first.
- If `FIELD_X_STRETCH` is not flipped in portrait, the pitch will look squat.
- If the CSS cascade fix is wrong, the pitch may still render at <100% width, or worse, the desktop layout breaks.
- If a coordinate-touching function bypasses `toC()` / `frC()` and computes its own transform inline, rotation will fail for that one feature. The audit lists ~40 such functions â€” verify each calls `toC()` for output and `frC()` for input.

## Reporting

When complete, report:
1. Which architectural choice was made for the CSS cascade fix and why
2. Which functions (if any) were found bypassing `toC()` / `frC()` and how they were handled
3. QA checklist results
4. Any issues encountered that required deviation from this prompt

## Hard rules

- Timeout: 4 hours. If you hit the timeout, commit current progress to a branch and report status.
- Branch: `feat/mobile-portrait-board` off `dev`.
- Do not merge to `dev` automatically.
- One commit per logical change (CSS fix, rotation transforms, topbar, bottom toolbar, token sizing) â€” not one giant commit.
- Do not modify files outside the scope listed above.
- Do not add new dependencies.
- Do not introduce a build step.
- Preserve all existing code comments.
