# Animator Snippets For External Review

Source file: `environments/animator/js/tactical-board.js`

Notes:
- These are focused excerpts, not the whole file.
- Line numbers below refer to the current feature-branch file state at capture time.
- Call-graph notes are intentionally brief so a reviewer can trace render/state flow quickly.

## A. Token Draw Call Sites

Call-graph note:
- `render()` is the only high-level frame renderer.
- Full player tokens are painted in two places: sequence playback via `frame.players.forEach(...)`, and live edit via `S.players.forEach(...)`.
- `drawPlayer()` is the solid token painter used by both branches.

```js
// tactical-board.js:3411-3438
function drawPlayer(fx, fy, num, team, selected, isBallCarrier, palette = null) {
  const p = toC(fx, fy);
  const { fill, border } = palette || playerColorPalette({ team });
  const r = R();
  ctx.save();

  if (selected) {
    ctx.beginPath(); ctx.arc(p.x, p.y, r + (isMobileBoardViewport() ? 3 : 4), 0, Math.PI * 2);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = isMobileBoardViewport() ? 2 : 2.5;
    ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
  }

  ctx.beginPath(); ctx.arc(p.x + 1.5, p.y + 2, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();

  const g = ctx.createRadialGradient(p.x - r * 0.25, p.y - r * 0.25, r * 0.1, p.x, p.y, r);
  g.addColorStop(0, lighten(fill, 35));
  g.addColorStop(1, fill);
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();

  ctx.strokeStyle = selected ? '#fbbf24' : border;
  ctx.lineWidth   = selected ? (isMobileBoardViewport() ? 2 : 2.5) : (isMobileBoardViewport() ? 1.5 : 1.8);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${Math.max(10, r * (isMobileBoardViewport() ? 0.98 : 0.94))}px "Barlow Condensed"`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 4;
  ctx.fillText(String(num), p.x, p.y + 0.5);
  ctx.shadowBlur = 0;
  ctx.restore();
}
```

```js
// tactical-board.js:4193-4308
function render() {
  drawField();

  if (shouldRenderSequencePreview()) {
    const frame = buildSequenceFrame(S.animT);
    const playerLookup = new Map(frame.players.map(pl => [playerKey(pl), pl]));
    const animatedKickBall = resolveAnimatedKickBall(frame, playerLookup);
    renderAnnotations('zones', frame.annotations);
    frame.passes.forEach(pass => { /* pass/kick rendering */ });
    frame.paths.forEach(path => {
      if (path.pts.length < 2) return;
      drawRunPath(path.pts, path.team === 'A' ? '#60a5fa' : '#f87171', 2.8, 1);
    });
    renderAnnotations('lines', frame.annotations);
    renderPathOriginMarkers(frame.players, frame.paths);
    frame.players.forEach(pl => drawPlayer(
      pl.x, pl.y, pl.num, pl.team, false,
      samePlayerRef(playerRef(pl), frame.ballOwner),
      playerColorPalette(pl)
    ));
    const frameBall = animatedKickBall || frame.ball;
    if (frameBall) drawBall(frameBall.x, frameBall.y, false);
    frame.players.forEach(pl => {
      if (samePlayerRef(playerRef(pl), frame.ballOwner)) drawBallCarrierHighlight(pl.x, pl.y);
    });
    renderAnnotations('notes', frame.annotations);
    closeRadialMenu();
    return;
  }

  const t = S.animating ? S.animT : 0;
  const animatedKickBall = resolveLiveAnimatedKickBall(t);
  renderAnnotations('zones');
  S.passes.forEach((pass, passIdx) => { /* pass/kick rendering */ });
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
      const ghostPts = path.pts.map(pt => ({ x: pt.x + dx, y: pt.y + dy }));
      ctx.save();
      ctx.globalAlpha = 0.3;
      drawRunPath(ghostPts, path.color, 2, 1, true);
      ctx.restore();
    }
  }

  renderAnnotations('lines');
  renderPhoneEditMovementGuides();
  renderPathOriginMarkers();
  if (S.drawing && S.drawing.pts.length >= 2) { /* draft run path */ }
  renderAnnotationDraft();

  S.players.forEach(pl => {
    const pos = S.animating ? animPos(pl, t) : pl;
    const sel = isPlayerSelected(pl.id);
    drawPlayer(pos.x, pos.y, pl.num, pl.team, sel, pl.isBC, playerColorPalette(pl));
  });
  const liveBall = animatedKickBall || S.ball;
  if (liveBall) drawBall(liveBall.x, liveBall.y, isBallSelected());
  S.players.forEach(pl => {
    if (pl.isBC) drawBallCarrierHighlight(pl.x, pl.y);
  });
  renderAnnotations('notes');
  renderRadialMenu();
}
```

## B. Drag Start / Move / End State Writes

Call-graph note:
- `handlePointerDown()` selects the drag target and seeds `S.dragging`.
- `handlePointerMove()` mutates live session state (`S.players`, `S.paths`, `S.ball`, annotations).
- `onPointerUp()` finalizes ownership and currently commits live state back into the current step.

```js
// tactical-board.js:4532-4614
function handlePointerDown(e) {
  const fp = getF(e);
  const clampedFieldPoint = clampFieldPoint(fp);
  const canvasPoint = getPx(e);

  if (S.tool === 'move') {
    const pl = hitPlayer(fp);
    const ballHit = !pl && hitBall(fp);
    const annHit = !pl && !ballHit ? hitAnnotation(fp) : null;
    /* pending-group + gainline handling omitted */

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
      try { cv.setPointerCapture(e.pointerId); } catch(_) {}
    } else if (ballHit) {
      snapshot();
      selectBall(previousSelectedPlayer ? previousSelectedPlayer.id : null);
      S.dragging  = { type:'ball' };
      S.dragOff   = { x:fp.x - S.ball.x, y:fp.y - S.ball.y };
    } else if (annHit) {
      snapshot();
      selectAnnotationById(annHit.id);
      S.dragging = { type:'annotation', id:annHit.id, part:annHit.part, anchor:{ x:fp.x, y:fp.y } };
    }
    refreshInteractionUI(); render();
  }
}
```

```js
// tactical-board.js:4935-5038 and 5171-5191
function handlePointerMove(e) {
  const fp = getF(e);
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
        const path = S.paths.find(p => p.pid === pl.id);
        if (path && path.pts.length) translatePathPoints(path, pl.x - prevX, pl.y - prevY);
        if (samePlayerRef(playerRef(pl), S.ballOwner) && S.ball) {
          S.ball = attachedBallPositionForPlayer(pl);
          S.ballAttached = true;
          applyBallOwnershipVisualState();
        }
      }
    } else if (S.dragging.type === 'ball' && S.ball) {
      S.ball.x = clamp(fp.x - S.dragOff.x, -2, 70);
      S.ball.y = clamp(fp.y - S.dragOff.y, -11, 111);
    } else if (S.dragging.type === 'annotation') {
      const ann = findAnnotationById(S.dragging.id);
      if (ann) { /* note/arrow/zone/box mutation */ }
    }
    scheduleRender();
    return;
  }
}

function onPointerUp(e) {
  /* tap handling omitted */
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
}
```

## C. Playback Builder / Sampler Call Sites

Call-graph note:
- `computeChainedStepStates()` rebases each step start from the previous step end.
- `buildSequenceFrame()` is the sampler that turns chained steps into the animated frame payload.
- `render()` consumes that payload in sequence-preview mode.
- `animLoop()` advances `S.animT` and `S.currentStep`.

```js
// tactical-board.js:5640-5755 and 6092-6140
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
      const defPlayer = defLookup.get(key) || prevLookup.get(key);
      const defPath = defPlayer ? phasePathForPlayer(stepDef, defPlayer) : null;
      const finalPoint = defPath?.pts?.length ? defPath.pts[defPath.pts.length - 1] : null;
      return {
        ...(cloneData(defPlayer) || cloneData(prevPlayer) || {}),
        x: finalPoint ? finalPoint.x : defPlayer.x,
        y: finalPoint ? finalPoint.y : defPlayer.y,
      };
    });
    chained.push({ ...cloneStepState(stepDef), players, paths: cloneData(stepDef.paths), passes: cloneData(stepDef.passes) });
  }
  return chained;
}

function buildSequenceFrame(progress) {
  const localT = clamp(progress, 0, 1);
  let from = null;
  let to = null;
  let motionStep = null;
  if (isPhoneViewport && !S.playAll && sequenceStepCount() > 1) {
    const chainedSteps = computeChainedStepStates();
    const fromStepIdx = clamp(S.currentStep, 0, Math.max(0, sequenceStepCount() - 2));
    const toStepIdx = clamp(fromStepIdx + 1, 0, sequenceStepCount() - 1);
    from = cloneStepState(chainedSteps[fromStepIdx] || emptyStepState());
    to = cloneStepState(chainedSteps[toStepIdx] || from);
    motionStep = cloneStepState(S.steps[toStepIdx] || to);
  } else {
    const fromIdx = GamePlan.currentPhase;
    const toIdx = phasePlaybackTargetIndex(fromIdx);
    from = phasePlaybackStepAt(fromIdx);
    to = phasePlaybackStepAt(toIdx);
    motionStep = to;
  }
  /* frame.players built here from from/to + motionStep path data */
}

function animLoop(ts) {
  if (!S.animating) return;
  const DUR = playbackDurationSeconds();
  if (S.lastTs !== null) {
    S.animT = Math.min(1, S.animT + (ts - S.lastTs) / 1000 * S.animSpd / DUR);
    if (S.animT >= 1) {
      if (isPhoneViewport && !S.playAll && sequenceStepCount() > 1) {
        const lastStepIdx = sequenceStepCount() - 1;
        if (S.currentStep < lastStepIdx - 1) {
          S.currentStep += 1;
          S.animT = 0;
          /* render next move segment */
          requestAnimationFrame(animLoop);
          return;
        }
        S.currentStep = lastStepIdx;
        setLiveBoardFromStep(S.steps[lastStepIdx] || emptyStepState());
        S.animating = false;
        S.playAll = false;
        S.animT = 0;
        return;
      }
    }
  }
  S.lastTs = ts;
  render();
  updateTL();
  if (S.animating) requestAnimationFrame(animLoop);
}
```

## D. Phone / Desktop Branch In `resize()`

Call-graph note:
- This is the only high-level viewport-mode gate.
- Phone branch uses un-stretched field scale.
- Desktop branch keeps `FIELD_X_STRETCH`.

```js
// tactical-board.js:274-331
function resize() {
  const wrap = document.getElementById('canvasWrap');
  const isPhone = Math.min(window.innerWidth, window.innerHeight) <= 700;
  const MOBILE_PORTRAIT = isPhone && window.innerHeight > window.innerWidth;
  const PHONE_LANDSCAPE = isPhone && !MOBILE_PORTRAIT;
  renderDpr = Math.max(1, window.devicePixelRatio || 1);
  isPhoneViewport = isPhone;
  isMobilePortraitBoard = MOBILE_PORTRAIT;
  isPhoneLandscapeBoard = false;
  document.body.classList.toggle('is-phone', isPhone);
  document.body.classList.toggle('tb-mobile-portrait', MOBILE_PORTRAIT);
  syncMobileNotesPanelHost();

  const phoneBox = isPhone ? getPhoneCanvasBounds() : null;
  const wrapW = phoneBox?.width || wrap.clientWidth || wrap.getBoundingClientRect().width || cv.clientWidth || window.innerWidth;
  const wrapH = phoneBox?.height || wrap.clientHeight || wrap.getBoundingClientRect().height || cv.clientHeight || window.innerHeight;
  cvW = isPhone ? Math.max(1, Math.round(phoneBox?.width || wrapW)) : Math.max(1, Math.round(wrapW));
  cvH = isPhone ? Math.max(1, Math.round(phoneBox?.height || wrapH)) : Math.max(1, Math.round(wrapH));

  const padX = Math.max(6, Math.min(12, cvW * 0.008));
  const padY = Math.max(8, Math.min(14, cvH * 0.01));
  if (isPhone) {
    cv.style.width = `${cvW}px`;
    cv.style.height = `${cvH}px`;
    wrap.style.width = '';
    wrap.style.height = '';
    sc = Math.max(0.01, (cvW - padX * 2) / FVW);
    sx = sc;
    sy = sc;
  } else {
    cv.style.width = `${cvW}px`;
    cv.style.height = `${cvH}px`;
    wrap.style.width = '';
    wrap.style.height = '';
    cvH = Math.max(1, Math.round(cv.clientHeight || wrapH || (window.innerHeight * 0.6)));
    const baseFromWidth = (cvW - padX * 2) / (FVW * FIELD_X_STRETCH);
    const baseFromHeight = (cvH - padY * 2) / FVH;
    sc = Math.max(0.01, Math.min(baseFromWidth, baseFromHeight));
    sx = sc * FIELD_X_STRETCH;
    sy = sc;
  }
  syncCanvasResolution(cv, ctx, cvW, cvH);
  invalidateStaticFieldCache();
  if (isPhone) {
    phoneVerticalOverflowPx = Math.max(0, FVH * sy - cvH);
    phoneVerticalPanPx = clampPhoneVerticalPan(phoneVerticalPanPx);
    ox = (cvW - FVW * sx) / 2;
    oy = ((cvH - FVH * sy) / 2) + phoneVerticalPanPx;
  } else {
    phoneVerticalOverflowPx = 0;
    phoneVerticalPanPx = 0;
    ox = (cvW - FVW * sx) / 2;
    oy = (cvH - FVH * sy) / 2;
  }
  syncMobileBoardNameInput();
  updateMobileUI();
  render();
}
```
