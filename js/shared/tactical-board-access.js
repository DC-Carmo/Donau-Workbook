(function () {
  const TACTICAL_BOARD_ACCESS_CODE = "RDA2026";
  const STORAGE_KEY = "rda_tactical_board_access";
  const STYLE_ID = "rda-tactical-access-styles";
  let modalState = null;

  function isDevUnlockEnabled() {
    return window.RDADevelopmentAccess?.isEnabled?.() === true;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .request-modal-open {
        overflow: hidden;
      }

      .tactical-access-modal[hidden] {
        display: none;
      }

      .tactical-access-modal {
        position: fixed;
        inset: 0;
        z-index: 80;
      }

      .tactical-access-modal .request-modal-overlay {
        position: absolute;
        inset: 0;
        background: rgba(3, 8, 6, 0.78);
      }

      .tactical-access-modal .request-modal-dialog {
        position: relative;
        z-index: 1;
        width: min(500px, calc(100% - 24px));
        margin: min(10vh, 72px) auto 0;
        padding: 24px;
        border-radius: 24px;
        border: 1px solid rgba(108, 168, 139, 0.26);
        background: #07130f;
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.42);
        color: #f3f1e8;
        font-family: "Barlow", sans-serif;
      }

      .tactical-access-modal .request-modal-close {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 36px;
        height: 36px;
        border: 1px solid rgba(221, 228, 217, 0.12);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.03);
        color: #f3f1e8;
        cursor: pointer;
        font-size: 1rem;
      }

      .tactical-access-kicker,
      .tactical-access-modal .request-field span {
        color: #f3f1e8;
        font-family: "Barlow Condensed", sans-serif;
        font-size: 0.84rem;
        letter-spacing: 1.8px;
        text-transform: uppercase;
      }

      .tactical-access-modal .request-modal-title {
        margin: 8px 0 8px;
        font-family: "Barlow Condensed", sans-serif;
        font-size: clamp(1.7rem, 4vw, 2.3rem);
        letter-spacing: 1px;
        text-transform: uppercase;
      }

      .tactical-access-modal .request-modal-copy {
        margin: 0 0 20px;
        color: rgba(243, 241, 232, 0.8);
        line-height: 1.7;
      }

      .tactical-access-modal .request-form {
        display: grid;
        gap: 14px;
      }

      .tactical-access-modal .request-field {
        display: grid;
        gap: 8px;
      }

      .tactical-access-modal .request-field input {
        width: 100%;
        padding: 13px 14px;
        border-radius: 14px;
        border: 1px solid rgba(221, 228, 217, 0.12);
        background: rgba(255, 255, 255, 0.03);
        color: #f3f1e8;
        font: inherit;
      }

      .tactical-access-modal .request-field input:focus {
        outline: none;
        border-color: rgba(108, 168, 139, 0.42);
      }

      .tactical-access-modal .request-form-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 8px;
        align-items: center;
      }

      .tactical-access-submit {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 14px 18px;
        border: 1px solid rgba(227, 178, 60, 0.26);
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(227, 178, 60, 0.2), rgba(227, 178, 60, 0.08));
        color: #f3f1e8;
        font: inherit;
        cursor: pointer;
      }

      .tactical-access-request {
        padding: 0;
        border: 0;
        background: transparent;
        color: #e3b23c;
        font: inherit;
        cursor: pointer;
        text-decoration: underline;
        text-decoration-color: rgba(227, 178, 60, 0.45);
        text-underline-offset: 3px;
      }

      .tactical-access-error {
        margin: -4px 0 0;
        color: #ef8f7f;
        font-size: 0.94rem;
      }
    `;

    document.head.appendChild(style);
  }

  function storageAvailable() {
    try {
      return typeof window.sessionStorage !== "undefined";
    } catch (error) {
      return false;
    }
  }

  function hasAccess() {
    if (isDevUnlockEnabled()) {
      return true;
    }

    if (!storageAvailable()) {
      return false;
    }

    return window.sessionStorage.getItem(STORAGE_KEY) === "granted";
  }

  function grantAccess() {
    if (!storageAvailable()) {
      return;
    }

    window.sessionStorage.setItem(STORAGE_KEY, "granted");
  }

  function ensureModal() {
    if (modalState) {
      return modalState;
    }

    ensureStyles();

    const modal = document.createElement("div");
    modal.className = "request-modal tactical-access-modal";
    modal.id = "tacticalAccessModal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="request-modal-overlay" data-close-tactical-access></div>
      <div class="request-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="tacticalAccessTitle">
        <button class="request-modal-close" type="button" aria-label="Close" data-close-tactical-access>&times;</button>
        <div class="tactical-access-kicker">Restricted Area</div>
        <h2 class="request-modal-title" id="tacticalAccessTitle">Tactical Board Access</h2>
        <p class="request-modal-copy">This area is reserved for approved coaches and players.</p>
        <form class="request-form" id="tacticalAccessForm">
          <label class="request-field" for="tacticalAccessCode">
            <span>Access Code</span>
            <input id="tacticalAccessCode" name="access_code" type="password" autocomplete="off" required>
          </label>
          <p class="tactical-access-error" id="tacticalAccessError" hidden>Invalid access code</p>
          <div class="request-form-actions">
            <button class="tactical-access-submit" type="submit">
              Enter
              <span>&#9654;</span>
            </button>
            <button class="tactical-access-request" type="button" id="tacticalAccessRequestBtn">Request access</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const codeInput = modal.querySelector("#tacticalAccessCode");
    const error = modal.querySelector("#tacticalAccessError");
    const form = modal.querySelector("#tacticalAccessForm");
    const closeButtons = modal.querySelectorAll("[data-close-tactical-access]");
    const requestButton = modal.querySelector("#tacticalAccessRequestBtn");

    modalState = {
      codeInput,
      error,
      form,
      modal,
      onRequestAccess: null,
      targetUrl: "",
      trigger: null,
    };

    function resetState() {
      form.reset();
      error.hidden = true;
    }

    function closeModal() {
      modal.hidden = true;
      document.body.classList.remove("request-modal-open");
      resetState();

      if (modalState.trigger && typeof modalState.trigger.focus === "function") {
        modalState.trigger.focus();
      }
    }

    function navigateToTarget() {
      if (modalState.targetUrl) {
        window.location.href = modalState.targetUrl;
      }
    }

    closeButtons.forEach((button) => {
      button.addEventListener("click", closeModal);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) {
        closeModal();
      }
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      if (codeInput.value.trim() === TACTICAL_BOARD_ACCESS_CODE) {
        grantAccess();
        closeModal();
        navigateToTarget();
        return;
      }

      error.hidden = false;
      codeInput.focus();
      codeInput.select();
    });

    requestButton.addEventListener("click", () => {
      const requestHandler = modalState.onRequestAccess;
      closeModal();

      if (typeof requestHandler === "function") {
        requestHandler();
      }
    });

    modalState.closeModal = closeModal;
    modalState.resetState = resetState;
    return modalState;
  }

  function openAccessModal(options) {
    const state = ensureModal();
    state.targetUrl = options?.targetUrl || "";
    state.trigger = options?.trigger || null;
    state.onRequestAccess = options?.onRequestAccess || null;
    state.resetState();
    state.modal.hidden = false;
    document.body.classList.add("request-modal-open");
    state.codeInput.focus();
  }

  function requestAccess(options) {
    if (hasAccess()) {
      if (options?.targetUrl) {
        window.location.href = options.targetUrl;
      }

      return;
    }

    openAccessModal(options);
  }

  function protectPage(options) {
    if (hasAccess()) {
      return true;
    }

    const redirectUrl = options?.redirectUrl || "../../index.html";
    window.location.replace(redirectUrl);
    return false;
  }

  window.RDATacticalBoardAccess = {
    TACTICAL_BOARD_ACCESS_CODE,
    hasAccess,
    protectPage,
    requestAccess,
  };
})();
