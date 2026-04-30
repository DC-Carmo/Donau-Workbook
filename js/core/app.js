(function () {
  const data = window.DONAU_DATA || {};
  const attackData = data.attackData || {};
  const lo80 = data.lo80 || [];
  const lo50 = data.lo50 || [];
  const defData = data.defData || {};
  const workspaceSections = data.workspaceSections || [];
  const developmentModules = data.developmentModules || [];
  const playbookContext = data.playbookContext || "";
  const { addMsg, removeTyping, showTyping } = window.DonauShared || {};
  const attackGuides = {
    "O²": {
      purpose: "Attack the opposition 10/12 connection from a stable scrum platform.",
      trigger: "Use when scrum ball is clean and the inside defence needs to be fixed before releasing the edge.",
      shape: "9 and 12 fix inside defenders, 10 works out the back, and width stays alive outside.",
      commonErrors: ["10 drifts too early and never fixes the next defender.", "Edge runners arrive flat and the seam disappears before the ball lands."],
    },
    "C.C +": {
      purpose: "Turn the scrum shape into an attacking kicking picture.",
      trigger: "Use when the backfield read favours a kick option instead of a full strike launch.",
      shape: "8 connects to 9, 9 to 10 behind 12, with chase spacing already prepared outside.",
      commonErrors: ["The transfer to 10 is slow and the kick window closes.", "The chase line launches disconnected from the kick picture."],
    },
    "Launch 41": {
      purpose: "Launch quickly to the edge and challenge the outer defensive connection.",
      trigger: "Use from clean scrum ball when the edge can be attacked before the defence resets.",
      shape: "9 connects early, 12 holds the short line, and 10 stays as the second layer behind.",
      commonErrors: ["14 receives without pace and the edge threat disappears.", "12 drifts out and gives the inside picture away too early."],
    },
    "Rhino & Lion": {
      purpose: "Create a left or right midfield scrum launch from the same base picture.",
      trigger: "Use from midfield scrum when the team wants a clear directional launch call.",
      shape: "Rhino runs right, Lion runs left, with an inside fixer and a second layer behind it.",
      commonErrors: ["Players confuse the left/right version and the launch loses shape immediately.", "The second layer sits too deep and the play becomes lateral."],
    },
    Special: {
      purpose: "Create a flat 9-to-10 picture from lineout and bring the second layer onto the ball off 9.",
      trigger: "Use Special when we want 10 flat to the line and 9 to control the distribution.",
      shape: "&bull; 9 plays flat to 10.<br>&bull; 12 run hard to the line with 10.<br>&bull; 10 out the back to 9.<br>&bull; 13 hard, tip option or<br>&bull; 15/14 front and backdoor off 9.",
      coachingPoints: [
        "12 must fix their 12.",
        "This gives 9 time to scan and pick the right option.",
        "10 must stay flat and sell the first picture.",
        "Back three must come with speed and depth onto 9.",
      ],
      commonErrors: [
        "10 drifts too early.",
        "12 does not hold their defender.",
        "9 receives the return pass with no scan.",
        "Back three arrive too flat or too late.",
      ],
    },
    Strike: {
      purpose: "Give Donau a front-foot phase direction off fast ball.",
      trigger: "Use when ruck speed is positive and the team can attack before the defence is set.",
      shape: "9 passes across the face to a flatter first receiver with depth arriving outside.",
      commonErrors: ["The first receiver sits too deep and kills the front-foot picture.", "Forward runners disconnect and defenders ignore the inside threat."],
    },
    Roll: {
      purpose: "Play behind a live pod and move the defence laterally without losing inside pressure.",
      trigger: "Use when the pod can still threaten the line and space can open behind it.",
      shape: "The pod runs hard as a real option while the ball works behind to the receiver.",
      commonErrors: ["The pod jogs and the defence slides easily.", "The pass behind goes too early and exposes the shape."],
    },
    "Kick Start": {
      purpose: "Re-accelerate the game with slow-ball movement in the Gold Zone.",
      trigger: "Use when ball speed is slow near the posts and the defence is loading one picture.",
      shape: "Play back toward the posts with connected slow-ball actions that create a two-sided threat.",
      commonErrors: ["The sequence is rushed and the defence never has to commit the third defender.", "Support arrives too upright and the carry loses momentum."],
    },
    Spark: {
      purpose: "Keep shape with a simple slow-ball solution that wins the next collision cleanly.",
      trigger: "Use when the ball is slow in the Gold Zone and the team needs a repeatable reset.",
      shape: "Move hammer or sickle close to 9 and connect early into a latch-driven carry.",
      commonErrors: ["Support arrives too late and the latch never becomes part of the carry.", "The shape sits too wide from 9 and the defence reads it early."],
    },
    Driver: {
      purpose: "Clear the zone with maximum distance and reset the field picture.",
      trigger: "Use when territory is the priority and the ball must leave danger quickly.",
      shape: "Build a calm kicking pocket with a connected chase line ready beyond the strike.",
      commonErrors: ["The pocket collapses and the kick is rushed.", "The chase line fragments and the territory gain is wasted."],
      fieldPosition: "Own Half",
    },
    Bingo: {
      purpose: "Use a contestable clearance to compete for the ball back.",
      trigger: "Use when the chase can arrive connected and the backfield picture invites contest.",
      shape: "Kick from a stable pocket with the chase line aligned to the drop zone.",
      commonErrors: ["The kick travels too long and removes the contest.", "The chase launches disconnected and nobody wins the drop."],
      fieldPosition: "Own Half",
    },
    Banana: {
      purpose: "Exit through a box-kick picture built from the lineout feed.",
      trigger: "Use when the lineout gives 9 a controllable kicking lane.",
      shape: "Protect 9 tightly and create a narrow, clean lane for the box kick.",
      commonErrors: ["Protection arrives late and the kick is pressured.", "The chase line starts flat and overruns the contest."],
      fieldPosition: "Own 22",
    },
    Zero: {
      purpose: "Provide a bail-out exit when the preferred clearance shape is under pressure.",
      trigger: "Use when the ideal exit picture is not available and risk must be reduced.",
      shape: "Keep the picture simple so the ball can leave the zone without overplaying.",
      commonErrors: ["Players add extra action instead of taking the release option.", "Communication is late and the pressure wins the moment."],
      fieldPosition: "Own 22",
    },
    "Ramp 1 — Left": {
      purpose: "Build a left-sided lineout exit that arrives at a composed phase-three kick picture.",
      trigger: "Use from left-sided lineout exits when a sequenced clearance is preferred.",
      shape: "Phase one and two must be clean enough that 15 receives a stable phase-three option.",
      commonErrors: ["The first breakdown is messy and phase three never arrives on schedule.", "Backfield connectors drift out of the pocket before the kick is live."],
      fieldPosition: "Own 22",
    },
    "Ramp 2 — Right": {
      purpose: "Build the mirrored right-sided lineout exit into the phase-three kick picture.",
      trigger: "Use from right-sided lineout exits when the same three-phase exit shape is wanted.",
      shape: "Early phases protect the carry picture and return the ball to 10 with time to kick or shift.",
      commonErrors: ["Support gets stretched in phase two and the exit loses its platform.", "10 receives late pressure because the shape drifted too far right."],
      fieldPosition: "Own 22",
    },
  };

  let cur = 1;
  const total = document.querySelectorAll(".slide").length;
  const MOBILE_BREAKPOINT = 768;
  const MOBILE_ENVIRONMENT_LABEL = "Donau";
  let mobileWorkspaceMenuOpen = false;

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

  function toggleForwardPodsMap() {
    const btn = document.getElementById("forwardPodsBtn");
    const panel = document.getElementById("forwardPodsMapPanel");
    const isOpen = panel.classList.contains("open");
    panel.classList.toggle("open", !isOpen);
    btn.classList.toggle("open", !isOpen);
    btn.setAttribute("aria-expanded", String(!isOpen));
  }

  function toggleFieldMap() {
    const btn = document.getElementById("fieldAreasBtn");
    const panel = document.getElementById("fieldMapPanel");
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

  function openOverlay(id) {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }

    el.classList.add("open");
    document.body.classList.add("overlay-active");
    el.querySelector(".overlay-close").focus();
    document.addEventListener("keydown", overlayKeyHandler);
  }

  function closeOverlay(id) {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }

    el.classList.remove("open");
    if (!document.querySelector(".overlay.open")) {
      document.body.classList.remove("overlay-active");
    }

    document.removeEventListener("keydown", overlayKeyHandler);
  }

  function overlayKeyHandler(event) {
    if (event.key === "Escape") {
      document.querySelectorAll(".overlay.open").forEach((overlay) => overlay.classList.remove("open"));
      document.body.classList.remove("overlay-active");
      document.removeEventListener("keydown", overlayKeyHandler);
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

  function buildWorkspaceMap() {
    const slides = document.querySelectorAll(".slide");
    const groups = [...new Set(workspaceSections.map((section) => section.group))];

    slides.forEach((slide) => {
      if (slide.querySelector(".workspace-map")) {
        return;
      }

      const nav = document.createElement("div");
      nav.className = "workspace-map";
      nav.innerHTML = `
        <div class="workspace-map-inner">
          ${groups
            .map((group) => {
              const items = workspaceSections.filter((section) => section.group === group);
              return `
                <div class="workspace-track" data-group="${group}">
                  <div class="workspace-track-head">
                    <div class="workspace-track-label">${group}</div>
                    <div class="workspace-track-meta">${items.length} sections</div>
                  </div>
                  <div class="workspace-track-items">
                    ${items
                      .map(
                        (section) => `
                          <button class="workspace-map-item" type="button" data-slide="${section.slide}" onclick="goTo(${section.slide})">
                            <span class="workspace-item-num">${String(section.slide).padStart(2, "0")}</span>
                            <span class="workspace-item-copy">
                              <span class="workspace-item-short">${section.shortLabel}</span>
                              <span class="workspace-item-title">${section.title}</span>
                            </span>
                          </button>
                        `,
                      )
                      .join("")}
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      `;

      slide.querySelector(".topbar").insertAdjacentElement("afterend", nav);
    });
  }

  function buildTopbarLogos() {
    const logoSrc = (window.DONAU_ASSET_BASE || "../../assets/donau/") + "branding/RugbyUnionDonauLogo2024.svg";
    document.querySelectorAll(".topbar-logo").forEach((topbarLogo) => {
      const wallaby = topbarLogo.querySelector(".wallaby-icon");
      if (!wallaby) {
        return;
      }

      const img = document.createElement("img");
      img.src = logoSrc;
      img.style.cssText = "height:30px;width:auto;object-fit:contain;";
      img.alt = "Rugby Union Donau";
      topbarLogo.replaceChild(img, wallaby);
    });
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
        <span class="workspace-shell-value">Performance / Intro</span>
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
      <a class="mobile-app-portal-btn" href="../../index.html" aria-label="Back to portal">&#9664;</a>
      <div class="mobile-app-meta">
        <span class="mobile-app-environment">${MOBILE_ENVIRONMENT_LABEL}</span>
        <span class="mobile-app-section">Intro</span>
      </div>
      <button class="mobile-app-menu-btn" type="button" aria-expanded="false" aria-controls="mobileModuleDrawer" aria-label="Open module menu">Menu</button>
    `;

    const drawer = document.createElement("div");
    drawer.className = "mobile-module-drawer";
    drawer.id = "mobileModuleDrawer";
    drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML = `
      <div class="mobile-module-drawer-backdrop" data-close-drawer="true"></div>
      <div class="mobile-module-drawer-sheet" role="dialog" aria-modal="true" aria-label="Module navigation">
        <div class="mobile-drawer-head">
          <div>
            <div class="mobile-drawer-kicker">Donau</div>
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
      <button class="mobile-bottom-nav-btn mobile-bottom-modules" type="button" data-mobile-nav="modules" aria-expanded="false">Modules</button>
      <a class="mobile-bottom-nav-btn" data-mobile-nav="board" href="../../environments/animator/index.html">Tactical Board</a>
      <button class="mobile-bottom-nav-btn" type="button" data-mobile-nav="playbook">Playbook</button>
    `;

    document.body.appendChild(header);
    document.body.appendChild(drawer);
    document.body.appendChild(bottomNav);

    header.querySelector(".mobile-app-menu-btn").addEventListener("click", () => toggleMobileWorkspaceMenu());
    drawer.querySelector(".mobile-drawer-close").addEventListener("click", () => setMobileWorkspaceMenu(false));
    drawer.querySelector(".mobile-module-drawer-backdrop").addEventListener("click", () => setMobileWorkspaceMenu(false));
    drawer.querySelectorAll(".mobile-drawer-item").forEach((item) => {
      item.addEventListener("click", () => goTo(Number(item.dataset.slide)));
    });

    bottomNav.querySelector('[data-mobile-nav="home"]').addEventListener("click", () => goTo(1));
    bottomNav.querySelector('[data-mobile-nav="modules"]').addEventListener("click", () => toggleMobileWorkspaceMenu());
    bottomNav.querySelector('[data-mobile-nav="playbook"]').addEventListener("click", () => goTo(6));
  }

  function buildMobileWorkspaceBar() {
    document.querySelectorAll(".slide").forEach((slide) => {
      if (slide.querySelector(".mobile-workspace-bar")) {
        return;
      }

      const bar = document.createElement("div");
      bar.className = "mobile-workspace-bar";
      bar.innerHTML = `
        <button class="mobile-workspace-toggle" type="button" aria-expanded="false" aria-label="Open section menu">
          <span class="mobile-workspace-toggle-label">Menu</span>
        </button>
        <div class="mobile-workspace-meta">
          <span class="mobile-workspace-environment">${MOBILE_ENVIRONMENT_LABEL}</span>
          <span class="mobile-workspace-section">Performance / Intro</span>
        </div>
      `;

      const toggle = bar.querySelector(".mobile-workspace-toggle");
      toggle.addEventListener("click", () => toggleMobileWorkspaceMenu());
      slide.querySelector(".topbar").insertAdjacentElement("afterend", bar);
    });
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

    document.querySelectorAll(".mobile-workspace-toggle, .mobile-app-menu-btn, .mobile-bottom-modules").forEach((toggle) => {
      toggle.setAttribute("aria-expanded", mobileWorkspaceMenuOpen ? "true" : "false");
      toggle.setAttribute("aria-label", mobileWorkspaceMenuOpen ? "Close section menu" : "Open section menu");
      const label = toggle.querySelector(".mobile-workspace-toggle-label");
      if (label) {
        label.textContent = mobileWorkspaceMenuOpen ? "Close" : "Menu";
      }
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

    document.querySelectorAll(".mobile-workspace-meta").forEach((meta) => {
      const environment = meta.querySelector(".mobile-workspace-environment");
      const section = meta.querySelector(".mobile-workspace-section");
      if (environment && currentSection) {
        environment.textContent = `${MOBILE_ENVIRONMENT_LABEL} / ${currentSection.group}`;
      }
      if (section && currentSection) {
        section.textContent = currentSection.title;
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
        (navType === "playbook" && cur === 6) ||
        (navType === "modules" && cur >= 2 && cur <= total);
      item.classList.toggle("active", isActive && navType !== "board");
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

  function renderAttackCategory(cat, btn) {
    document.querySelectorAll(".zone-btn").forEach((zoneBtn) => {
      zoneBtn.classList.remove("active");
      zoneBtn.setAttribute("aria-selected", "false");
    });

    if (btn) {
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
    }

    const container = document.getElementById("attackContent");
    const items = attackData[cat] || [];
    const groups = groupAttackItems(cat, items);

    container.innerHTML = groups
      .map(
        (group) => `
          <section class="attack-learning-group">
            <div class="attack-learning-head">
              <div class="attack-learning-kicker">${group.label}</div>
              <div class="attack-learning-count">${group.items.length} items</div>
            </div>
            <div class="attack-learning-stack">
              ${group.items
                .map((play, index) => {
                  const model = getAttackPlayModel(play, cat);
                  return `
                    <article class="play-list-item attack-play-card" onclick="togglePlay(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();togglePlay(this);}" tabindex="0" role="button" aria-expanded="false" data-i="${index}">
                      <div class="attack-play-top">
                        <div>
                          <div class="play-name">${play.name}</div>
                          <div class="play-type">${play.type}</div>
                        </div>
                        ${model.fieldPosition ? `<div class="attack-play-context">${model.fieldPosition}</div>` : ""}
                      </div>
                      <div class="play-detail">
                        <div class="attack-play-grid">
                          ${renderAttackInfoBlock("Purpose", model.purpose)}
                          ${renderAttackInfoBlock("Trigger", model.trigger)}
                          ${renderAttackInfoBlock("Shape", model.shape)}
                          <section class="attack-info-block attack-info-list">
                            <div class="attack-info-label">Coaching Points</div>
                            <ul>${model.coachingPoints.map((point) => `<li>${point}</li>`).join("")}</ul>
                          </section>
                          <section class="attack-info-block attack-info-list">
                            <div class="attack-info-label">Common Errors</div>
                            <ul>${model.commonErrors.map((point) => `<li>${point}</li>`).join("")}</ul>
                          </section>
                          <section class="attack-info-block attack-info-diagram">
                            <div class="attack-info-label">Diagram Block</div>
                            <div class="attack-diagram-shell">
                              <p>${play.diagram ? "Use the diagram to anchor the starting picture before coaching the movement." : "Diagram slot ready for future upload."}</p>
                              ${play.diagram ? `<button class="diagram-btn" onclick="event.stopPropagation();openFieldLightbox('${play.diagram}','${play.name}')" onkeydown="event.stopPropagation();">View Diagram</button>` : ""}
                            </div>
                          </section>
                          <section class="attack-info-block attack-info-animation">
                            <div class="attack-info-label">Future Interactive Animation</div>
                            <div class="attack-animation-shell">
                              <div class="attack-animation-note">Animator placeholder</div>
                              <p>Replay-ready slot for starting positions, ball path, and sequenced movement.</p>
                            </div>
                          </section>
                        </div>
                      </div>
                    </article>
                  `;
                })
                .join("")}
            </div>
          </section>
        `,
      )
      .join("");

    if (window.innerWidth <= 768) {
      requestAnimationFrame(() => {
        const el = document.getElementById('attackContent');
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY - 108;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      });
    }
  }

  function renderAttackInfoBlock(label, body) {
    return `
      <section class="attack-info-block">
        <div class="attack-info-label">${label}</div>
        <p>${body}</p>
      </section>
    `;
  }

  function groupAttackItems(cat, items) {
    if (cat === "phase") {
      return [
        { label: "System Directions", items: items.filter((play) => play.type === "Phase Direction") },
        { label: "Slow Ball / Gold Zone", items: items.filter((play) => play.type.indexOf("Slow Ball") > -1) },
        { label: "Point-of-Contact Calls", items: items.filter((play) => play.type === "Call") },
      ].filter((group) => group.items.length);
    }

    if (cat === "calls") {
      const order = ["Field Landmark", "Direction", "Scrum Delivery", "Scrum 42", "Override"];
      return order
        .map((type) => ({ label: type, items: items.filter((play) => play.type === type) }))
        .filter((group) => group.items.length);
    }

    if (cat === "exits") {
      return [
        { label: "Kick Types", items: items.filter((play) => play.type.indexOf("Kick Type") > -1) },
        { label: "Exit Options", items: items.filter((play) => play.type === "Exit Option") },
        { label: "Lineout Exit Shapes", items: items.filter((play) => play.type.indexOf("Lineout") > -1) },
      ].filter((group) => group.items.length);
    }

    return [{ label: "Core Plays", items }];
  }

  function getAttackPlayModel(play, cat) {
    const guide = attackGuides[play.name] || {};
    const detail = play.detail || [];
    const summary = detail[0] || "Keep the Donau picture clear and connected.";
    const coachingPoints = guide.coachingPoints || (detail.slice(0, 3).length ? detail.slice(0, 3) : [`Coach the ${play.name} timing and communication.`, `Keep the ${play.type.toLowerCase()} picture square and connected.`, "Make the supporting roles visible in training reps."]);

    return {
      purpose: guide.purpose || inferAttackPurpose(play, cat, summary),
      trigger: guide.trigger || inferAttackTrigger(play, cat),
      shape: guide.shape || inferAttackShape(play, cat, detail),
      coachingPoints,
      commonErrors: guide.commonErrors || inferAttackErrors(play, cat),
      fieldPosition: guide.fieldPosition || "",
    };
  }

  function inferAttackPurpose(play, cat, summary) {
    if (cat === "calls") {
      return `Use ${play.name} as the shared language for ${summary.toLowerCase()}.`;
    }
    if (cat === "exits") {
      return `Use ${play.name} to organise the exit picture and relieve pressure with clarity.`;
    }
    if (cat === "phase") {
      return `Use ${play.name} to shape the phase picture and improve the next decision.`;
    }
    return `Use ${play.name} to create a clear attacking picture from the set piece.`;
  }

  function inferAttackTrigger(play, cat) {
    if (cat === "calls") {
      return `Activate ${play.name} when the team needs that language cue clearly and early.`;
    }
    if (cat === "exits") {
      return `Call ${play.name} when the field position and pressure picture require a managed exit.`;
    }
    if (play.type === "Phase Direction") {
      return `Call ${play.name} when ball speed and defensive shape match the intended phase picture.`;
    }
    if (play.type === "Call") {
      return `Use ${play.name} when the point-of-contact picture creates the timing for it.`;
    }
    return `Use ${play.name} when the platform is stable enough to launch with intent.`;
  }

  function inferAttackShape(play, cat, detail) {
    if (cat === "calls") {
      return "Use the term inside the existing Donau attack shape so everyone reads the same picture.";
    }
    if (cat === "exits") {
      return "Protect the kick or carry picture first, then keep the chase and support connected beyond it.";
    }
    return detail.length ? detail.join("; ") : `Build the ${play.name} shape before the ball leaves the source.`;
  }

  function inferAttackErrors(play, cat) {
    if (cat === "calls") {
      return ["The term is called late and players never share the same picture.", "The language is used without the surrounding shape being organised."];
    }
    if (cat === "exits") {
      return ["The platform gets messy before the exit option is live.", "The chase or support picture disconnects from the exit decision."];
    }
    if (play.type === "Phase Direction") {
      return ["The team arrives too deep and loses front-foot pressure.", "Support lines disconnect from the decision-maker."];
    }
    if (play.type === "Call") {
      return ["Timing is late and the call never creates a real advantage.", "Communication is unclear and runners attack different pictures."];
    }
    return ["The launch shape is not built before the ball moves.", "Width and support disconnect from the primary decision."];
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

  function buildLoCalls() {
    document.getElementById("loCalls80").innerHTML = lo80
      .map(
        (call) => `
        <div class="lo-call" onclick="toggleLo(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleLo(this);}" tabindex="0" role="button" aria-expanded="false">
          <div class="lc-name">${call.name}</div>
          <div class="lc-sub">${call.sub}</div>
          <div class="lc-detail">${call.detail}</div>
        </div>
      `,
      )
      .join("");

    document.getElementById("loCalls50").innerHTML = lo50
      .map(
        (call) => `
        <div class="lo-call" onclick="toggleLo(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleLo(this);}" tabindex="0" role="button" aria-expanded="false">
          <div class="lc-name">${call.name}</div>
          <div class="lc-sub">${call.sub}</div>
          <div class="lc-detail">${call.detail}</div>
        </div>
      `,
      )
      .join("");
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

  function setDefSide(side, btn) {
    document.querySelectorAll(".zone-tab").forEach((tab) => {
      tab.classList.remove("active");
      tab.setAttribute("aria-selected", "false");
    });

    if (btn) {
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
    }

    const sideData = defData[side];
    document.getElementById("defContent").innerHTML = `
      <div class="def-block"><h4 class="${sideData.green.color}"><span class="sr-only">Low Risk: </span>${sideData.green.title}</h4><ul>${sideData.green.points.map((point) => `<li>${point}</li>`).join("")}</ul></div>
      <div class="def-block"><h4 class="${sideData.orange.color}"><span class="sr-only">Medium Risk: </span>${sideData.orange.title}</h4><ul>${sideData.orange.points.map((point) => `<li>${point}</li>`).join("")}</ul></div>
      <div class="def-block"><h4 class="${sideData.red.color}"><span class="sr-only">High Risk: </span>${sideData.red.title}</h4><ul>${sideData.red.points.map((point) => `<li>${point}</li>`).join("")}</ul></div>
    `;

    if (window.innerWidth <= 768) {
      requestAnimationFrame(() => {
        const el = document.getElementById('defContent');
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY - 108;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      });
    }
  }

  function renderDevelopmentHub() {
    const hub = document.getElementById("developmentHub");
    if (!hub) {
      return;
    }

    hub.innerHTML = developmentModules
      .map(
        (module) => `
          <button class="module-card module-card-${module.accent}" type="button" onclick="goTo(${module.slide})">
            <div class="module-card-top">
              <div class="module-icon module-icon-${module.accent}" aria-hidden="true">${getModuleIcon(module.iconType)}</div>
              <div class="module-progress">
                <div class="module-progress-label">${module.progressLabel}</div>
                <div class="module-status-pill module-status-${slug(module.status)}">${module.status}</div>
              </div>
            </div>
            <div>
              <h3 class="module-card-title">${module.title}</h3>
              <p class="module-card-desc">${module.shortDescription}</p>
            </div>
            <div class="module-card-meta">
              <div class="module-progress-value">${module.progressValue}</div>
            </div>
            <div class="module-progress-bar">
              <div class="module-progress-track">
                <div class="module-progress-fill module-progress-fill-${module.accent}" style="width:${module.progressPercent}%"></div>
              </div>
            </div>
            <div class="module-card-link">Open module <span>&#9654;</span></div>
          </button>
        `,
      )
      .join("");

    const pillars = document.getElementById("developmentPillars");
    if (pillars) {
      pillars.innerHTML = `
        <div class="module-sidebar-list">
          <div class="module-sidebar-item"><strong>Growth</strong><span>Progress through every stage.</span></div>
          <div class="module-sidebar-item"><strong>Habits</strong><span>Daily discipline drives performance.</span></div>
          <div class="module-sidebar-item"><strong>Club Support</strong><span>Better people build better rugby.</span></div>
        </div>
      `;
    }

    const status = document.getElementById("developmentStatus");
    if (status) {
      status.innerHTML = developmentModules
        .map(
          (module) => `
            <button class="module-status-row" type="button" onclick="goTo(${module.slide})">
              <span class="module-status-row-title">${module.title}</span>
              <span class="module-status-row-meta">
                <span class="module-status-pill module-status-${slug(module.status)}">${module.status}</span>
                <span class="module-status-row-progress">${module.progressValue}</span>
              </span>
            </button>
          `,
        )
        .join("");
    }
  }

  function renderDevelopmentModules() {
    developmentModules.forEach((module) => {
      const main = document.getElementById(`moduleMain-${module.id}`);
      const side = document.getElementById(`moduleSide-${module.id}`);
      if (!main || !side) {
        return;
      }

      main.innerHTML = `
        <div class="module-overview fadeup">
          <div class="module-overview-copy">
            <div class="module-kicker">Development Module</div>
            <h3 class="module-overview-title">${module.title}</h3>
            <div class="module-intro">
              <p>${module.mission}</p>
            </div>
          </div>
          <div class="module-overview-icon module-overview-icon-${module.accent}" aria-hidden="true">${getModuleIcon(module.iconType)}</div>
        </div>
        <div class="module-highlights fadeup">
          ${module.highlights.map((highlight) => `<div class="module-pill">${highlight}</div>`).join("")}
        </div>
        <div class="module-accordion-stack fadeup">
          ${module.sections
            .map(
              (section, index) => `
                <article class="module-accordion ${index === 0 ? "active" : ""}" aria-expanded="${index === 0 ? "true" : "false"}">
                  <button class="module-accordion-head" type="button" onclick="toggleModuleSection(this.closest('.module-accordion'))" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleModuleSection(this.closest('.module-accordion'));}">
                    <div>
                      <h3>${section.title}</h3>
                      <div class="module-accordion-sub">${section.subtitle || module.tag}</div>
                    </div>
                    <div class="module-accordion-arrow">&#9660;</div>
                  </button>
                  <div class="module-accordion-body">
                    ${section.overview ? `
                      <div class="module-overview-strip">
                        <div class="module-overview-chip">
                          <span class="module-overview-chip-label">LTAD Stage</span>
                          <span class="module-overview-chip-value">${section.overview.stage}</span>
                        </div>
                        <div class="module-overview-chip">
                          <span class="module-overview-chip-label">Train/Match</span>
                          <span class="module-overview-chip-value">${section.overview.ratio}</span>
                        </div>
                        <div class="module-overview-chip module-overview-chip-focus">
                          <span class="module-overview-chip-label">Key Focus</span>
                          <span class="module-overview-chip-value">${section.overview.focus}</span>
                        </div>
                      </div>
                    ` : ""}
                    ${section.groups
                      ? section.groups.map((group) => `
                          <div class="module-group-accordion" aria-expanded="false">
                            <button class="module-group-head" type="button"
                               onclick="event.stopPropagation();toggleModuleGroup(this.closest('.module-group-accordion'))"
                               onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();toggleModuleGroup(this.closest('.module-group-accordion'));}">
                              <div class="module-group-label">${group.title}</div>
                              <div class="module-group-arrow">&#9660;</div>
                            </button>
                            <div class="module-group-body">
                              <ul class="module-list">
                                ${group.points.map((point) => `<li>${point}</li>`).join("")}
                              </ul>
                            </div>
                          </div>
                        `).join("")
                      : `
                          <p class="module-accordion-intro">${module.intro}</p>
                          <ul class="module-list">
                            ${(section.points || []).map((point) => `<li>${point}</li>`).join("")}
                          </ul>
                        `
                    }
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
      `;

      const related = developmentModules
        .filter((item) => item.id !== module.id)
        .map(
          (item) => `
            <button class="module-related-link" type="button" onclick="goTo(${item.slide})">
              <span>${item.title}</span>
              <span>&#9654;</span>
            </button>
          `,
        )
        .join("");

      side.innerHTML = `
        <div class="module-side-stack fadeup">
          <section class="module-panel">
            <h4 class="module-panel-title">Module Status</h4>
            <div class="module-metric-grid">
              ${module.metrics
                .map(
                  (metric) => `
                    <div class="metric-chip">
                      <div class="m-val">${metric.value}</div>
                      <div class="m-label">${metric.label}</div>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </section>
          <section class="module-panel">
            <h4 class="module-panel-title">Progress</h4>
            <div class="module-progress-label">${module.progressLabel}</div>
            <div class="module-status-row-meta" style="margin-top:10px;">
              <span class="module-status-pill module-status-${slug(module.status)}">${module.status}</span>
              <span class="module-progress-value">${module.progressValue}</span>
            </div>
            <div class="module-progress-bar" style="margin-top:14px;">
              <div class="module-progress-track">
                <div class="module-progress-fill module-progress-fill-${module.accent}" style="width:${module.progressPercent}%"></div>
              </div>
            </div>
          </section>
          <section class="module-summary">
            <h4 class="module-panel-title">${module.summaryTitle}</h4>
            <div class="ov-pull">${module.callout}</div>
            <p>${module.summaryText}</p>
          </section>
          <section class="module-panel">
            <h4 class="module-panel-title">Related Modules</h4>
            <div class="module-related-list">${related}</div>
          </section>
        </div>
      `;
    });
  }

  function toggleModuleSection(el) {
    const wasActive = el.classList.contains("active");
    const container = el.parentElement;
    if (container) {
      container.querySelectorAll(".module-accordion").forEach((item) => {
        item.classList.remove("active");
        item.setAttribute("aria-expanded", "false");
        const body = item.querySelector(".module-accordion-body");
        if (body) {
          body.style.maxHeight = "";
        }
      });
    }

    if (!wasActive) {
      el.classList.add("active");
      el.setAttribute("aria-expanded", "true");
      const body = el.querySelector(".module-accordion-body");
      if (body) {
        body.style.maxHeight = body.scrollHeight + "px";
      }
    }
  }

  function toggleModuleGroup(el) {
    const wasActive = el.classList.contains("active");
    const parentBody = el.closest(".module-accordion-body");
    const body = el.querySelector(".module-group-body");

    el.classList.toggle("active", !wasActive);
    el.setAttribute("aria-expanded", !wasActive ? "true" : "false");

    if (body) {
      body.style.display = !wasActive ? "block" : "none";
    }

    if (parentBody) {
      requestAnimationFrame(() => {
        parentBody.style.maxHeight = parentBody.scrollHeight + "px";
      });
    }
  }

  function slug(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function getModuleIcon(type) {
    const icons = {
      pathway: `
        <svg viewBox="0 0 48 48" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="10" cy="34" r="2.5"></circle>
          <circle cx="22" cy="25" r="2.5"></circle>
          <circle cx="34" cy="16" r="2.5"></circle>
          <path d="M12.5 32.5 19.5 27.2 24.5 22.8 31.5 18"></path>
        </svg>`,
      fuel: `
        <svg viewBox="0 0 48 48" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="24" cy="24" r="15"></circle>
          <path d="M25 12 18 26h7l-2 10 8-15h-7l1-9Z"></path>
        </svg>`,
      athletic: `
        <svg viewBox="0 0 48 48" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M24 8 35 12v9c0 8-5.2 14.2-11 18-5.8-3.8-11-10-11-18v-9l11-4Z"></path>
          <path d="m18 25 6-6 6 6"></path>
          <path d="M24 19v12"></path>
        </svg>`,
      wellbeing: `
        <svg viewBox="0 0 48 48" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="24" cy="24" r="15"></circle>
          <path d="M24 15v9l6 3"></path>
          <path d="M24 9v3M39 24h-3M24 39v-3M12 24H9"></path>
        </svg>`,
    };

    return icons[type] || type || "";
  }

  async function sendMsg() {
    const input = document.getElementById("chatInp");
    const q = input.value.trim();
    if (!q) {
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
          system: `${playbookContext}\n\nAnswer concisely in plain text. Use short bullet points where helpful. Do not use markdown headers.`,
          messages: [{ role: "user", content: q }],
        }),
      });

      const responseData = await res.json();
      removeTyping();
      const text = responseData.content?.map((block) => block.text || "").join("") || "Sorry, I couldn't process that.";
      addMsg("ai", text);
    } catch (error) {
      removeTyping();
      addMsg("ai", "Connection error. Please try again.");
    }

    document.getElementById("sendBtn").disabled = false;
  }

  function askQ(el) {
    document.getElementById("chatInp").value = el.textContent;
    sendMsg();
  }

  function init() {
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

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        changeSlide(1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        changeSlide(-1);
      }
    });

    let sx = null;
    document.addEventListener("touchstart", (event) => {
      sx = event.touches[0].clientX;
    });

    document.addEventListener("touchend", (event) => {
      if (sx === null) {
        return;
      }

      const diff = sx - event.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        changeSlide(diff > 0 ? 1 : -1);
      }

      sx = null;
    });

    document.addEventListener("click", (event) => {
      if (!mobileWorkspaceMenuOpen || !isMobileViewport()) {
        return;
      }

      const activeSlide = document.getElementById(`s${cur}`);
      const map = activeSlide?.querySelector(".workspace-map");
      const bar = activeSlide?.querySelector(".mobile-workspace-bar");
      const appHeader = document.querySelector(".mobile-app-header");
      const drawer = document.querySelector(".mobile-module-drawer-sheet");
      const bottomNav = document.querySelector(".mobile-bottom-nav");
      if (
        map?.contains(event.target) ||
        bar?.contains(event.target) ||
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
    buildTopbarLogos();
    buildWorkspaceMap();
    buildPortalReturnLinks();
    buildWorkspaceShellStatus();
    buildMobileAppChrome();
    syncSlideNumbers();
    updateNav();
    buildLoCalls();
    renderDevelopmentHub();
    renderDevelopmentModules();
    renderAttackCategory("setpiece", document.querySelector(".zone-btn.active"));
    setDefSide("rhs", document.querySelector(".zone-tab"));
  }

  window.askQ = askQ;
  window.changeSlide = changeSlide;
  window.closeFieldLightbox = closeFieldLightbox;
  window.closeOverlay = closeOverlay;
  window.goTo = goTo;
  window.openFieldLightbox = openFieldLightbox;
  window.openOverlay = openOverlay;
  window.sendMsg = sendMsg;
  window.setCategory = renderAttackCategory;
  window.setDefSide = setDefSide;
  window.toggleFieldArea = toggleFieldArea;
  window.toggleFieldMap = toggleFieldMap;
  window.toggleForwardPodsMap = toggleForwardPodsMap;
  window.toggleLo = toggleLo;
  window.toggleModuleGroup = toggleModuleGroup;
  window.toggleModuleSection = toggleModuleSection;
  window.togglePlay = togglePlay;

  init();
})();
