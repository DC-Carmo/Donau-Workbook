(function () {
  // Configure before loading this script:
  //   window.PLAYER_ACCESS_CONFIG = { code: "DONAU25", team: "Donau", storageKey: "donau_player_access" }
  const cfg = window.PLAYER_ACCESS_CONFIG || {};
  const ACCESS_CODE  = cfg.code       || "DONAU25";
  const TEAM_LABEL   = cfg.team       || "Player";
  const STORAGE_KEY  = cfg.storageKey || "player_access";
  const STYLE_ID     = "rda-player-access-styles";
  let modalState = null;

  function isDevUnlockEnabled() {
    return window.RDADevelopmentAccess?.isEnabled?.() === true;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .player-modal-open { overflow: hidden; }

      .player-access-modal[hidden] { display: none; }

      .player-access-modal {
        position: fixed;
        inset: 0;
        z-index: 9000;
      }

      .player-access-modal .pa-overlay {
        position: absolute;
        inset: 0;
        background: rgba(3, 7, 15, 0.88);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
      }

      .player-access-modal .pa-dialog {
        position: relative;
        z-index: 1;
        width: min(480px, calc(100% - 32px));
        margin: min(12vh, 80px) auto 0;
        padding: 28px 24px 24px;
        border-radius: 22px;
        border: 1px solid rgba(46, 139, 87, 0.28);
        background: linear-gradient(160deg, rgba(6, 16, 10, 0.99), rgba(4, 10, 7, 0.99));
        box-shadow: 0 32px 96px rgba(0, 0, 0, 0.5), 0 0 48px rgba(46, 139, 87, 0.08);
        color: #f0f4f0;
        font-family: "Barlow", sans-serif;
      }

      .player-access-modal .pa-close {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 34px;
        height: 34px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.03);
        color: #f0f4f0;
        cursor: pointer;
        font-size: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .pa-kicker {
        font-family: "Barlow Condensed", sans-serif;
        font-size: 0.72rem;
        letter-spacing: 2.4px;
        text-transform: uppercase;
        color: rgba(110, 195, 145, 0.75);
        margin-bottom: 8px;
      }

      .pa-title {
        margin: 0 0 8px;
        font-family: "Barlow Condensed", sans-serif;
        font-size: clamp(1.6rem, 4vw, 2.1rem);
        letter-spacing: 1px;
        text-transform: uppercase;
        color: #f0f4f0;
      }

      .pa-copy {
        margin: 0 0 20px;
        color: rgba(240, 244, 240, 0.68);
        font-size: 0.9rem;
        line-height: 1.65;
      }

      .pa-field {
        display: grid;
        gap: 7px;
        margin-bottom: 14px;
      }

      .pa-field span {
        font-family: "Barlow Condensed", sans-serif;
        font-size: 0.76rem;
        letter-spacing: 1.8px;
        text-transform: uppercase;
        color: rgba(240, 244, 240, 0.6);
      }

      .pa-field input {
        width: 100%;
        padding: 13px 14px;
        border-radius: 13px;
        border: 1px solid rgba(46, 139, 87, 0.22);
        background: rgba(255, 255, 255, 0.03);
        color: #f0f4f0;
        font: inherit;
        font-size: 1rem;
        letter-spacing: 2px;
        box-sizing: border-box;
      }

      .pa-field input:focus {
        outline: none;
        border-color: rgba(46, 139, 87, 0.5);
        box-shadow: 0 0 0 2px rgba(46, 139, 87, 0.1);
      }

      .pa-error {
        margin: -8px 0 10px;
        color: #ef8f7f;
        font-size: 0.88rem;
      }

      .pa-submit {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 13px 20px;
        border-radius: 999px;
        border: 1px solid rgba(46, 139, 87, 0.4);
        background: linear-gradient(135deg, rgba(22, 95, 54, 0.96), rgba(46, 139, 87, 0.92));
        color: rgba(215, 255, 232, 0.96);
        font-family: "Barlow Condensed", sans-serif;
        font-size: 0.86rem;
        font-weight: 700;
        letter-spacing: 2px;
        text-transform: uppercase;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(46, 139, 87, 0.2);
        transition: box-shadow 160ms ease, transform 160ms ease;
      }

      .pa-submit:hover {
        box-shadow: 0 12px 32px rgba(46, 139, 87, 0.3);
        transform: translateY(-1px);
      }
    `;
    document.head.appendChild(style);
  }

  function storageAvailable() {
    try { return typeof window.sessionStorage !== "undefined"; }
    catch { return false; }
  }

  function hasAccess() {
    if (isDevUnlockEnabled()) return true;
    if (!storageAvailable()) return false;
    return window.sessionStorage.getItem(STORAGE_KEY) === "true";
  }

  function grantAccess() {
    if (storageAvailable()) window.sessionStorage.setItem(STORAGE_KEY, "true");
  }

  function ensureModal() {
    if (modalState) return modalState;
    ensureStyles();

    const modal = document.createElement("div");
    modal.className = "player-access-modal";
    modal.id = "playerAccessModal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="pa-overlay" data-close-player></div>
      <div class="pa-dialog" role="dialog" aria-modal="true" aria-labelledby="paTitle">
        <button class="pa-close" type="button" aria-label="Close" data-close-player>&times;</button>
        <div class="pa-kicker">${TEAM_LABEL} · Players Only</div>
        <h2 class="pa-title" id="paTitle">Player Access</h2>
        <p class="pa-copy">This area is restricted to players. Enter the access code given to you by your coach.</p>
        <form id="playerAccessForm">
          <div class="pa-field">
            <span>Access Code</span>
            <input id="playerAccessCode" name="access_code" type="password" autocomplete="off" required placeholder="Enter code"/>
          </div>
          <p class="pa-error" id="playerAccessError" hidden>Incorrect code — check with your coach.</p>
          <button class="pa-submit" type="submit">
            Enter
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const codeInput = modal.querySelector("#playerAccessCode");
    const error     = modal.querySelector("#playerAccessError");
    const form      = modal.querySelector("#playerAccessForm");
    const closeBtns = modal.querySelectorAll("[data-close-player]");

    modalState = { codeInput, error, form, modal, targetUrl: "", trigger: null };

    function resetState() { form.reset(); error.hidden = true; }

    function closeModal() {
      modal.hidden = true;
      document.body.classList.remove("player-modal-open");
      resetState();
      if (modalState.trigger?.focus) modalState.trigger.focus();
    }

    closeBtns.forEach(b => b.addEventListener("click", closeModal));
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });

    form.addEventListener("submit", e => {
      e.preventDefault();
      if (codeInput.value.trim() === ACCESS_CODE) {
        grantAccess();
        closeModal();
        if (modalState.targetUrl) window.location.href = modalState.targetUrl;
        return;
      }
      error.hidden = false;
      codeInput.focus();
      codeInput.select();
    });

    modalState.closeModal = closeModal;
    modalState.resetState = resetState;
    return modalState;
  }

  function requestAccess(options) {
    if (hasAccess()) {
      if (options?.targetUrl) window.location.href = options.targetUrl;
      return;
    }
    const state = ensureModal();
    state.targetUrl = options?.targetUrl || "";
    state.trigger   = options?.trigger || null;
    state.resetState();
    state.modal.hidden = false;
    document.body.classList.add("player-modal-open");
    state.codeInput.focus();
  }

  function protectPage(options) {
    if (hasAccess()) return true;
    // Show modal immediately — don't redirect (better UX on mobile)
    requestAccess(options);
    return false;
  }

  window.RDAPlayerAccess = { hasAccess, grantAccess, requestAccess, protectPage };
})();
