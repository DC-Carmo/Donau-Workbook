(function () {
  const data = window.AUSTRIA_U18_DATA || {};
  const { addMsg, removeTyping, showTyping } = window.DonauShared || {};

  const workspaceSections = data.workspaceSections || [];
  const total = document.querySelectorAll(".slide").length;
  let cur = 1;
  const MOBILE_BREAKPOINT = 768;
  const MOBILE_ENVIRONMENT_LABEL = "Austria Youth";
  let mobileWorkspaceMenuOpen = false;
  let overlayScrollLockCount = 0;
  let lockedScrollY = 0;
  let overlayTouchStartY = 0;
  let overlayTouchStartX = 0;
  let modalScrollLastTouchY = 0;
  let modalScrollLastTouchTime = 0;
  let modalScrollVelocity = 0;
  let modalScrollFrame = null;
  let activeModalScrollContainer = null;

  function isMobileViewport() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  function openFieldLightbox(src, alt) {
    const lb = document.getElementById("fieldLightbox");
    const img = document.getElementById("fieldLightboxImg");
    img.src = src;
    img.alt = alt || "";
    lb.classList.add("open");
    document.addEventListener("keydown", fieldLightboxEsc);
  }

  function closeFieldLightbox(event) {
    const lightbox = document.getElementById("fieldLightbox");
    if (
      event &&
      event.target !== lightbox &&
      !event.target.classList.contains("field-lightbox-close")
    ) {
      return;
    }

    lightbox.classList.remove("open");
    document.removeEventListener("keydown", fieldLightboxEsc);
  }

  function fieldLightboxEsc(event) {
    if (event.key === "Escape") {
      closeFieldLightbox();
    }
  }

  function openDiagramLightbox(src, alt) {
    const lb = document.getElementById("diagramLightbox");
    const img = document.getElementById("diagramLightboxImg");
    img.src = src;
    img.alt = alt || "";
    lb.classList.add("open");
    document.addEventListener("keydown", diagramLightboxEsc);
  }

  function closeDiagramLightbox(event) {
    const lightbox = document.getElementById("diagramLightbox");
    if (
      event &&
      event.target !== lightbox &&
      !event.target.classList.contains("diagram-lightbox-close")
    ) {
      return;
    }

    lightbox.classList.remove("open");
    document.removeEventListener("keydown", diagramLightboxEsc);
  }

  function diagramLightboxEsc(event) {
    if (event.key === "Escape") {
      closeDiagramLightbox();
    }
  }

  function lockBodyScroll() {
    if (overlayScrollLockCount === 0) {
      lockedScrollY = window.scrollY || window.pageYOffset || 0;
      document.body.style.position = "fixed";
      document.body.style.top = `-${lockedScrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }

    overlayScrollLockCount += 1;
    document.body.classList.add("overlay-active");
  }

  function unlockBodyScroll() {
    if (overlayScrollLockCount > 0) {
      overlayScrollLockCount -= 1;
    }

    if (overlayScrollLockCount > 0) {
      return;
    }

    document.body.classList.remove("overlay-active");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, lockedScrollY);
  }

  function hasActiveOverlay() {
    return Boolean(
      document.querySelector(".overlay.open") ||
      document.querySelector(".lineout-system-overlay.open")
    );
  }

  function getOverlayScrollContainer(target) {
    if (!(target instanceof Element)) {
      return null;
    }

    return target.closest(".overlay-body");
  }

  function stopModalScrollMomentum() {
    if (modalScrollFrame !== null) {
      cancelAnimationFrame(modalScrollFrame);
      modalScrollFrame = null;
    }
  }

  function startModalScrollMomentum() {
    if (!activeModalScrollContainer || Math.abs(modalScrollVelocity) < 0.1) {
      return;
    }

    stopModalScrollMomentum();

    const step = () => {
      if (!activeModalScrollContainer) {
        modalScrollFrame = null;
        return;
      }

      activeModalScrollContainer.scrollTop += modalScrollVelocity;
      modalScrollVelocity *= 0.97;

      if (Math.abs(modalScrollVelocity) < 0.1) {
        modalScrollFrame = null;
        return;
      }

      modalScrollFrame = requestAnimationFrame(step);
    };

    modalScrollFrame = requestAnimationFrame(step);
  }

  function handleModalScrollTouchStart(event) {
    const scrollContainer = getOverlayScrollContainer(event.target);
    if (!scrollContainer || !event.touches.length) {
      return;
    }

    stopModalScrollMomentum();
    activeModalScrollContainer = scrollContainer;
    modalScrollLastTouchY = event.touches[0].clientY;
    modalScrollLastTouchTime = performance.now();
    modalScrollVelocity = 0;
  }

  function handleModalScrollTouchMove(event) {
    const scrollContainer = getOverlayScrollContainer(event.target);
    if (!scrollContainer || !event.touches.length) {
      return;
    }

    const currentY = event.touches[0].clientY;
    const currentTime = performance.now();
    const deltaY = modalScrollLastTouchY - currentY;
    const deltaTime = Math.max(1, currentTime - modalScrollLastTouchTime);

    scrollContainer.scrollTop += deltaY;
    modalScrollVelocity = (modalScrollVelocity * 0.82) + ((deltaY / deltaTime) * 16 * 0.18);
    modalScrollLastTouchY = currentY;
    modalScrollLastTouchTime = currentTime;
    event.preventDefault();
  }

  function handleModalScrollTouchEnd() {
    startModalScrollMomentum();
  }

  function handleOverlayTouchStart(event) {
    if (!hasActiveOverlay() || !event.touches.length) {
      return;
    }

    overlayTouchStartY = event.touches[0].clientY;
    overlayTouchStartX = event.touches[0].clientX;
  }

  function handleOverlayTouchMove(event) {
    if (!hasActiveOverlay() || !event.touches.length) {
      return;
    }

    const scrollContainer = getOverlayScrollContainer(event.target);

    if (!scrollContainer) {
      event.preventDefault();
      return;
    }

    const currentY = event.touches[0].clientY;
    const currentX = event.touches[0].clientX;
    const deltaY = currentY - overlayTouchStartY;
    const deltaX = currentX - overlayTouchStartX;
    const isMostlyVertical = Math.abs(deltaY) >= Math.abs(deltaX);

    if (!isMostlyVertical) {
      event.preventDefault();
      return;
    }

    const atTop = scrollContainer.scrollTop <= 0;
    const atBottom =
      Math.ceil(scrollContainer.scrollTop + scrollContainer.clientHeight) >=
      scrollContainer.scrollHeight;

    if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
      event.preventDefault();
    }
  }

  function openOverlay(id) {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }

    el.classList.add("open");
    lockBodyScroll();
    const closeButton = el.querySelector(".overlay-close");
    if (closeButton) {
      closeButton.focus();
    }
    document.addEventListener("keydown", overlayKeyHandler);
  }

  function closeOverlay(id) {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }

    el.classList.remove("open");
    if (!hasActiveOverlay()) {
      unlockBodyScroll();
    }

    document.removeEventListener("keydown", overlayKeyHandler);
  }

  function overlayKeyHandler(event) {
    if (event.key === "Escape") {
      document.querySelectorAll(".overlay.open").forEach((overlay) => overlay.classList.remove("open"));
      unlockBodyScroll();
      document.removeEventListener("keydown", overlayKeyHandler);
    }
  }

  function toggleFieldMap() {
    toggleExpandablePanel("fieldAreasBtn", "fieldMapPanel");
  }

  function toggleForwardPodsMap() {
    toggleExpandablePanel("forwardPodsBtn", "forwardPodsMapPanel");
  }

  function toggleExpandablePanel(buttonId, panelId) {
    const btn = document.getElementById(buttonId);
    const panel = document.getElementById(panelId);
    if (!btn || !panel) {
      return;
    }

    const isOpen = panel.classList.contains("open");
    panel.classList.toggle("open", !isOpen);
    btn.classList.toggle("open", !isOpen);
    btn.setAttribute("aria-expanded", String(!isOpen));
  }

  function toggleFieldArea(el) {
    const isOpen = el.classList.contains("open");
    document.querySelectorAll(".field-area").forEach((fieldArea) => {
      fieldArea.classList.remove("open");
      fieldArea.setAttribute("aria-expanded", "false");
    });

    if (!isOpen) {
      el.classList.add("open");
      el.setAttribute("aria-expanded", "true");
    }
  }

  function buildDots() {
    const dots = document.getElementById("dots");
    for (let i = 1; i <= total; i += 1) {
      const dot = document.createElement("div");
      dot.className = `dot${i === 1 ? " active" : ""}`;
      dot.setAttribute("role", "tab");
      dot.setAttribute("tabindex", "0");
      dot.setAttribute("aria-label", `Slide ${i}`);
      dot.setAttribute("aria-selected", i === 1 ? "true" : "false");
      dot.onclick = () => goTo(i);
      dot.onkeydown = (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          goTo(i);
        }
      };
      dots.appendChild(dot);
    }
  }

  function buildPortalReturnLinks() {
    document.querySelectorAll(".topbar").forEach((topbar) => {
      if (topbar.querySelector(".portal-return")) {
        return;
      }

      const link = document.createElement("a");
      link.className = "portal-return portal-inline";
      link.href = "../../index.html";
      link.innerHTML = "<span>&#9664;</span> Back to Portal";

      const topbarRight = topbar.querySelector(".topbar-right");
      if (topbarRight) {
        topbar.insertBefore(link, topbarRight);
      } else {
        topbar.appendChild(link);
      }
    });
  }

  function buildWorkspaceMap() {
    const slides = document.querySelectorAll(".slide");
    const groups = [...new Set(workspaceSections.map((section) => section.group))];

    slides.forEach((slide) => {
      const nav = document.createElement("div");
      nav.className = "workspace-map";
      nav.innerHTML = `
        <div class="workspace-map-inner">
          ${groups.map((group) => {
            const items = workspaceSections.filter((section) => section.group === group);
            return `
              <div class="workspace-track" data-group="${group}">
                <div class="workspace-track-head">
                  <div class="workspace-track-label">${group}</div>
                  <div class="workspace-track-meta">${items.length} sections</div>
                </div>
                <div class="workspace-track-items">
                  ${items.map((section) => `
                    <button class="workspace-map-item" type="button" data-slide="${section.slide}" onclick="goTo(${section.slide})">
                      <span class="workspace-item-num">${String(section.slide).padStart(2, "0")}</span>
                      <span class="workspace-item-copy">
                        <span class="workspace-item-short">${section.shortLabel}</span>
                        <span class="workspace-item-title">${section.title}</span>
                      </span>
                    </button>
                  `).join("")}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;

      slide.querySelector(".topbar").insertAdjacentElement("afterend", nav);
    });
  }

  function buildWorkspaceShellStatus() {
    document.querySelectorAll(".slide").forEach((slide) => {
      const topbarRight = slide.querySelector(".topbar-right");
      if (!topbarRight || topbarRight.querySelector(".workspace-shell-status")) {
        return;
      }

      const shellStatus = document.createElement("div");
      shellStatus.className = "workspace-shell-status";
      shellStatus.innerHTML = `
        <span class="workspace-shell-label">Current workspace</span>
        <span class="workspace-shell-value">Program Core / Program Cover</span>
      `;

      const slideNum = topbarRight.querySelector(".slide-num");
      if (slideNum) {
        topbarRight.insertBefore(shellStatus, slideNum);
      } else {
        topbarRight.appendChild(shellStatus);
      }
    });
  }

  function buildMobileAppChrome() {
    if (document.querySelector(".mobile-app-header")) {
      return;
    }

    const drawerItems = workspaceSections
      .map(
        (section) => `
          <button class="mobile-drawer-item" type="button" data-slide="${section.slide}">
            <span class="mobile-drawer-item-num">${String(section.slide).padStart(2, "0")}</span>
            <span class="mobile-drawer-item-copy">
              <span class="mobile-drawer-item-short">${section.shortLabel}</span>
              <span class="mobile-drawer-item-title">${section.title}</span>
            </span>
          </button>
        `,
      )
      .join("");

    const header = document.createElement("div");
    header.className = "mobile-app-header";
    header.innerHTML = `
      <button class="mobile-app-portal-btn" type="button" aria-label="Return to Program Cover">&#9664;</button>
      <div class="mobile-app-meta">
        <span class="mobile-app-environment">${MOBILE_ENVIRONMENT_LABEL}</span>
        <span class="mobile-app-section">Program Cover</span>
      </div>
      <button class="mobile-app-menu-btn" type="button" aria-expanded="false" aria-controls="mobileModuleDrawer" aria-label="Open module menu">Menu</button>
    `;

    const drawer = document.createElement("div");
    drawer.className = "mobile-module-drawer";
    drawer.id = "mobileModuleDrawer";
    drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML = `
      <div class="mobile-module-drawer-backdrop"></div>
      <div class="mobile-module-drawer-sheet" role="dialog" aria-modal="true" aria-label="Module navigation">
        <div class="mobile-drawer-head">
          <div>
            <div class="mobile-drawer-kicker">${MOBILE_ENVIRONMENT_LABEL}</div>
            <div class="mobile-drawer-title">Modules</div>
          </div>
          <button class="mobile-drawer-close" type="button" aria-label="Close module menu">&times;</button>
        </div>
        <div class="mobile-drawer-list">${drawerItems}</div>
      </div>
    `;

    const bottomNav = document.createElement("div");
    bottomNav.className = "mobile-bottom-nav";
    bottomNav.innerHTML = `
      <button class="mobile-bottom-nav-btn" type="button" data-mobile-nav="home">Home</button>
      <button class="mobile-bottom-nav-btn" type="button" data-mobile-nav="gameplan">Principles</button>
      <button class="mobile-bottom-nav-btn" type="button" data-mobile-nav="squad">Final 23</button>
      <button class="mobile-bottom-nav-btn mobile-bottom-modules" type="button" data-mobile-nav="modules" aria-expanded="false">Modules</button>
    `;

    document.body.appendChild(header);
    document.body.appendChild(drawer);
    document.body.appendChild(bottomNav);

    header.querySelector(".mobile-app-portal-btn").addEventListener("click", () => {
      if (hasActiveOverlay()) {
        return;
      }

      goTo(1);
    });
    header.querySelector(".mobile-app-menu-btn").addEventListener("click", () => toggleMobileWorkspaceMenu());
    drawer.querySelector(".mobile-drawer-close").addEventListener("click", () => setMobileWorkspaceMenu(false));
    drawer.querySelector(".mobile-module-drawer-backdrop").addEventListener("click", () => setMobileWorkspaceMenu(false));
    drawer.querySelectorAll(".mobile-drawer-item").forEach((item) => {
      item.addEventListener("click", () => goTo(Number(item.dataset.slide)));
    });

    bottomNav.querySelector('[data-mobile-nav="home"]').addEventListener("click", () => goTo(1));
    bottomNav.querySelector('[data-mobile-nav="gameplan"]').addEventListener("click", () => goTo(2));
    bottomNav.querySelector('[data-mobile-nav="squad"]').addEventListener("click", () => goTo(6));
    bottomNav.querySelector('[data-mobile-nav="modules"]').addEventListener("click", () => toggleMobileWorkspaceMenu());
  }

  function syncMobileWorkspaceOffset() {
    if (!isMobileViewport()) {
      document.body.classList.remove("mobile-workspace-menu-open");
      document.documentElement.style.removeProperty("--mobile-workspace-offset");
      return;
    }

    const appHeader = document.querySelector(".mobile-app-header");
    const offset = appHeader?.offsetHeight || 56;
    document.documentElement.style.setProperty("--mobile-workspace-offset", `${offset}px`);
  }

  function setMobileWorkspaceMenu(open) {
    mobileWorkspaceMenuOpen = Boolean(open) && isMobileViewport();
    document.body.classList.toggle("mobile-workspace-menu-open", mobileWorkspaceMenuOpen);
    const drawer = document.getElementById("mobileModuleDrawer");
    if (drawer) {
      drawer.setAttribute("aria-hidden", mobileWorkspaceMenuOpen ? "false" : "true");
    }

    document.querySelectorAll(".mobile-app-menu-btn, .mobile-bottom-modules").forEach((toggle) => {
      toggle.setAttribute("aria-expanded", mobileWorkspaceMenuOpen ? "true" : "false");
      toggle.setAttribute("aria-label", mobileWorkspaceMenuOpen ? "Close section menu" : "Open section menu");
      if (toggle.classList.contains("mobile-app-menu-btn")) {
        toggle.textContent = mobileWorkspaceMenuOpen ? "Close" : "Menu";
      }
      if (toggle.classList.contains("mobile-bottom-modules")) {
        toggle.textContent = mobileWorkspaceMenuOpen ? "Close" : "Modules";
      }
    });
  }

  function toggleMobileWorkspaceMenu(force) {
    const nextState = typeof force === "boolean" ? force : !mobileWorkspaceMenuOpen;
    setMobileWorkspaceMenu(nextState);
  }

  function getMobileScrollTarget(slide) {
    return (
      slide.querySelector(".attack-main") ||
      slide.querySelector(".module-main") ||
      slide.querySelector(".chat-area") ||
      slide.querySelector(".lineout-left") ||
      slide.querySelector(".def-left") ||
      slide.querySelector(".sl-header") ||
      slide
    );
  }

  function scrollActiveSlideIntoView(behavior = "smooth") {
    if (!isMobileViewport()) {
      return;
    }

    const slide = document.getElementById(`s${cur}`);
    const target = getMobileScrollTarget(slide);
    const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--mobile-workspace-offset")) || 0;
    const top = target.getBoundingClientRect().top + window.scrollY - offset - 8;
    window.scrollTo({ top: Math.max(0, top), behavior });
  }

  function updateWorkspaceMap() {
    const currentSection = workspaceSections.find((section) => section.slide === cur);

    document.querySelectorAll(".workspace-map-item").forEach((item) => {
      const isActive = Number(item.dataset.slide) === cur;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-current", isActive ? "page" : "false");
    });

    document.querySelectorAll(".workspace-track").forEach((track) => {
      track.classList.toggle("active", track.dataset.group === currentSection?.group);
    });

    document.querySelectorAll(".workspace-shell-status").forEach((status) => {
      const value = status.querySelector(".workspace-shell-value");
      if (value && currentSection) {
        value.textContent = `${currentSection.group} / ${currentSection.title}`;
      }
    });

    document.querySelectorAll(".mobile-app-meta").forEach((meta) => {
      const environment = meta.querySelector(".mobile-app-environment");
      const section = meta.querySelector(".mobile-app-section");
      if (environment) {
        environment.textContent = MOBILE_ENVIRONMENT_LABEL;
      }
      if (section && currentSection) {
        section.textContent = currentSection.title;
      }
    });

    document.querySelectorAll(".mobile-drawer-item").forEach((item) => {
      const isActive = Number(item.dataset.slide) === cur;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-current", isActive ? "page" : "false");
    });

    document.querySelectorAll(".mobile-bottom-nav-btn").forEach((item) => {
      const navType = item.dataset.mobileNav;
      const isActive =
        (navType === "home" && cur === 1) ||
        (navType === "gameplan" && cur === 2) ||
        (navType === "squad" && cur === 6) ||
        (navType === "modules" && cur >= 3 && cur <= total && cur !== 6);
      item.classList.toggle("active", isActive);
    });

    syncMobileWorkspaceOffset();
  }

  function syncSlideNumbers() {
    document.querySelectorAll(".slide").forEach((slide, index) => {
      const slideNum = slide.querySelector(".slide-num");
      if (slideNum) {
        slideNum.textContent = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
      }
    });
  }

  function updateNav() {
    document.getElementById("prevBtn").disabled = cur === 1;
    document.getElementById("nextBtn").disabled = cur === total;
    document.getElementById("pFill").style.width = `${(cur / total) * 100}%`;

    const progress = document.querySelector(".progress");
    if (progress) {
      progress.setAttribute("aria-valuenow", cur);
      progress.setAttribute("aria-valuemax", total);
    }

    document.querySelectorAll(".dot").forEach((dot, index) => {
      dot.className = `dot${index + 1 === cur ? " active" : ""}`;
      dot.setAttribute("aria-selected", index + 1 === cur ? "true" : "false");
    });

    const slideNum = document.getElementById("slideNum");
    if (slideNum) {
      slideNum.textContent = `${String(cur).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    }

    updateWorkspaceMap();
  }

  function changeSlide(dir) {
    if (document.body.classList.contains("overlay-active")) {
      return;
    }

    const next = cur + dir;
    if (next >= 1 && next <= total) {
      goTo(next);
    }
  }

  function goTo(n) {
    if (document.body.classList.contains("overlay-active")) {
      return;
    }

    setMobileWorkspaceMenu(false);
    document.getElementById(`s${cur}`).classList.remove("active");
    cur = n;
    document.getElementById(`s${cur}`).classList.add("active");
    updateNav();

    if (isMobileViewport()) {
      requestAnimationFrame(() => {
        syncMobileWorkspaceOffset();
        requestAnimationFrame(() => scrollActiveSlideIntoView());
      });
    }
  }

  function togglePlay(el) {
    const wasActive = el.classList.contains("active");
    document.querySelectorAll(".play-list-item").forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-expanded", "false");
    });

    if (!wasActive) {
      el.classList.add("active");
      el.setAttribute("aria-expanded", "true");
    }
  }

  function toggleLo(el) {
    const wasActive = el.classList.contains("active");
    document.querySelectorAll(".lo-call").forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-expanded", "false");
    });

    if (!wasActive) {
      el.classList.add("active");
      el.setAttribute("aria-expanded", "true");
    }
  }

  function setCategory(cat, btn) {
    document.querySelectorAll("#s3 .zone-btn").forEach((zoneBtn) => {
      zoneBtn.classList.remove("active");
      zoneBtn.setAttribute("aria-selected", "false");
    });

    if (btn) {
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
    }

    const container = document.getElementById("attackContent");
    const items = (data.attackData || {})[cat] || [];

    container.innerHTML = items.map((play, index) => `
      <article class="play-list-item attack-play-card" onclick="togglePlay(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();togglePlay(this);}" tabindex="0" role="button" aria-expanded="false" data-i="${index}">
        <div class="attack-play-top">
          <div>
            <div class="play-name">${play.name}</div>
            <div class="play-type">${play.type}</div>
          </div>
        </div>
        <div class="play-detail${play.diagram ? ' play-detail-with-diagram' : ''}">
          ${play.diagram ? `
            <div class="play-detail-grid">
              <section class="attack-info-block attack-info-list">
                <div class="attack-info-label">Coaching Points</div>
                <ul>${(play.detail || []).map((point) => `<li>${point}</li>`).join("")}</ul>
              </section>
              <div class="play-diagram-card" data-diagram="${play.diagram}" data-name="${play.name}">
                <img src="${play.diagram}" alt="${play.name} diagram" class="play-diagram-image" style="cursor: pointer;">
              </div>
            </div>
          ` : `
            <section class="attack-info-block attack-info-list">
              <div class="attack-info-label">Coaching Points</div>
              <ul>${(play.detail || []).map((point) => `<li>${point}</li>`).join("")}</ul>
            </section>
          `}
        </div>
      </article>
    `).join("");

    document.querySelectorAll(".play-diagram-image").forEach((img) => {
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        const card = img.closest(".play-diagram-card");
        const src = card?.dataset.diagram;
        const name = card?.dataset.name;
        if (src) openDiagramLightbox(src, name ? `${name} diagram` : "Play diagram");
      });
    });
  }

  function setDefSide(side, btn) {
    document.querySelectorAll("#s4 .zone-tab").forEach((tab) => {
      tab.classList.remove("active");
      tab.setAttribute("aria-selected", "false");
    });

    if (btn) {
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
    }

    const sideData = (data.defData || {})[side];
    if (!sideData) {
      return;
    }

    document.getElementById("defContent").innerHTML = `
      <div class="def-block"><h4 class="${sideData.green.color}"><span class="sr-only">Low Risk: </span>${sideData.green.title}</h4><ul>${sideData.green.points.map((point) => `<li>${point}</li>`).join("")}</ul></div>
      <div class="def-block"><h4 class="${sideData.orange.color}"><span class="sr-only">Medium Risk: </span>${sideData.orange.title}</h4><ul>${sideData.orange.points.map((point) => `<li>${point}</li>`).join("")}</ul></div>
      <div class="def-block"><h4 class="${sideData.red.color}"><span class="sr-only">High Risk: </span>${sideData.red.title}</h4><ul>${sideData.red.points.map((point) => `<li>${point}</li>`).join("")}</ul></div>
    `;
  }

  function setSetPieceTab(tab, btn) {
    document.querySelectorAll("#s5 .zone-btn").forEach((zoneBtn) => {
      zoneBtn.classList.remove("active");
      zoneBtn.setAttribute("aria-selected", "false");
    });

    if (btn) {
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
    }

    const container = document.getElementById("setPieceContent");

    if (tab === "overview") {
      container.innerHTML = `
        <div class="sp-tab-overview">
          <p class="sp-tab-overview-copy">Set piece is one contest area. Austria should leave every set piece with launch quality, territorial gain, or direct scoreboard pressure.</p>
          <div class="sp-tab-overview-grid">
            <div class="sp-tab-overview-block">
              <div class="sp-tab-overview-kicker">Lineout</div>
              <p>Two structured systems — Tempo (campaign primary) and Spark (reference). Every caller must know the full call sheet and signal library.</p>
            </div>
            <div class="sp-tab-overview-block">
              <div class="sp-tab-overview-kicker">Scrum</div>
              <p>Dominant platform standard. Austria owns 100% of own-scrum ball. Technique and connection are non-negotiable before platform structure is added.</p>
            </div>
            <div class="sp-tab-overview-block">
              <div class="sp-tab-overview-kicker">Maul</div>
              <p>Maul sequences are embedded inside the lineout systems. Full detail lives inside Tempo and Spark.</p>
            </div>
          </div>
        </div>
      `;
      return;
    }

    if (tab === "lineout") {
      container.innerHTML = `
        <div class="lo-systems-grid">
          <div class="lo-system-card lo-system-primary">
            <div class="lo-system-header">
              <div class="lo-system-badges">
                <span class="lo-system-badge lo-system-badge-primary">Campaign System</span>
                <span class="lo-system-badge lo-system-badge-active">Primary · This Game</span>
              </div>
              <div class="lo-system-name">TEMPO</div>
              <div class="lo-system-subtitle">Full-system lineout with structured call architecture</div>
            </div>
            <div class="lo-system-desc">
              <p>Complete lineout language covering front, middle, and back of the line. Includes maul sequences, signal protocols, and the campaign call sheet.</p>
            </div>
            <div class="lo-system-meta">
              <span class="lo-system-meta-chip">Throw Zones</span>
              <span class="lo-system-meta-chip">Maul Sequences</span>
              <span class="lo-system-meta-chip">Signal Library</span>
            </div>
            <button class="lo-system-btn lo-system-btn-primary" onclick="openLineoutSystem('tempo')">Open System &#9654;</button>
          </div>
          <div class="lo-system-card lo-system-secondary">
            <div class="lo-system-header">
              <div class="lo-system-badges">
                <span class="lo-system-badge lo-system-badge-secondary">Reference System</span>
              </div>
              <div class="lo-system-name">SPARK</div>
              <div class="lo-system-subtitle">Secondary lineout framework for opponent variation</div>
            </div>
            <div class="lo-system-desc">
              <p>Alternative lineout system used as a reference for different opponent reads and environments. Complements the Tempo call sheet.</p>
            </div>
            <div class="lo-system-meta">
              <span class="lo-system-meta-chip">Call Variants</span>
              <span class="lo-system-meta-chip">Throw Patterns</span>
            </div>
            <button class="lo-system-btn lo-system-btn-secondary" onclick="openLineoutSystem('spark')">Open System &#9654;</button>
          </div>
        </div>
      `;
      return;
    }

    if (tab === "maul") {
      container.innerHTML = `
        <div class="sp-maul-overview">
          <div class="sp-maul-title">Maul Framework</div>
          <p class="sp-maul-copy">Maul sequences and tactical detail are embedded directly inside the Tempo and Spark lineout systems. Open either system from the Lineout tab to access the full maul call sheet, entry sequences, and drive protocols.</p>
          <div class="sp-maul-pointer">
            <button class="sp-maul-link" onclick="setSetPieceTab('lineout', document.getElementById('s5LineoutBtn'))">Go to Lineout Systems &#8594;</button>
          </div>
        </div>
      `;
      return;
    }

    const tabData = data.setPiece?.tabs?.[tab];
    if (!tabData) {
      return;
    }

    container.innerHTML = tabData.groups.map((group) => `
      <section class="nt-setpiece-group">
        <div class="nt-setpiece-head">
          <div class="attack-learning-kicker">${group.title}</div>
          <div class="attack-learning-count">${group.items.length} items</div>
        </div>
        <div class="nt-setpiece-stack">
          ${group.items.map((item) => `
            <div class="lo-call" onclick="toggleLo(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleLo(this);}" tabindex="0" role="button" aria-expanded="false">
              <div class="lc-name">${item.name}</div>
              <div class="lc-sub">${item.sub}</div>
              <div class="lc-detail">${item.detail}</div>
            </div>
          `).join("")}
        </div>
      </section>
    `).join("");
  }

  const LINEOUT_SYSTEM_PATHS = {
    tempo: "../../assets/donau/images/TEMPO_Lineout_System_Austria_Youth.html",
    spark: "../../assets/donau/images/Spark-lineout_manual.html",
  };

  const LINEOUT_SYSTEM_TITLES = {
    tempo: "TEMPO — Lineout System",
    spark: "SPARK — Lineout System",
  };

  function lineoutSystemEsc(event) {
    if (event.key === "Escape") closeLineoutSystem();
  }

  function openLineoutSystem(system) {
    const overlay = document.getElementById("lineoutSystemOverlay");
    const frame = document.getElementById("lineoutSystemFrame");
    const titleEl = document.getElementById("lsoTitle");
    if (!overlay || !frame) return;
    frame.src = LINEOUT_SYSTEM_PATHS[system] || "";
    if (titleEl) titleEl.textContent = LINEOUT_SYSTEM_TITLES[system] || "Lineout System";
    overlay.classList.add("open");
    overlay.removeAttribute("aria-hidden");
    lockBodyScroll();
    document.addEventListener("keydown", lineoutSystemEsc);
    overlay.querySelector(".lso-close")?.focus();
  }

  function closeLineoutSystem() {
    const overlay = document.getElementById("lineoutSystemOverlay");
    const frame = document.getElementById("lineoutSystemFrame");
    if (!overlay) return;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    if (!hasActiveOverlay()) {
      unlockBodyScroll();
    }
    if (frame) setTimeout(() => { frame.src = ""; }, 220);
    document.removeEventListener("keydown", lineoutSystemEsc);
  }

  function renderAttackSidebar() {
    const sidebar = data.attackSidebar || {};

    const fieldAreasEl = document.getElementById("attackFieldAreas");
    if (fieldAreasEl) {
      fieldAreasEl.innerHTML = (sidebar.fieldAreas || []).map((area) => `
        <div class="field-area" onclick="toggleFieldArea(this)" role="button" tabindex="0" aria-expanded="false" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleFieldArea(this);}">
          <div class="fa-header">
            <div class="fa-name">${area.name}</div>
            <div class="fa-short">${area.short}</div>
            <div class="fa-arrow">&#9660;</div>
          </div>
          <div class="fa-body">
            <ul>${area.points.map((point) => `<li>${point}</li>`).join("")}</ul>
          </div>
        </div>
      `).join("");
    }

    document.getElementById("attackDirectionCalls").innerHTML = (sidebar.directionCalls || []).map((call) => `
      <div class="term-chip"><div class="term-key">${call.key}</div><div class="term-val">${call.value}</div></div>
    `).join("");

    const podsEl = document.getElementById("attackPods");
    if (podsEl) podsEl.innerHTML = (sidebar.pods || []).map((pod) => `
      <div class="term-chip" style="margin-bottom:6px;"><div class="term-key">${pod.key}</div><div class="term-val">${pod.value}</div></div>
    `).join("");
  }

  function renderDefenceMeta() {
    document.getElementById("defRoles").innerHTML = (data.defenceRoles || []).map((role) => `
      <div class="role-card"><div class="rc-role">${role.name}</div><div class="rc-desc">${role.desc}</div></div>
    `).join("");

    document.getElementById("defCalls").innerHTML = (data.defenceCalls || []).map((call) => `
      <div class="term-chip"><div class="term-key">${call.name}</div><div class="term-val">${call.action}</div></div>
    `).join("");
  }

  function renderSetPieceMeta() {
    document.getElementById("setPieceMetrics").innerHTML = (data.setPiece?.metrics || []).map((metric) => `
      <div class="s-metric"><div class="sv">${metric.value}</div><div class="sl">${metric.label}</div></div>
    `).join("");

    document.getElementById("setPieceCodes").innerHTML = (data.setPiece?.codes || []).map((code) => `
      <div class="code-row"><span class="code-key">${code.key}</span><span class="code-desc">${code.desc}</span></div>
    `).join("");

    document.getElementById("setPieceNotes").innerHTML = (data.setPiece?.notes || []).map((note) => `
      <div class="tech-item">
        <div class="tech-icon">${note.title.slice(0, 1)}</div>
        <div class="tech-text"><strong>${note.title}</strong> ${note.text}</div>
      </div>
    `).join("");
  }

  function renderUnits() {
    document.getElementById("unitsGrid").innerHTML = (data.units || []).map((unit) => `
      <article class="module-accordion nt-unit-card" aria-expanded="false">
        <button class="module-accordion-head" type="button" onclick="toggleUnitCard(this.closest('.nt-unit-card'))" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleUnitCard(this.closest('.nt-unit-card'));}">
          <div>
            <h3>${unit.title}</h3>
            <div class="module-accordion-sub">${unit.subtitle}</div>
          </div>
          <div class="module-accordion-arrow">&#9660;</div>
        </button>
        <div class="module-accordion-body">
          ${renderUnitLane("Attack", unit.attack)}
          ${renderUnitLane("Defence", unit.defence)}
          ${renderUnitLane("Set Piece", unit.setPiece)}
        </div>
      </article>
    `).join("");
  }

  function renderUnitLane(label, points) {
    return `
      <section class="nt-unit-lane">
        <div class="nt-unit-lane-label">${label}</div>
        <ul class="module-list">${(points || []).map((point) => `<li>${point}</li>`).join("")}</ul>
      </section>
    `;
  }

  function toggleUnitCard(el) {
    const wasActive = el.classList.contains("active");
    document.querySelectorAll(".nt-unit-card").forEach((item) => {
      item.classList.remove("active");
      item.setAttribute("aria-expanded", "false");
      const body = item.querySelector(".module-accordion-body");
      if (body) {
        body.style.maxHeight = "";
      }
    });

    if (!wasActive) {
      el.classList.add("active");
      el.setAttribute("aria-expanded", "true");
      const body = el.querySelector(".module-accordion-body");
      if (body) {
        body.style.maxHeight = `${body.scrollHeight}px`;
      }
    }
  }

  function renderAnalysisHub() {
    document.getElementById("analysisHub").innerHTML = (data.analysis?.cards || []).map((card) => `
      <article class="module-card module-card-${card.accent}">
        <div class="module-card-top">
          <div class="module-icon module-icon-${card.accent}" aria-hidden="true">${card.icon}</div>
          <div class="module-progress">
            <div class="module-progress-label">${card.progressLabel}</div>
            <div class="module-status-pill module-status-${slug(card.status)}">${card.status}</div>
          </div>
        </div>
        <div>
          <h3 class="module-card-title">${card.title}</h3>
          <p class="module-card-desc">${card.shortDescription}</p>
        </div>
        <div class="module-card-meta">
          <div class="module-progress-value">${card.progressValue}</div>
        </div>
        <div class="module-progress-bar">
          <div class="module-progress-track">
            <div class="module-progress-fill module-progress-fill-${card.accent}" style="width:${card.progressPercent}%"></div>
          </div>
        </div>
        <div class="nt-analysis-points">${card.points.map((point) => `<span class="module-pill">${point}</span>`).join("")}</div>
      </article>
    `).join("");

    document.getElementById("analysisStatus").innerHTML = (data.analysis?.statusRows || []).map((row) => `
      <div class="module-status-row">
        <span class="module-status-row-title">${row.title}</span>
        <span class="module-status-row-meta">
          <span class="module-status-pill">${row.meta}</span>
          <span class="module-status-row-progress">${row.value}</span>
        </span>
      </div>
    `).join("");

    document.getElementById("analysisPillars").innerHTML = (data.analysis?.pillars || []).map((pillar) => `
      <div class="module-sidebar-item">
        <strong>${pillar.title}</strong>
        <span>${pillar.text}</span>
      </div>
    `).join("");
  }

  function slug(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function sendMsg() {
    const input = document.getElementById("chatInp");
    const q = input.value.trim();
    if (!q || !addMsg) {
      return;
    }

    input.value = "";
    document.getElementById("sendBtn").disabled = true;
    addMsg("user", q);
    showTyping();

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `${data.playbookContext || ""}\n\nAnswer concisely in plain text. Use short bullet points where helpful. Do not use markdown headers.`,
          messages: [{ role: "user", content: q }]
        })
      });

      const responseData = await res.json();
      removeTyping();
      const text = responseData.content?.map((block) => block.text || "").join("") || "Sorry, I couldn't process that.";
      addMsg("ai", text);
    } catch (error) {
      removeTyping();
      addMsg("ai", "Connection error. The assistant shell is ready, but live responses need an available API connection.");
    }

    document.getElementById("sendBtn").disabled = false;
  }

  function askQ(el) {
    document.getElementById("chatInp").value = el.textContent;
    sendMsg();
  }

  function applyBrandIdentity() {
    document.title = "Austria Youth Rugby | Coach Mato";

    document.querySelectorAll(".topbar-title").forEach((el) => {
      el.textContent = "Austria Youth Rugby";
    });

    const subtitles = [
      "Youth Pathway",
      "Youth Pathway · Game Model",
      "Youth Pathway · Attack System",
      "Youth Pathway · Defensive System",
      "Youth Pathway · Set Piece",
      "Youth Pathway · Roles & Units",
      "Youth Pathway · Analysis Hub",
      "Youth Pathway · AI Playbook Assistant",
    ];

    document.querySelectorAll(".topbar-sub").forEach((el, index) => {
      el.textContent = subtitles[index] || "Youth Pathway";
    });

    const hero = document.querySelector("#s1 .nt-cover-main");
    if (hero) {
      hero.innerHTML = `
        <div class="nt-cover-main-inner">
          <h1 class="hero fadeup">AUSTRIA<br><span>YOUTH</span></h1>
          <p class="nt-cover-copy fadeup">Built for role clarity, shared language, and pathway readiness.</p>
          <div class="nt-cover-actions fadeup">
            <button class="coach-intro-btn" onclick="openOverlay('ovCoach')" aria-haspopup="dialog">
              Program Introduction <span style="font-size:.65rem;opacity:.6;">&#9654;</span>
            </button>
            <button class="coach-intro-btn coach-intro-btn-secondary" onclick="openOverlay('ovIdentity')" aria-haspopup="dialog">
              Program Identity <span style="font-size:.65rem;opacity:.6;">&#9654;</span>
            </button>
          </div>
        </div>
      `;
    }

    const programIdentityLabel = document.querySelector('#s2 .phil-zone[data-label="ID"] h3');
    if (programIdentityLabel) programIdentityLabel.textContent = "Program Identity";

    const pathwayContext = document.querySelector("#s8 .nt-tag");
    if (pathwayContext) pathwayContext.textContent = "Youth Pathway Context";

    const chatBubble = document.querySelector("#chatMsgs .msg.ai .msg-bubble");
    if (chatBubble) {
      chatBubble.textContent = "I'm loaded with the Austria Youth language. Ask about launch calls, unit roles, defensive signals, or pathway preparation standards.";
    }

    const chatLabel = document.querySelector('label[for="chatInp"]');
    if (chatLabel) chatLabel.textContent = "Ask a question about the Austria Youth playbook";

    const chatInput = document.getElementById("chatInp");
    if (chatInput) chatInput.setAttribute("aria-label", "Ask a question about the Austria Youth playbook");
  }

  function init() {
    applyBrandIdentity();

    document.querySelectorAll(".overlay").forEach((overlay) => {
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          closeOverlay(overlay.id);
        }
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && mobileWorkspaceMenuOpen) {
        setMobileWorkspaceMenu(false);
        return;
      }

      if (mobileWorkspaceMenuOpen) {
        return;
      }

      if (event.key === "ArrowRight") {
        changeSlide(1);
      } else if (event.key === "ArrowLeft") {
        changeSlide(-1);
      }
    });

    let sx = null;
    let sy = null;
    document.addEventListener("touchstart", (event) => {
      if (hasActiveOverlay()) {
        sx = null;
        sy = null;
        return;
      }

      sx = event.touches[0].clientX;
      sy = event.touches[0].clientY;
    });

    document.addEventListener("touchend", (event) => {
      if (hasActiveOverlay()) {
        sx = null;
        sy = null;
        return;
      }

      if (sx === null || sy === null) {
        return;
      }

      const diffX = sx - event.changedTouches[0].clientX;
      const diffY = sy - event.changedTouches[0].clientY;
      const isHorizontalSwipe = Math.abs(diffX) > 70 && Math.abs(diffX) > Math.abs(diffY) * 1.35;

      if (isHorizontalSwipe) {
        changeSlide(diffX > 0 ? 1 : -1);
      }

      sx = null;
      sy = null;
    });

    document.addEventListener("touchstart", handleOverlayTouchStart, { passive: true });
    document.addEventListener("touchmove", handleOverlayTouchMove, { passive: false });
    document.addEventListener("touchstart", handleModalScrollTouchStart, { passive: true });
    document.addEventListener("touchmove", handleModalScrollTouchMove, { passive: false });
    document.addEventListener("touchend", handleModalScrollTouchEnd, { passive: true });

    document.addEventListener("click", (event) => {
      if (!mobileWorkspaceMenuOpen || !isMobileViewport()) {
        return;
      }

      const appHeader = document.querySelector(".mobile-app-header");
      const drawer = document.querySelector(".mobile-module-drawer-sheet");
      const bottomNav = document.querySelector(".mobile-bottom-nav");
      if (
        appHeader?.contains(event.target) ||
        drawer?.contains(event.target) ||
        bottomNav?.contains(event.target)
      ) {
        return;
      }

      setMobileWorkspaceMenu(false);
    });

    window.addEventListener("resize", () => {
      if (!isMobileViewport()) {
        setMobileWorkspaceMenu(false);
      }
      syncMobileWorkspaceOffset();
    });

    buildDots();
    buildPortalReturnLinks();
    buildWorkspaceMap();
    buildWorkspaceShellStatus();
    buildMobileAppChrome();
    syncSlideNumbers();
    renderAttackSidebar();
    renderDefenceMeta();
    renderSetPieceMeta();
    renderUnits();
    renderAnalysisHub();
    setCategory("setpiece", document.querySelector("#s3 .zone-btn.active"));
    setDefSide("rhs", document.querySelector("#s4 .zone-tab.active"));
    setSetPieceTab("overview", document.querySelector("#s5 .zone-btn.active"));
    updateNav();
  }

  window.askQ = askQ;
  window.changeSlide = changeSlide;
  window.closeDiagramLightbox = closeDiagramLightbox;
  window.closeFieldLightbox = closeFieldLightbox;
  window.closeLineoutSystem = closeLineoutSystem;
  window.closeOverlay = closeOverlay;
  window.goTo = goTo;
  window.openDiagramLightbox = openDiagramLightbox;
  window.openFieldLightbox = openFieldLightbox;
  window.openLineoutSystem = openLineoutSystem;
  window.openOverlay = openOverlay;
  window.sendMsg = sendMsg;
  window.setCategory = setCategory;
  window.setDefSide = setDefSide;
  window.setSetPieceTab = setSetPieceTab;
  window.toggleFieldArea = toggleFieldArea;
  window.toggleFieldMap = toggleFieldMap;
  window.toggleForwardPodsMap = toggleForwardPodsMap;
  window.toggleLo = toggleLo;
  window.togglePlay = togglePlay;
  window.toggleUnitCard = toggleUnitCard;

  init();
})();
