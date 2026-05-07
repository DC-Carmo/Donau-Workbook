(function () {
  const AUSTRIA_YOUTH_ACCESS_CODE = "UdineU16";
  const STORAGE_KEY = "austria_youth_access";
  const STYLE_ID = "rda-austria-youth-access-styles";
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

      .austria-access-modal[hidden] {
        display: none;
      }

      .austria-access-modal {
        position: fixed;
        inset: 0;
        z-index: 85;
      }

      .austria-access-modal .request-modal-overlay {
        position: absolute;
        inset: 0;
        background: rgba(3, 8, 6, 0.78);
      }

      .austria-access-modal .request-modal-dialog {
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

      .austria-access-modal .request-modal-close {
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

      .austria-access-kicker,
      .austria-access-modal .request-field span {
        color: #f3f1e8;
        font-family: "Barlow Condensed", sans-serif;
        font-size: 0.84rem;
        letter-spacing: 1.8px;
        text-transform: uppercase;
      }

      .austria-access-modal .request-modal-title {
        margin: 8px 0 8px;
        font-family: "Barlow Condensed", sans-serif;
        font-size: clamp(1.7rem, 4vw, 2.3rem);
        letter-spacing: 1px;
        text-transform: uppercase;
      }

      .austria-access-modal .request-modal-copy {
        margin: 0 0 20px;
        color: rgba(243, 241, 232, 0.8);
        line-height: 1.7;
      }

      .austria-access-modal .request-form {
        display: grid;
        gap: 14px;
      }

      .austria-access-modal .request-field {
        display: grid;
        gap: 8px;
      }

      .austria-access-modal .request-field input {
        width: 100%;
        padding: 13px 14px;
        border-radius: 14px;
        border: 1px solid rgba(221, 228, 217, 0.12);
        background: rgba(255, 255, 255, 0.03);
        color: #f3f1e8;
        font: inherit;
      }

      .austria-access-modal .request-field input:focus {
        outline: none;
        border-color: rgba(108, 168, 139, 0.42);
      }

      .austria-access-modal .request-form-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 8px;
        align-items: center;
      }

      .austria-access-submit {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 14px 18px;
        border: 1px solid rgba(44, 164, 120, 0.34);
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(20, 119, 87, 0.96), rgba(34, 158, 118, 0.92));
        color: #f3f1e8;
        font: inherit;
        cursor: pointer;
      }

      .austria-access-error {
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
    } catch {
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

    return window.sessionStorage.getItem(STORAGE_KEY) === "true";
  }

  function grantAccess() {
    if (!storageAvailable()) {
      return;
    }

    window.sessionStorage.setItem(STORAGE_KEY, "true");
  }

  function ensureModal() {
    if (modalState) {
      return modalState;
    }

    ensureStyles();

    const modal = document.createElement("div");
    modal.className = "request-modal austria-access-modal";
    modal.id = "austriaYouthAccessModal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="request-modal-overlay" data-close-austria-access></div>
      <div class="request-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="austriaAccessTitle">
        <button class="request-modal-close" type="button" aria-label="Close" data-close-austria-access>&times;</button>
        <div class="austria-access-kicker">Austria Youth</div>
        <h2 class="request-modal-title" id="austriaAccessTitle">Austria Youth Access</h2>
        <p class="request-modal-copy">This area is restricted to selected players.</p>
        <form class="request-form" id="austriaAccessForm">
          <label class="request-field" for="austriaAccessCode">
            <span>Access Code</span>
            <input id="austriaAccessCode" name="access_code" type="password" autocomplete="off" required>
          </label>
          <p class="austria-access-error" id="austriaAccessError" hidden>Invalid access code</p>
          <div class="request-form-actions">
            <button class="austria-access-submit" type="submit">
              Enter
              <span>&#9654;</span>
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const codeInput = modal.querySelector("#austriaAccessCode");
    const error = modal.querySelector("#austriaAccessError");
    const form = modal.querySelector("#austriaAccessForm");
    const closeButtons = modal.querySelectorAll("[data-close-austria-access]");

    modalState = {
      codeInput,
      error,
      form,
      modal,
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

      if (codeInput.value.trim() === AUSTRIA_YOUTH_ACCESS_CODE) {
        grantAccess();
        closeModal();
        if (modalState.targetUrl) {
          window.location.href = modalState.targetUrl;
        }
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
      if (options?.targetUrl) {
        window.location.href = options.targetUrl;
      }
      return;
    }

    const state = ensureModal();
    state.targetUrl = options?.targetUrl || "";
    state.trigger = options?.trigger || null;
    state.resetState();
    state.modal.hidden = false;
    document.body.classList.add("request-modal-open");
    state.codeInput.focus();
  }

  function protectPage(options) {
    if (hasAccess()) {
      return true;
    }

    const redirectUrl = options?.redirectUrl || "../../index.html";
    window.location.replace(redirectUrl);
    return false;
  }

  window.RDAAustriaYouthAccess = {
    AUSTRIA_YOUTH_ACCESS_CODE,
    grantAccess,
    hasAccess,
    protectPage,
    requestAccess,
  };
})();
