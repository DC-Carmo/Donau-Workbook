# iOS Safari Scroll Lock — What Works and What Doesn't

## The Problem

On iOS Safari, when a user drags their finger, the OS assigns the scroll gesture to
exactly **one scroll container** — and it defaults to the viewport (the page itself).
Fixed-position overlays and drawers with `overflow-y: auto` are NOT automatically
considered as scroll targets, regardless of CSS properties.

This means: if you open a modal or a slide-up drawer and try to scroll its content,
iOS scrolls the background page instead.

---

## Approaches That Do NOT Work on iOS Safari

| Approach | Why it fails |
|---|---|
| `html { overflow: hidden }` | iOS ignores this; the page still scrolls |
| `body { overflow: hidden }` | Same — iOS ignores overflow:hidden on html/body for scroll prevention |
| `html, body { overflow: hidden }` | Blocks ALL touch-scroll everywhere, including inside the overlay |
| `body { position: fixed }` | Freezes the body, but also kills touch routing to **all** fixed children (drawer, overlay). Nothing inside a fixed overlay can be scrolled by touch. |
| `touchmove` handler that **returns** without `preventDefault` | iOS still routes the gesture to the viewport. Returning without preventDefault does not tell iOS to re-route to the child scroll container. |
| `-webkit-overflow-scrolling: touch` alone | Enables momentum scroll, but doesn't redirect gesture ownership away from the viewport |

---

## The Solution That Works

Take over gesture routing completely with JavaScript:

1. Register a `touchstart` listener that **finds the nearest scrollable ancestor** of
   the touch target (walking up the DOM, looking for `overflow-y: auto/scroll` with
   actual overflow content).
2. Register a `touchmove` listener that:
   - **Always calls `e.preventDefault()`** — this kills iOS's native gesture routing
   - **Manually drives `scrollEl.scrollTop`** using the touch delta

```js
function lockMobileBodyScroll() {
  if (!isMobileViewport() || _touchLock) return;

  let startY = 0;
  let scrollEl = null;
  let scrollStartTop = 0;

  function onStart(e) {
    startY = e.touches[0].clientY;
    scrollEl = null;
    let el = e.target;
    while (el && el !== document.documentElement) {
      const oy = window.getComputedStyle(el).overflowY;
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) {
        scrollEl = el;
        scrollStartTop = el.scrollTop;
        break;
      }
      el = el.parentElement;
    }
  }

  function onMove(e) {
    e.preventDefault(); // kill iOS native routing — no background scroll
    if (!scrollEl) return;
    // absolute position avoids accumulation errors across frames
    scrollEl.scrollTop = scrollStartTop + (startY - e.touches[0].clientY);
  }

  _touchLock = { onStart, onMove };
  document.addEventListener("touchstart", onStart, { passive: true });
  document.addEventListener("touchmove", onMove, { passive: false }); // passive:false required for preventDefault
}

function unlockMobileBodyScroll() {
  if (!_touchLock) return;
  document.removeEventListener("touchstart", _touchLock.onStart);
  document.removeEventListener("touchmove", _touchLock.onMove);
  _touchLock = null;
}
```

**Critical requirements:**
- `touchmove` must be registered with `{ passive: false }`. A passive listener cannot
  call `preventDefault` — the browser will throw a warning and ignore it.
- `touchstart` should be `{ passive: true }` (it doesn't need to preventDefault).
- Use **absolute position** (`scrollStartTop + totalDelta`) not incremental delta
  (`scrollTop += step`) to avoid drift when frames are dropped.
- Call `lockMobileBodyScroll()` when opening any overlay or drawer; call
  `unlockMobileBodyScroll()` when closing.

---

## Key Mental Model

> iOS Safari does not scroll "the element you're touching."  
> It scrolls "the scroll container iOS has decided owns this gesture."  
> That decision is made at gesture start and cannot be changed by CSS after the fact.  
> The only way to override it is to cancel the gesture entirely and re-implement scroll in JS.

---

## Implementation in This Project

- **Donau** (`js/core/app.js`): `lockMobileBodyScroll()` / `unlockMobileBodyScroll()`
  using the pattern above. Called from `syncMobileViewportState()` (drawer) and
  `openOverlay()` / `closeOverlay()` (coach intro and other overlays).

- **Austria U18** (`environments/austria-u18/app.js`): Same pattern in
  `lockMobileBodyScroll()` for the module drawer. Overlays use a parallel system
  (`handleModalScrollTouchMove`) that was already correct — it also uses
  `preventDefault` + manual `scrollTop` with velocity-based momentum.

---

## What to Check When Scroll Breaks Again

1. Is `lockMobileBodyScroll()` being called when the overlay/drawer opens?
2. Is the `touchmove` listener registered with `{ passive: false }`?
3. Does the scrollable container have `scrollHeight > clientHeight`? (i.e., is there
   actually content to scroll? Check in DevTools.)
4. Is the user starting their touch **inside** the scrollable container? The `onStart`
   handler only captures `scrollEl` if the initial touch is inside the scroll area.
   A touch that starts outside and drags in will not scroll.
