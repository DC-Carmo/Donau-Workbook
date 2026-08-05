window.AnimatorBoardPdf = (() => {
  const LOGO_URL = '../../assets/donau/images/rugby_ball_fire_scalable_bottom_right_fixed.svg';
  const PREVIEW_ROOT_ID = 'pdfReportPreviewRoot';
  const palette = {
    ink: '#06110d',
    panel: '#0d1b14',
    emerald: '#1f6b43',
    gold: '#e3b23c',
    goldSoft: '#f5d77b',
    line: '#c8ad63',
    paper: '#f5f0df',
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
    },
  };

  let cachedLogoDataUrl = '';

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

  async function loadLogoDataUrl() {
    if (cachedLogoDataUrl) return cachedLogoDataUrl;
    const response = await fetch(LOGO_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load logo asset (${response.status})`);
    }
    const svgText = await response.text();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, img.naturalWidth || 600);
          canvas.height = Math.max(1, img.naturalHeight || 600);
          const context = canvas.getContext('2d');
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('Failed to rasterize logo'));
        img.src = url;
      });
      cachedLogoDataUrl = dataUrl;
      return dataUrl;
    } finally {
      URL.revokeObjectURL(url);
    }
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
        padding: '48px 46px 56px',
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
          minHeight: '980px',
          borderRadius: '28px',
          background: `linear-gradient(150deg, ${palette.ink} 0%, ${palette.panel} 45%, ${palette.emerald} 100%)`,
          color: palette.white,
          padding: '44px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        });
        const header = style(document.createElement('div'), {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '24px',
        });
        const brand = style(document.createElement('div'), {
          display: 'flex',
          gap: '18px',
          alignItems: 'center',
        });
        const logo = document.createElement('img');
        logo.src = report.logoDataUrl;
        logo.alt = 'RDA';
        style(logo, { width: '88px', height: '88px', objectFit: 'contain' });
        const brandCopy = document.createElement('div');
        brandCopy.innerHTML = `<div style="font-size:12px;letter-spacing:0.28em;text-transform:uppercase;color:${palette.goldSoft};">RDA</div><div style="font-size:20px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${tr(report.language, 'boardTitle')}</div>`;
        brand.append(logo, brandCopy);
        const date = style(document.createElement('div'), {
          fontSize: '14px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: palette.goldSoft,
        });
        date.textContent = `${tr(report.language, 'generated')} · ${report.dateLabel}`;
        header.append(brand, date);

        const titleWrap = style(document.createElement('div'), {
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        });
        const title = style(document.createElement('h1'), {
          margin: '0',
          fontFamily: '"Barlow Condensed", "Barlow", sans-serif',
          fontSize: '72px',
          lineHeight: '0.94',
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          maxWidth: '520px',
        });
        title.textContent = report.name;
        const tagline = style(document.createElement('div'), {
          fontSize: '18px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: palette.goldSoft,
        });
        tagline.textContent = tr(report.language, 'tagline');
        titleWrap.append(title, tagline);

        const footerBand = style(document.createElement('div'), {
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '24px',
          alignItems: 'end',
          paddingTop: '24px',
          borderTop: `1px solid rgba(245, 215, 123, 0.35)`,
        });
        footerBand.innerHTML = `<div style="font-size:16px;line-height:1.6;color:rgba(255,255,255,0.88);max-width:420px;">${tr(report.language, 'boardTitle')}</div><div style="font-size:14px;letter-spacing:0.16em;text-transform:uppercase;color:${palette.goldSoft};">${report.moveCount} ${boardTr('toolbar.addMove', report.language, 'moves').toLowerCase()}</div>`;

        hero.append(header, titleWrap, footerBand);
        pageEl.appendChild(hero);
      } else {
        const top = style(document.createElement('div'), {
          display: 'flex',
          justifyContent: 'space-between',
          gap: '18px',
          alignItems: 'flex-start',
        });
        const left = document.createElement('div');
        left.innerHTML = `<div style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:${palette.emerald};font-weight:700;">RDA</div><h2 style="margin:6px 0 0;font-family:'Barlow Condensed','Barlow',sans-serif;font-size:40px;line-height:1;letter-spacing:0.03em;text-transform:uppercase;color:${palette.ink};">${page.title}</h2>`;
        const right = style(document.createElement('div'), {
          textAlign: 'right',
          fontSize: '13px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: palette.muted,
          paddingTop: '6px',
        });
        right.textContent = `${tr(report.language, 'generated')} · ${report.dateLabel}`;
        top.append(left, right);

        const imageCard = style(document.createElement('div'), {
          border: `1px solid rgba(6, 17, 13, 0.12)`,
          borderRadius: '22px',
          overflow: 'hidden',
          background: '#dde8df',
          boxShadow: '0 14px 30px rgba(6, 17, 13, 0.08)',
        });
        const image = document.createElement('img');
        image.src = page.image;
        image.alt = page.title;
        style(image, {
          display: 'block',
          width: '100%',
          height: '390px',
          objectFit: 'cover',
          background: '#0b1712',
        });
        imageCard.appendChild(image);

        const notesWrap = style(document.createElement('div'), {
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '22px 24px 0',
        });
        const notesTitle = style(document.createElement('div'), {
          fontSize: '12px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: palette.emerald,
          fontWeight: '700',
        });
        notesTitle.textContent = tr(report.language, 'coachingNotes');
        notesWrap.appendChild(notesTitle);
        if (page.notes.length) {
          page.notes.forEach((note) => {
            const block = style(document.createElement('div'), {
              borderTop: `1px solid rgba(6, 17, 13, 0.08)`,
              paddingTop: '12px',
            });
            block.innerHTML = `<div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${palette.gold};font-weight:700;margin-bottom:6px;">${note.label}</div><div style="font-size:15px;line-height:1.55;color:${palette.ink};white-space:pre-wrap;">${note.value}</div>`;
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
        borderTop: `1px solid rgba(6, 17, 13, 0.12)`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '12px',
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

  function renderNotesToPdf(doc, notes, language, startY, pageWidth, pageHeight, createContinuationPage, titleText) {
    const maxWidth = pageWidth - 28;
    const bottomLimit = pageHeight - 20;
    let y = startY;
    const safeNotes = Array.isArray(notes) ? notes : [];
    if (!safeNotes.length) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10.5);
      doc.setTextColor(104, 112, 119);
      doc.text(tr(language, 'noNotes'), 16, y);
      return y + 10;
    }
    safeNotes.forEach((note) => {
      const labelLines = doc.splitTextToSize(String(note.label || ''), maxWidth);
      const valueLines = doc.splitTextToSize(String(note.value || ''), maxWidth);
      const blockHeight = (labelLines.length * 4.4) + (valueLines.length * 5) + 8;
      if (y + blockHeight > bottomLimit) {
        createContinuationPage(titleText);
        y = 28;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(227, 178, 60);
      doc.text(labelLines, 16, y);
      y += labelLines.length * 4.4 + 1.6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.4);
      doc.setTextColor(18, 24, 21);
      doc.text(valueLines, 16, y);
      y += valueLines.length * 5 + 5;
    });
    return y;
  }

  function renderCoverPage(doc, report, pageWidth, pageHeight) {
    doc.setFillColor(6, 17, 13);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setFillColor(15, 43, 29);
    doc.roundedRect(12, 12, pageWidth - 24, pageHeight - 24, 10, 10, 'F');
    if (report.logoDataUrl) {
      doc.addImage(report.logoDataUrl, 'PNG', 16, 18, 26, 26);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(245, 215, 123);
    doc.text('RDA', 48, 26);
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(tr(report.language, 'boardTitle'), 48, 33);
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text(report.name, 16, 70, { maxWidth: pageWidth - 32 });
    doc.setFontSize(14);
    doc.setTextColor(245, 215, 123);
    doc.text(tr(report.language, 'tagline'), 16, 84);
    doc.setDrawColor(245, 215, 123);
    doc.setLineWidth(0.5);
    doc.line(16, 95, pageWidth - 16, 95);
    doc.setFontSize(11);
    doc.setTextColor(220, 227, 223);
    doc.text(`${tr(report.language, 'generated')} · ${report.dateLabel}`, 16, 106);
    doc.setFontSize(10);
    doc.setTextColor(200, 210, 205);
    doc.text(`${report.moveCount} total moves · ${report.phaseCount} phases`, 16, 116);
  }

  async function buildReport(project, language, captureStepImage) {
    const safeLanguage = resolveLanguage(language);
    const dateLabel = formatDate(safeLanguage);
    const logoDataUrl = await loadLogoDataUrl();
    const moves = extractMoves(project);
    const pages = [{
      kind: 'cover',
      title: project.name || 'Play',
    }];
    for (const move of moves) {
      const image = await captureStepImage(move.step, { width: 2200, height: 1320, dpr: 2 });
      const title = `${tr(safeLanguage, 'phase')} ${move.phaseIndex + 1} · ${tr(safeLanguage, 'move')} ${move.stepIndex + 1}`;
      pages.push({
        kind: 'move',
        title,
        image,
        notes: move.notes.map((note) => ({
          label: boardTr(note.key, safeLanguage, note.key),
          value: note.value,
        })),
      });
    }
    return {
      name: project.name || 'Play',
      fileName: sanitizeFileName(project.name || 'tactical-board-report'),
      moveCount: moves.length,
      phaseCount: Array.isArray(project?.phases) ? project.phases.length : 0,
      language: safeLanguage,
      dateLabel,
      logoDataUrl,
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
      const page = report.pages[i];
      doc.addPage('a4', 'portrait');
      doc.setFillColor(245, 240, 223);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(31, 107, 67);
      doc.text('RDA', 16, 16);
      doc.setFontSize(23);
      doc.setTextColor(6, 17, 13);
      doc.text(page.title, 16, 27);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.6);
      doc.setTextColor(104, 112, 119);
      doc.text(`${tr(report.language, 'generated')} · ${report.dateLabel}`, pageWidth - 16, 16, { align: 'right' });

      const fit = mmFit(2200, 1320, pageWidth - 32, 108);
      doc.addImage(page.image, 'PNG', 16, 34, fit.width, fit.height, undefined, 'FAST');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(31, 107, 67);
      doc.text(tr(report.language, 'coachingNotes'), 16, 34 + fit.height + 12);

      const createContinuationPage = (titleText) => {
        doc.addPage('a4', 'portrait');
        doc.setFillColor(245, 240, 223);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(31, 107, 67);
        doc.text('RDA', 16, 16);
        doc.setFontSize(18);
        doc.setTextColor(6, 17, 13);
        doc.text(titleText, 16, 26);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.2);
        doc.setTextColor(104, 112, 119);
        doc.text(`${tr(report.language, 'coachingNotes')}`, pageWidth - 16, 16, { align: 'right' });
      };

      renderNotesToPdf(
        doc,
        page.notes,
        report.language,
        34 + fit.height + 20,
        pageWidth,
        pageHeight,
        createContinuationPage,
        page.title
      );
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
    };
  }

  return {
    exportReport,
  };
})();
