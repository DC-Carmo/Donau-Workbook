# Animator Snippet Extract For External Review
Call-graph note: token paint splits inside `render()`; playback uses `frame.players`, edit mode now dedupes through `uniquePlayersByRef(S.players)` before painting full tokens.

```js
if (shouldRenderSequencePreview()) {
  const frame = buildSequenceFrame(S.animT);
  const playerLookup = new Map(frame.players.map(pl => [playerKey(pl), pl]));
  const animatedKickBall = resolveAnimatedKickBall(frame, playerLookup);
  renderAnnotations('zones', frame.annotations);
  frame.paths.forEach(path => {
    if (path.pts.length < 2) return;
    drawRunPath(path.pts, path.team === 'A' ? '#60a5fa' : '#f87171', 2.8, 1);
  });
  renderAnnotations('lines', frame.annotations);
  renderPathOriginMarkers(frame.players, frame.paths);
  frame.players.forEach(pl => drawPlayer(pl.x, pl.y, pl.num, pl.team, false, samePlayerRef(playerRef(pl), frame.ballOwner), playerColorPalette(pl)));
  const frameBall = animatedKickBall || frame.ball;
  if (frameBall) drawBall(frameBall.x, frameBall.y, false);
  return;
}

const t = S.animating ? S.animT : 0;
const animatedKickBall = resolveLiveAnimatedKickBall(t);
renderAnnotations('zones');

S.paths.forEach(path => {
  if (path.pts.length < 2) return;
  const isSelected = S.selectedPathPid === path.pid;
  drawRunPath(path.pts, path.color, 2.8, t > 0 ? t : 1, false, isSelected);
});

renderAnnotations('lines');
renderPhoneEditMovementGuides();
renderPathOriginMarkers();

const livePlayers = uniquePlayersByRef(S.players);
livePlayers.forEach(pl => {
  const pos = S.animating ? animPos(pl, t) : pl;
  const sel = isPlayerSelected(pl.id);
  drawPlayer(pos.x, pos.y, pl.num, pl.team, sel, pl.isBC, playerColorPalette(pl));
});
const liveBall = animatedKickBall || S.ball;
if (liveBall) drawBall(liveBall.x, liveBall.y, isBallSelected());
```

Call-graph note: `handlePointerDown()` seeds drag state, `handlePointerMove()` mutates live board objects, and `onPointerUp()` writes the live board into the current step.

```js
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
    return;
  }
  if (pl) {
    const activeGroup = activeGroupForPlayer(pl);
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
      beginPointerTap(e.pointerId, { type:'player', id:pl.id, canvasX: canvasPoint.x, canvasY: canvasPoint.y }, e);
    }
  } else if (ballHit) {
    snapshot();
    clearDragPlayer();
    clearPassKickState();
    S.dragging  = { type:'ball' };
    S.dragOff   = { x:fp.x - S.ball.x, y:fp.y - S.ball.y };
    if (S.ballAttached) S.ballAttached = false;
    beginPointerTap(e.pointerId, { type:'ball' }, e);
  }
}
```

```js
if (S.dragging) {
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
  }
  scheduleRender();
  return;
}
```

```js
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
```

Call-graph note: `computeChainedStepStates()` rebases from prior move ends, `buildSequenceFrame()` samples those rebased states, and `animLoop()` advances the move cursor.

```js
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

  chained.push({
    ...cloneStepState(stepDef),
    players,
    ball: resolveStepBall(stepDef),
    ballOwner: normalizePlayerRef(stepDef.ballOwner),
    ballAttached: !!stepDef.ballAttached,
    paths: cloneData(stepDef.paths),
    passes: cloneData(stepDef.passes),
    annotations: cloneData(stepDef.annotations),
  });
}
```

```js
if (isPhoneViewport && !S.playAll && sequenceStepCount() > 1) {
  const chainedSteps = computeChainedStepStates();
  const stepCount = sequenceStepCount();
  const fromStepIdx = clamp(S.currentStep, 0, Math.max(0, stepCount - 2));
  const toStepIdx = clamp(fromStepIdx + 1, 0, stepCount - 1);
  from = cloneStepState(chainedSteps[fromStepIdx] || emptyStepState());
  to = cloneStepState(chainedSteps[toStepIdx] || from);
  motionStep = cloneStepState(S.steps[toStepIdx] || to);
} else {
  const fromIdx = GamePlan.currentPhase;
  const toIdx = phasePlaybackTargetIndex(fromIdx);
  from = phasePlaybackStepAt(fromIdx);
  if (toIdx === null) {
    return { ...from, segmentIndex: fromIdx, localT: 0 };
  }
  to = phasePlaybackStepAt(toIdx);
  motionStep = to;
}

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
```

```js
if (S.lastTs !== null) {
  S.animT = Math.min(1, S.animT + (ts - S.lastTs) / 1000 * S.animSpd / DUR);
  if (S.animT >= 1 && isPhoneViewport && !S.playAll && sequenceStepCount() > 1) {
    const lastStepIdx = sequenceStepCount() - 1;
    if (S.currentStep < lastStepIdx - 1) {
      S.currentStep += 1;
      S.animT = 0;
      S.lastTs = ts;
      updateTL();
      updateMobileUI();
      render();
      requestAnimationFrame(animLoop);
      return;
    }
  }
}
```

Call-graph note: `resize()` is the single phone/desktop branch; `isPhone` flips mode flags and picks phone `sx = sy = sc` versus desktop `sx = sc * FIELD_X_STRETCH`.

```js
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
```
