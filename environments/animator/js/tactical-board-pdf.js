window.AnimatorBoardPdf = (() => {
  const LOGO_URLS = [
    '../../assets/donau/images/LogoRDA2.png',
    '../../assets/donau/images/LogoRDA.png',
    '../../assets/donau/images/rugby_ball_fire_scalable_bottom_right_fixed.svg',
  ];
  const PREVIEW_ROOT_ID = 'pdfReportPreviewRoot';
  const MID_DOT = ' \u00b7 ';
  const palette = {
    ink: '#06110d',
    panel: '#0d1b14',
    emerald: '#1f6b43',
    emeraldDeep: '#123524',
    gold: '#e3b23c',
    goldSoft: '#f5d77b',
    line: '#c8ad63',
    paper: '#f5f0df',
    paperSoft: '#fbf7eb',
    muted: '#6b7280',
    white: '#ffffff',
  };

  const reportDict = {
    en: {
      boardTitle: 'Tactical Board Report',
      phase: 'Phase',
      move: 'Move',
      generated: 'Generated',
      page: 'Page',
      coachingNotes: 'Coaching Notes',
      noNotes: 'No coaching notes for this phase.',
      tagline: 'Develop. Perform. Succeed.',
      moveSingular: 'move',
      movePlural: 'moves',
      phaseSingular: 'phase',
      phasePlural: 'phases',
      summaryLead: 'Board Summary',
      moveReport: 'Move Report',
    },
    'pt-BR': {
      boardTitle: 'Relatorio do Quadro Tatico',
      phase: 'Fase',
      move: 'Movimento',
      generated: 'Gerado em',
      page: 'Pagina',
      coachingNotes: 'Notas de treino',
      noNotes: 'Sem notas de treino para esta fase.',
      tagline: 'Develop. Perform. Succeed.',
      moveSingular: 'movimento',
      movePlural: 'movimentos',
      phaseSingular: 'fase',
      phasePlural: 'fases',
      summaryLead: 'Resumo do quadro',
      moveReport: 'Relatorio de movimentos',
    },
    es: {
      boardTitle: 'Informe del tablero tactico',
      phase: 'Fase',
      move: 'Movimiento',
      generated: 'Generado',
      page: 'Pagina',
      coachingNotes: 'Notas de coaching',
      noNotes: 'No hay notas de coaching para esta fase.',
      tagline: 'Develop. Perform. Succeed.',
      moveSingular: 'movimiento',
      movePlural: 'movimientos',
      phaseSingular: 'fase',
      phasePlural: 'fases',
      summaryLead: 'Resumen del tablero',
      moveReport: 'Informe de movimientos',
    },
    fr: {
      boardTitle: 'Rapport du tableau tactique',
      phase: 'Phase',
      move: 'Mouvement',
      generated: 'Genere le',
      page: 'Page',
      coachingNotes: 'Notes de coaching',
      noNotes: 'Aucune note de coaching pour cette phase.',
      tagline: 'Develop. Perform. Succeed.',
      moveSingular: 'mouvement',
      movePlural: 'mouvements',
      phaseSingular: 'phase',
      phasePlural: 'phases',
      summaryLead: 'Resume du tableau',
      moveReport: 'Rapport des mouvements',
    },
  };

  let cachedLogoAsset = null;

  function resolveLanguage(code) {
    if (reportDict[code]) return code;
    if (typeof code === 'string' && code.toLowerCase().startsWith('pt')) return 'pt-BR';
    if (typeof code === 'string' && code.toLowerCase().startsWith('es')) return 'es';
    if (typeof code === 'string' && code.toLowerCase().startsWith('fr')) return 'fr';
    return 'en';
  }

  function tr(language, key, fallback) {
    const lang = resolveLanguage(language);
    return reportDict[lang]?.[key] || reportDict.en[key] || fallback || key;
  }

  function boardTr(key, language, fallback, params) {
    const dict = window.AnimatorBoardI18n;
    if (dict?.t) {
      return dict.t(key, params || {}, fallback);
    }
    return fallback || tr(language, key, fallback);
  }

  function formatDate(language, value = new Date()) {
    const lang = resolveLanguage(language);
    try {
      return new Intl.DateTimeFormat(lang, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(value);
    } catch {
      return new Date(value).toLocaleDateString();
    }
  }

  function sanitizeFileName(name) {
    const raw = String(name || 'tactical-board-report').trim() || 'tactical-board-report';
    return raw.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').replace(/\s+/g, ' ').trim();
  }

  function normalizeLines(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  function pluralLabel(language, count, singularKey, pluralKey) {
    return count === 1
      ? tr(language, singularKey, singularKey)
      : tr(language, pluralKey, pluralKey);
  }

  function buildSummaryLine(language, moveCount, phaseCount) {
    return `${moveCount} ${pluralLabel(language, moveCount, 'moveSingular', 'movePlural')}${MID_DOT}${phaseCount} ${pluralLabel(language, phaseCount, 'phaseSingular', 'phasePlural')}`;
  }

  function buildGeneratedLine(language, dateLabel) {
    return `${tr(language, 'generated')} ${dateLabel}`;
  }

  function parseSvgDimension(value, fallback) {
    const numeric = parseFloat(String(value || '').replace(/[^\d.]/g, ''));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  }

  function parseSvgBox(svgText) {
    const viewBoxMatch = svgText.match(/viewBox\s*=\s*"([^"]+)"/i);
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].trim().split(/\s+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        return { width: parts[2], height: parts[3] };
      }
    }
    const widthMatch = svgText.match(/\swidth\s*=\s*"([^"]+)"/i);
    const heightMatch = svgText.match(/\sheight\s*=\s*"([^"]+)"/i);
    const width = parseSvgDimension(widthMatch?.[1], 616);
    const height = parseSvgDimension(heightMatch?.[1], 348);
    return { width, height };
  }

  function extractEmbeddedImageDataUrl(svgText) {
    const match = svgText.match(/<image[^>]+href="([^"]+)"/i) || svgText.match(/<image[^>]+xlink:href="([^"]+)"/i);
    if (!match) return '';
    const candidate = String(match[1] || '').trim();
    return /^data:image\//i.test(candidate) ? candidate : '';
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read logo asset.'));
      reader.readAsDataURL(blob);
    });
  }

  function loadImageSize(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({
        width: Math.max(1, img.naturalWidth || img.width || 1),
        height: Math.max(1, img.naturalHeight || img.height || 1),
      });
      img.onerror = () => reject(new Error('Failed to decode logo asset.'));
      img.src = dataUrl;
    });
  }

  async function rasterizeSvg(svgText, width, height, scale = 4) {
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const context = canvas.getContext('2d');
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('Failed to rasterize logo'));
        img.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function loadRasterLogoAsset(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load logo asset (${response.status})`);
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    const { width, height } = await loadImageSize(dataUrl);
    return { dataUrl, width, height };
  }

  async function loadSvgLogoAsset(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load logo asset (${response.status})`);
    const svgText = await response.text();
    const { width, height } = parseSvgBox(svgText);
    const embeddedDataUrl = extractEmbeddedImageDataUrl(svgText);
    const dataUrl = embeddedDataUrl || await rasterizeSvg(svgText, width, height, 4);
    return { dataUrl, width, height };
  }

  async function loadLogoAsset() {
    if (cachedLogoAsset) return cachedLogoAsset;
    let lastError = null;
    for (const url of LOGO_URLS) {
      try {
        cachedLogoAsset = url.toLowerCase().endsWith('.svg')
          ? await loadSvgLogoAsset(url)
          : await loadRasterLogoAsset(url);
        return cachedLogoAsset;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Failed to load logo asset.');
  }

  function normalizeSnapshotImage(snapshot) {
    if (typeof snapshot === 'string') {
      return {
        dataUrl: snapshot,
        width: 1800,
        height: 3000,
      };
    }
    if (snapshot && typeof snapshot === 'object' && typeof snapshot.dataUrl === 'string') {
      return {
        dataUrl: snapshot.dataUrl,
        width: Math.max(1, Number(snapshot.width) || 1800),
        height: Math.max(1, Number(snapshot.height) || 3000),
      };
    }
    throw new Error('Invalid snapshot payload for PDF export.');
  }

  function buildNotes(project, phase) {
    const meta = phase?.metadata || project?.metadata || {};
    return [
      {
        key: 'phase.purpose',
        value: String(meta.purpose || '').trim(),
      },
      {
        key: 'decision.cue',
        value: String(meta.decisionCue || '').trim(),
      },
      {
        key: 'coaching.points',
        value: normalizeLines(meta.coachingPoints).join('\n'),
      },
      {
        key: 'common.mistakes',
        value: normalizeLines(meta.commonMistakes).join('\n'),
      },
    ].filter((entry) => entry.value);
  }

  function extractMoves(project) {
    const phases = Array.isArray(project?.phases) ? project.phases : [];
    const moves = [];
    phases.forEach((phase, phaseIndex) => {
      const steps = Array.isArray(phase?.steps) ? phase.steps : [];
      steps.forEach((step, stepIndex) => {
        moves.push({
          phaseIndex,
          stepIndex,
          phase,
          step,
          notes: buildNotes(project, phase),
        });
      });
    });
    return moves;
  }

  function clearPreviewRoot() {
    const existing = document.getElementById(PREVIEW_ROOT_ID);
    if (existing) existing.remove();
  }

  function createPreviewRoot() {
    clearPreviewRoot();
    const root = document.createElement('div');
    root.id = PREVIEW_ROOT_ID;
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    root.style.cssText = [
      'position:fixed',
      'left:-20000px',
      'top:0',
      'width:0',
      'height:0',
      'overflow:hidden',
      'pointer-events:none',
      'opacity:0',
      'z-index:-1',
    ].join(';');
    document.body.appendChild(root);
    return root;
  }

  function style(node, rules) {
    Object.assign(node.style, rules);
    return node;
  }

  function buildPreviewImageCard(image, altText, options = {}) {
    const card = style(document.createElement('div'), {
      border: options.border || `1px solid rgba(6, 17, 13, 0.12)`,
      borderRadius: options.radius || '22px',
      overflow: 'hidden',
      background: options.background || palette.paperSoft,
      boxShadow: options.shadow || '0 18px 34px rgba(6, 17, 13, 0.10)',
      padding: options.padding || '10px',
      width: options.width || '100%',
      maxWidth: options.maxWidth || '100%',
      minHeight: options.minHeight || '0',
      height: options.height || 'auto',
      alignSelf: options.alignSelf || 'stretch',
      margin: options.margin || '0',
      boxSizing: 'border-box',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    });
    const img = document.createElement('img');
    img.src = image.dataUrl;
    img.alt = altText;
    style(img, {
      display: 'block',
      width: '100%',
      height: options.imageHeight || 'auto',
      maxHeight: options.maxHeight || 'none',
      objectFit: options.objectFit || 'contain',
      borderRadius: options.imageRadius || '16px',
      background: options.imageBackground || '#dfe9df',
    });
    card.appendChild(img);
    return card;
  }

  function buildPreviewPages(report) {
    const root = createPreviewRoot();
    report.pages.forEach((page, pageIndex) => {
      const pageEl = style(document.createElement('section'), {
        width: '794px',
        minHeight: '1123px',
        background: palette.paper,
        color: palette.ink,
        marginBottom: '20px',
        boxSizing: 'border-box',
        padding: '36px 42px 52px',
        position: 'relative',
        fontFamily: '"Barlow", Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      });
      pageEl.dataset.pageIndex = String(pageIndex);
      pageEl.dataset.pageKind = page.kind;
      pageEl.id = `${PREVIEW_ROOT_ID}-page-${pageIndex + 1}`;

      if (page.kind === 'cover') {
        const hero = style(document.createElement('div'), {
          minHeight: '1018px',
          borderRadius: '28px',
          background: `linear-gradient(155deg, ${palette.ink} 0%, ${palette.panel} 44%, ${palette.emerald} 100%)`,
          color: palette.white,
          padding: '32px 34px 28px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        });
        const glowA = style(document.createElement('div'), {
          position: 'absolute',
          width: '380px',
          height: '380px',
          right: '-80px',
          top: '-80px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,215,123,0.22) 0%, rgba(245,215,123,0.04) 55%, rgba(245,215,123,0) 75%)',
          pointerEvents: 'none',
        });
        const glowB = style(document.createElement('div'), {
          position: 'absolute',
          width: '320px',
          height: '320px',
          left: '-110px',
          bottom: '240px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(31,107,67,0.30) 0%, rgba(31,107,67,0.08) 52%, rgba(31,107,67,0) 72%)',
          pointerEvents: 'none',
        });
        hero.append(glowA, glowB);

        const header = style(document.createElement('div'), {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '22px',
          position: 'relative',
          zIndex: '1',
        });
        const brand = style(document.createElement('div'), {
          display: 'flex',
          gap: '14px',
          alignItems: 'center',
        });
        const logo = document.createElement('img');
        logo.src = report.logo.dataUrl;
        logo.alt = 'RDA';
        style(logo, {
          width: '132px',
          height: '72px',
          objectFit: 'contain',
          objectPosition: 'center center',
        });
        const brandCopy = document.createElement('div');
        brandCopy.innerHTML = `<div style="font-size:11px;letter-spacing:0.30em;text-transform:uppercase;color:${palette.goldSoft};">RDA</div><div style="font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-size:26px;line-height:0.92;letter-spacing:0.04em;text-transform:uppercase;">${tr(report.language, 'boardTitle')}</div>`;
        brand.append(logo, brandCopy);

        const date = style(document.createElement('div'), {
          fontSize: '13px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: palette.goldSoft,
          textAlign: 'right',
          lineHeight: '1.45',
          maxWidth: '210px',
        });
        date.textContent = buildGeneratedLine(report.language, report.dateLabel);
        header.append(brand, date);

        const titleWrap = style(document.createElement('div'), {
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          position: 'relative',
          zIndex: '1',
          padding: '6px 0 0',
        });
        const kicker = style(document.createElement('div'), {
          fontSize: '12px',
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: palette.goldSoft,
          fontWeight: '700',
        });
        kicker.textContent = tr(report.language, 'summaryLead');
        const title = style(document.createElement('h1'), {
          margin: '0',
          fontFamily: '"Barlow Condensed","Arial Narrow",sans-serif',
          fontSize: '72px',
          lineHeight: '0.92',
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          maxWidth: '620px',
        });
        title.textContent = report.name;
        const tagline = style(document.createElement('div'), {
          fontSize: '18px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: palette.goldSoft,
        });
        tagline.textContent = tr(report.language, 'tagline');
        const summaryPill = style(document.createElement('div'), {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          width: 'fit-content',
          padding: '10px 15px',
          borderRadius: '999px',
          border: '1px solid rgba(245,215,123,0.34)',
          background: 'rgba(6,17,13,0.24)',
          color: palette.white,
          fontFamily: '"Barlow Condensed","Arial Narrow",sans-serif',
          fontSize: '23px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        });
        summaryPill.textContent = report.summaryLine;
        titleWrap.append(kicker, title, tagline, summaryPill);

        if (report.coverImage) {
          const coverImageCard = buildPreviewImageCard(report.coverImage, report.name, {
            border: '1px solid rgba(245,215,123,0.28)',
            radius: '24px',
            background: 'rgba(245,240,223,0.10)',
            shadow: '0 18px 40px rgba(0,0,0,0.24)',
            padding: '12px',
            imageRadius: '18px',
            imageBackground: '#d5e6d4',
            width: '432px',
            maxWidth: '100%',
            minHeight: '556px',
            height: '556px',
            imageHeight: '100%',
            alignSelf: 'center',
          });
          coverImageCard.dataset.coverHero = 'true';
          hero.append(header, titleWrap, coverImageCard);
        } else {
          hero.append(header, titleWrap);
        }

        const footerBand = style(document.createElement('div'), {
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '20px',
          alignItems: 'end',
          paddingTop: '16px',
          borderTop: '1px solid rgba(245,215,123,0.24)',
          position: 'relative',
          zIndex: '1',
          marginTop: 'auto',
        });
        footerBand.innerHTML = `<div style="font-size:15px;line-height:1.55;color:rgba(255,255,255,0.88);max-width:430px;">${tr(report.language, 'moveReport')}</div><div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:${palette.goldSoft};">${report.summaryLine}</div>`;
        hero.appendChild(footerBand);
        pageEl.appendChild(hero);
      } else {
        const top = style(document.createElement('div'), {
          display: 'flex',
          justifyContent: 'space-between',
          gap: '18px',
          alignItems: 'flex-start',
        });
        const left = document.createElement('div');
        left.innerHTML = `<div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:${palette.emerald};font-weight:700;">RDA</div><h2 style="margin:6px 0 0;font-family:'Barlow Condensed','Arial Narrow',sans-serif;font-size:44px;line-height:0.95;letter-spacing:0.04em;text-transform:uppercase;color:${palette.ink};">${page.title}</h2>`;
        const right = style(document.createElement('div'), {
          textAlign: 'right',
          fontSize: '12px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: palette.muted,
          paddingTop: '6px',
          maxWidth: '190px',
          lineHeight: '1.45',
        });
        right.textContent = buildGeneratedLine(report.language, report.dateLabel);
        top.append(left, right);

        const imageCard = buildPreviewImageCard(page.image, page.title, {
          border: '1px solid rgba(6, 17, 13, 0.14)',
          radius: '22px',
          background: '#eef3ea',
          shadow: '0 16px 34px rgba(6, 17, 13, 0.10)',
          padding: '12px',
          imageRadius: '16px',
          imageBackground: '#dfe9df',
          width: '438px',
          maxWidth: '100%',
          minHeight: '650px',
          height: '650px',
          imageHeight: '100%',
          alignSelf: 'center',
        });
        imageCard.dataset.contentImage = 'true';

        const notesWrap = style(document.createElement('div'), {
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '6px 4px 0',
        });
        const notesTitle = style(document.createElement('div'), {
          fontSize: '11px',
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: palette.emerald,
          fontWeight: '700',
        });
        notesTitle.textContent = tr(report.language, 'coachingNotes');
        notesWrap.appendChild(notesTitle);
        if (page.notes.length) {
          page.notes.forEach((note) => {
            const block = style(document.createElement('div'), {
              borderTop: '1px solid rgba(6, 17, 13, 0.08)',
              paddingTop: '12px',
            });
            block.innerHTML = `<div style="font-size:10px;letter-spacing:0.20em;text-transform:uppercase;color:${palette.gold};font-weight:700;margin-bottom:6px;">${note.label}</div><div style="font-size:15px;line-height:1.58;color:${palette.ink};white-space:pre-wrap;">${note.value}</div>`;
            notesWrap.appendChild(block);
          });
        } else {
          const empty = style(document.createElement('div'), {
            fontSize: '15px',
            lineHeight: '1.5',
            color: palette.muted,
            paddingTop: '8px',
          });
          empty.textContent = tr(report.language, 'noNotes');
          notesWrap.appendChild(empty);
        }

        pageEl.append(top, imageCard, notesWrap);
      }

      const footer = style(document.createElement('div'), {
        marginTop: 'auto',
        paddingTop: '18px',
        borderTop: '1px solid rgba(6, 17, 13, 0.12)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: palette.muted,
      });
      footer.innerHTML = `<span>RDA</span><span>${tr(report.language, 'page')} ${pageIndex + 1} / ${report.pages.length}</span>`;
      pageEl.appendChild(footer);
      root.appendChild(pageEl);
    });
    return root;
  }

  function mmFit(srcWidth, srcHeight, maxWidth, maxHeight) {
    const scale = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
    return {
      width: srcWidth * scale,
      height: srcHeight * scale,
    };
  }

  function drawImageCard(doc, image, x, y, maxWidth, maxHeight, options = {}) {
    const padding = Number(options.padding) || 2.2;
    const radius = Number(options.radius) || 4;
    const borderColor = options.borderColor || [210, 197, 156];
    const fillColor = options.fillColor || [250, 247, 237];
    const usable = mmFit(image.width, image.height, Math.max(8, maxWidth - (padding * 2)), Math.max(8, maxHeight - (padding * 2)));
    const cardWidth = usable.width + (padding * 2);
    const cardHeight = usable.height + (padding * 2);
    let drawX = x;
    if (options.align === 'center') {
      drawX = x + Math.max(0, (maxWidth - cardWidth) / 2);
    } else if (options.align === 'right') {
      drawX = x + Math.max(0, maxWidth - cardWidth);
    }
    doc.setFillColor(...fillColor);
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.35);
    doc.roundedRect(drawX, y, cardWidth, cardHeight, radius, radius, 'FD');
    doc.addImage(image.dataUrl, 'PNG', drawX + padding, y + padding, usable.width, usable.height, undefined, 'FAST');
    return {
      x: drawX,
      width: cardWidth,
      height: cardHeight,
      innerWidth: usable.width,
      innerHeight: usable.height,
    };
  }

  function addFooter(doc, language, pageNumber, pageCount, pageWidth, pageHeight) {
    doc.setDrawColor(210, 197, 156);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(31, 107, 67);
    doc.text('RDA', 14, pageHeight - 7.6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(91, 102, 96);
    doc.text(`${tr(language, 'page')} ${pageNumber} / ${pageCount}`, pageWidth - 14, pageHeight - 7.6, { align: 'right' });
  }

  function movePageNoteStyle() {
    return {
      columns: 2,
      columnGap: 8,
      labelFontSize: 7.8,
      labelLineHeight: 3.4,
      labelGap: 2,
      textFontSize: 8.7,
      textLineHeight: 4.15,
      blockPaddingTop: 3,
      blockGap: 4.5,
      topRuleOffset: 1.8,
      ruleInset: 0,
    };
  }

  function measureNoteBlock(doc, note, columnWidth, style) {
    const safeLabel = String(note?.label || '');
    const safeValue = String(note?.value || '');
    const labelLines = doc.splitTextToSize(safeLabel, columnWidth);
    const valueLines = doc.splitTextToSize(safeValue, columnWidth);
    const labelHeight = Math.max(1, labelLines.length) * style.labelLineHeight;
    const valueHeight = Math.max(1, valueLines.length) * style.textLineHeight;
    return {
      note,
      labelLines,
      valueLines,
      height: style.blockPaddingTop + labelHeight + style.labelGap + valueHeight + style.blockGap,
    };
  }

  function buildNotesColumns(doc, notes, totalWidth, maxColumnHeight, style) {
    const columnCount = Math.max(1, Math.min(style.columns, Array.isArray(notes) ? notes.length || 1 : 1));
    const gap = columnCount > 1 ? style.columnGap : 0;
    const columnWidth = (totalWidth - (gap * (columnCount - 1))) / columnCount;
    const blocks = (Array.isArray(notes) ? notes : []).map((note) => measureNoteBlock(doc, note, columnWidth, style));
    const pages = [];

    const createPage = () => ({
      columns: Array.from({ length: columnCount }, (_, index) => ({
        index,
        blocks: [],
        height: 0,
      })),
    });

    let page = createPage();
    blocks.forEach((block) => {
      let placed = false;
      while (!placed) {
        const sortedColumns = [...page.columns].sort((a, b) => a.height - b.height);
        const target = sortedColumns.find((column) => column.height + block.height <= maxColumnHeight);
        if (target) {
          target.blocks.push(block);
          target.height += block.height;
          placed = true;
          continue;
        }
        const hasContent = page.columns.some((column) => column.blocks.length);
        if (!hasContent) {
          page.columns[0].blocks.push(block);
          page.columns[0].height += block.height;
          placed = true;
        } else {
          pages.push(page);
          page = createPage();
        }
      }
    });

    pages.push(page);
    return {
      pages,
      columnWidth,
      columnGap: gap,
      usedHeight: Math.max(0, ...page.columns.map((column) => column.height)),
    };
  }

  function renderNotesColumnsToPdf(doc, pageLayout, x, startY, totalWidth, style) {
    pageLayout.columns.forEach((column, index) => {
      const columnX = x + index * (pageLayout.columnWidth + pageLayout.columnGap);
      let y = startY;
      column.blocks.forEach((block) => {
        doc.setDrawColor(228, 221, 196);
        doc.setLineWidth(0.25);
        doc.line(
          columnX + style.ruleInset,
          y - style.topRuleOffset,
          columnX + pageLayout.columnWidth - style.ruleInset,
          y - style.topRuleOffset
        );
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(style.labelFontSize);
        doc.setTextColor(227, 178, 60);
        doc.text(block.labelLines, columnX, y + style.labelLineHeight);
        y += style.blockPaddingTop + (Math.max(1, block.labelLines.length) * style.labelLineHeight) + style.labelGap;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(style.textFontSize);
        doc.setTextColor(18, 24, 21);
        doc.text(block.valueLines, columnX, y);
        y += (Math.max(1, block.valueLines.length) * style.textLineHeight) + style.blockGap;
      });
    });
  }

  function selectMovePageLayout(doc, page, pageWidth, pageHeight) {
    const style = movePageNoteStyle();
    const imageY = 32;
    const imageMaxWidth = pageWidth - 32;
    const notesHeadingGap = 10;
    const notesStartGap = 7;
    const bottomLimit = pageHeight - 22;
    const imageHeights = [138, 132, 126, 120, 114, 108, 102, 96];
    const noteWidth = pageWidth - 32;
    let fallback = null;

    for (const imageHeight of imageHeights) {
      const notesStartY = imageY + imageHeight + notesHeadingGap + notesStartGap;
      const availableNotesHeight = Math.max(24, bottomLimit - notesStartY);
      const layout = buildNotesColumns(doc, page.notes, noteWidth, availableNotesHeight, style);
      const candidate = {
        style,
        imageY,
        imageMaxWidth,
        imageHeight,
        notesHeadingY: imageY + imageHeight + notesHeadingGap,
        notesStartY,
        noteWidth,
        notePages: layout.pages,
        noteColumnWidth: layout.columnWidth,
        noteColumnGap: layout.columnGap,
        bottomLimit,
      };
      if (!fallback) fallback = candidate;
      if (layout.pages.length === 1) return candidate;
    }

    return fallback;
  }

  function renderMoveNotesContinuationPage(doc, page, report, pageWidth, pageHeight, notePage, style) {
    doc.addPage('a4', 'portrait');
    doc.setFillColor(245, 240, 223);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(31, 107, 67);
    doc.text('RDA', 16, 15);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(6, 17, 13);
    doc.text(page.title, 16, 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(104, 112, 119);
    doc.text(tr(report.language, 'coachingNotes'), pageWidth - 16, 15, { align: 'right' });

    renderNotesColumnsToPdf(doc, {
      columns: notePage.columns,
      columnWidth: (pageWidth - 32 - (style.columnGap * (notePage.columns.length - 1))) / notePage.columns.length,
      columnGap: notePage.columns.length > 1 ? style.columnGap : 0,
    }, 16, 36, pageWidth - 32, style);
  }

  function renderCoverPage(doc, report, pageWidth, pageHeight) {
    doc.setFillColor(6, 17, 13);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setFillColor(15, 43, 29);
    doc.roundedRect(10, 10, pageWidth - 20, pageHeight - 20, 12, 12, 'F');

    doc.setFillColor(18, 53, 36);
    doc.circle(pageWidth - 18, 18, 28, 'F');
    doc.setFillColor(31, 107, 67);
    doc.circle(20, pageHeight - 70, 34, 'F');

    const logoWidth = 30;
    const logoHeight = (logoWidth / report.logo.width) * report.logo.height;
    if (report.logo.dataUrl) {
      doc.addImage(report.logo.dataUrl, 'PNG', 16, 16, logoWidth, logoHeight, undefined, 'MEDIUM');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(245, 215, 123);
    doc.text('RDA', 48, 21);
    doc.setFontSize(18);
    doc.text(tr(report.language, 'boardTitle'), 48, 28);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.8);
    doc.setTextColor(245, 215, 123);
    doc.text(buildGeneratedLine(report.language, report.dateLabel), pageWidth - 16, 21, { align: 'right' });

    const titleLines = doc.splitTextToSize(report.name, pageWidth - 34);
    let titleY = 48;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(245, 215, 123);
    doc.text(tr(report.language, 'summaryLead'), 16, titleY);
    titleY += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(255, 255, 255);
    doc.text(titleLines, 16, titleY);
    titleY += (titleLines.length * 9.2) + 3;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(245, 215, 123);
    doc.text(tr(report.language, 'tagline'), 16, titleY);
    titleY += 8;

    doc.setFillColor(8, 23, 17);
    doc.setDrawColor(245, 215, 123);
    doc.setLineWidth(0.4);
    doc.roundedRect(16, titleY, 68, 11, 5.5, 5.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.8);
    doc.setTextColor(255, 255, 255);
    doc.text(report.summaryLine, 19, titleY + 7.1);

    if (report.coverImage) {
      const imageTop = titleY + 17;
      const maxWidth = pageWidth - 36;
      const maxHeight = pageHeight - imageTop - 36;
      drawImageCard(doc, report.coverImage, 18, imageTop, maxWidth, maxHeight, {
        padding: 2.4,
        radius: 6,
        borderColor: [245, 215, 123],
        fillColor: [18, 53, 36],
        align: 'center',
      });
    }
  }

  function renderMovePage(doc, page, report, pageWidth, pageHeight) {
    doc.addPage('a4', 'portrait');
    doc.setFillColor(245, 240, 223);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(31, 107, 67);
    doc.text('RDA', 16, 15);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(6, 17, 13);
    doc.text(page.title, 16, 26);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(104, 112, 119);
    doc.text(buildGeneratedLine(report.language, report.dateLabel), pageWidth - 16, 15, { align: 'right' });

    const layout = selectMovePageLayout(doc, page, pageWidth, pageHeight);

    const imageCard = drawImageCard(doc, page.image, 16, layout.imageY, layout.imageMaxWidth, layout.imageHeight, {
      padding: 2.4,
      radius: 6,
      borderColor: [220, 215, 195],
      fillColor: [250, 247, 237],
      align: 'center',
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(31, 107, 67);
    doc.text(tr(report.language, 'coachingNotes'), 16, layout.notesHeadingY);

    if (!layout.notePages[0]?.columns.some((column) => column.blocks.length)) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10.5);
      doc.setTextColor(104, 112, 119);
      doc.text(tr(report.language, 'noNotes'), 16, layout.notesStartY);
      return;
    }

    renderNotesColumnsToPdf(doc, {
      columns: layout.notePages[0].columns,
      columnWidth: layout.noteColumnWidth,
      columnGap: layout.noteColumnGap,
    }, 16, layout.notesStartY, layout.noteWidth, layout.style);

    for (let i = 1; i < layout.notePages.length; i += 1) {
      renderMoveNotesContinuationPage(doc, page, report, pageWidth, pageHeight, layout.notePages[i], layout.style);
    }
  }

  async function buildReport(project, language, captureStepImage) {
    const safeLanguage = resolveLanguage(language);
    const dateLabel = formatDate(safeLanguage);
    const logo = await loadLogoAsset();
    const moves = extractMoves(project);
    const pages = [];
    let coverImage = null;

    for (const move of moves) {
      const image = normalizeSnapshotImage(await captureStepImage(move.step, {
        width: 1800,
        height: 3000,
        dpr: 2,
        rotateLandscape: false,
      }));
      if (!coverImage) coverImage = image;
      pages.push({
        kind: 'move',
        title: `${tr(safeLanguage, 'phase')} ${move.phaseIndex + 1}${MID_DOT}${tr(safeLanguage, 'move')} ${move.stepIndex + 1}`,
        image,
        notes: move.notes.map((note) => ({
          label: boardTr(note.key, safeLanguage, note.key),
          value: note.value,
        })),
      });
    }

    const summaryLine = buildSummaryLine(safeLanguage, moves.length, Array.isArray(project?.phases) ? project.phases.length : 0);
    pages.unshift({
      kind: 'cover',
      title: project.name || 'Play',
    });

    return {
      name: project.name || 'Play',
      fileName: sanitizeFileName(project.name || 'tactical-board-report'),
      moveCount: moves.length,
      phaseCount: Array.isArray(project?.phases) ? project.phases.length : 0,
      language: safeLanguage,
      dateLabel,
      logo,
      coverImage,
      summaryLine,
      pages,
    };
  }

  async function exportReport({ project, language = 'en', captureStepImage, fileName }) {
    if (!project || typeof captureStepImage !== 'function') {
      throw new Error('AnimatorBoardPdf.exportReport requires project data and a captureStepImage callback.');
    }
    if (!window.jspdf?.jsPDF) {
      throw new Error('jsPDF is unavailable.');
    }

    const report = await buildReport(project, language, captureStepImage);
    if (fileName) report.fileName = sanitizeFileName(fileName);
    buildPreviewPages(report);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    renderCoverPage(doc, report, pageWidth, pageHeight);
    for (let i = 1; i < report.pages.length; i += 1) {
      renderMovePage(doc, report.pages[i], report, pageWidth, pageHeight);
    }

    const pageCount = doc.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      doc.setPage(pageNumber);
      addFooter(doc, report.language, pageNumber, pageCount, pageWidth, pageHeight);
    }

    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    if (window.__lastPdfReport?.blobUrl) {
      URL.revokeObjectURL(window.__lastPdfReport.blobUrl);
    }

    const downloadName = `${report.fileName}.pdf`;
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = downloadName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.__lastPdfReport = {
      name: report.name,
      language: report.language,
      dateLabel: report.dateLabel,
      summaryLine: report.summaryLine,
      pageCount,
      pages: report.pages.map((page, index) => ({
        kind: page.kind,
        title: page.title,
        notesCount: Array.isArray(page.notes) ? page.notes.length : 0,
        previewId: `${PREVIEW_ROOT_ID}-page-${index + 1}`,
      })),
      previewRootId: PREVIEW_ROOT_ID,
      blobUrl,
      blobSize: blob.size,
      fileName: downloadName,
    };

    return {
      pageCount,
      fileName: report.fileName,
      blobSize: blob.size,
      summaryLine: report.summaryLine,
    };
  }

  return {
    exportReport,
  };
})();
