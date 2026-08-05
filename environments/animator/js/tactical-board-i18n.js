window.AnimatorBoardI18n = (() => {
  const STORAGE_KEY = 'rda.tacticalBoard.language';
  const LANGUAGES = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'pt-BR', label: 'Português (BR)', short: 'PT' },
    { code: 'es', label: 'Español', short: 'ES' },
    { code: 'fr', label: 'Français', short: 'FR' },
  ];

  const dictionaries = {
    en: {
      'brand.sub': 'Tactical Board',
      'language.change': 'Change language',
      'board.name': 'Board Name',
      'board.placeholder': 'Play name...',
      'sequence.controls': 'Sequence controls',
      'history.controls': 'History controls',
      'move.previous': 'Previous move',
      'move.next': 'Next move',
      'play.label': 'Play',
      'play.play': 'Play',
      'play.pause': 'Pause',
      'play.resume': 'Resume',
      'play.playAll': 'Play All',
      'play.pauseAll': 'Pause All',
      'play.playFromHere': 'Play from Here',
      'play.playPhase': 'Play Phase',
      'play.previewMove': 'Preview Move',
      'play.stop': 'Stop',
      'portal': 'Portal',
      'autosave.saved': 'Saved',
      'autosave.saving': 'Saving...',
      'autosave.unsaved': 'Unsaved',
      'autosave.failed': 'Save failed',
      'save': 'Save',
      'export.pdf': 'Export PDF',
      'export.json': 'Export JSON',
      'import': 'Import',
      'menu': 'Menu',
      'recovery.kicker': 'Recovery Draft',
      'recovery.title': 'Unsaved play found',
      'recovery.message': 'We found an unsaved play.',
      'restore': 'Restore',
      'discard': 'Discard',
      'notNow': 'Not now',
      'board.actions': 'Board actions',
      'board.menu': 'Board Menu',
      'coaching.notes': 'Coaching Notes',
      'context.panel': 'Context Panel',
      'default.copy': 'Choose a tool and build the phase. The panel updates as you work.',
      'default.tip.mode': 'Mode:',
      'default.tip.tip': 'Tip:',
      'default.tip.action': 'Action:',
      'default.tip.modeValue': 'Move',
      'default.tip.tipValue': 'Add a step to capture phase progression.',
      'default.tip.actionValue': 'Tap a player to select, or use RUN / PASS / KICK.',
      'kick.step1': 'Tap the kicker to arm the kick',
      'kick.step2': 'Tap a receiver or open field spot',
      'annotation.text': 'Annotation Text',
      'annotation.placeholder': 'Phase cue',
      'annotation.copy.default': 'Choose a highlight or secondary tool, then click or drag on the field.',
      'annotation.copy.note': 'Click the field to place a premium note card. The input above sets the default note text.',
      'annotation.copy.arrow': 'Drag on the field to draw a free tactical arrow.',
      'annotation.copy.circle': 'Drag on the field to size a circle or oval highlight for space, support, or defensive gaps. Hold Shift for a perfect circle.',
      'annotation.copy.box': 'Drag on the field to size a box highlight for channels, pressure areas, or field zones.',
      'annotation.copy.kick': 'Secondary tool: click the kicker, then the target.',
      'annotation.copy.erase': 'Secondary tool: remove players, the ball, paths, passes, or highlights.',
      'arrow.style': 'Arrow Style',
      'shape.style': 'Shape Style',
      'style.chooseDefault': 'Choose the default style before drawing.',
      'style.selectedLive': 'Selected {item} updates live as you change style.',
      'color': 'Color',
      'lineStyle': 'Line Style',
      'line': 'Line',
      'weight': 'Weight',
      'thickness': 'Thickness',
      'solid': 'Solid',
      'dashed': 'Dashed',
      'thin': 'Thin',
      'normal': 'Normal',
      'thick': 'Thick',
      'selected': 'Selected',
      'note.text': 'Note Text',
      'note.placeholder': 'Update note text',
      'details': 'Details',
      'giveBall': 'Give Ball',
      'deselect': 'Deselect',
      'remove': 'Remove',
      'editIndividuals': 'Edit Individuals',
      'regroupPack': 'Regroup Pack',
      'gainline.status': 'On gainline',
      'plays.opposition': 'Plays & Opposition',
      'opposition.off': 'Opposition: Off',
      'opposition.on': 'Opposition: On',
      'phase.purpose': 'Phase Purpose',
      'phase.purpose.placeholder': 'What is this play trying to achieve?',
      'decision.cue': 'Decision Cue',
      'decision.cue.placeholder': 'What should the player read?',
      'coaching.points': 'Coaching Points',
      'coaching.point1': 'Point 1',
      'coaching.point2': 'Point 2',
      'coaching.point3': 'Point 3',
      'common.mistakes': 'Common Mistakes',
      'mistake.1': 'Mistake 1',
      'mistake.2': 'Mistake 2',
      'mistake.3': 'Mistake 3',
      'empty.kicker': 'Start Here',
      'empty.title': 'Build your first board state',
      'empty.copy': 'Add players from the bottom rail, place the ball, then choose a tool to draw movement.',
      'toolbar.addAttack.desktop': '+ ATTACK',
      'toolbar.addAttack.mobile': '+ATK',
      'toolbar.addDefence.desktop': '+ DEFENCE',
      'toolbar.addDefence.mobile': '+DEF',
      'toolbar.ball': 'BALL',
      'toolbar.run': 'RUN',
      'toolbar.pass': 'PASS',
      'toolbar.kick': 'KICK',
      'toolbar.move': 'MOVE',
      'toolbar.move.mobile': 'MV',
      'toolbar.erase': 'ERASE',
      'toolbar.erase.mobile': 'DEL',
      'toolbar.tele': 'TELE',
      'toolbar.tele.mobile': 'TEL',
      'toolbar.undo': 'UNDO',
      'toolbar.undo.mobile': '&#8617;',
      'toolbar.redo': 'REDO',
      'toolbar.redo.mobile': '&#8618;',
      'toolbar.circle': 'CIRCLE',
      'toolbar.circle.mobile': 'O',
      'toolbar.box': 'BOX',
      'toolbar.arrow': 'ARROW',
      'toolbar.arrow.mobile': 'ARR',
      'toolbar.note': 'NOTE',
      'toolbar.clear': 'CLEAR',
      'toolbar.clear.mobile': '&#10005;',
      'toolbar.gainline': 'GAINLINE',
      'toolbar.ghostPrev': 'GHOST PREV',
      'toolbar.mode': 'Mode: {mode}',
      'player.summary.copy': 'Plain click adds the next player. Use ▼ to choose a specific number.',
      'picker.attackNumbers': 'Attack Numbers',
      'picker.defenceNumbers': 'Defence Numbers',
      'picker.meta': 'Pick a number to place, or jump back to one already on the board.',
      'picker.available': 'Available player numbers',
      'palette.notPlaced': 'Not Placed',
      'palette.loose': 'Loose',
      'palette.copy': '{team} numbers ready to place. Used numbers stay dimmed until removed.',
      'palette.attack': 'Attack',
      'palette.defence': 'Defence',
      'status.mode': 'Mode',
      'status.step': 'Step {current} of {total}',
      'status.ball.off': 'Ball: Off board',
      'status.ball.loose': 'Ball: Loose',
      'status.board': 'Board',
      'toggle.on': 'ON',
      'toggle.off': 'OFF',
      'more.phase': 'PHASE',
      'more.move': 'MOVE',
      'more.gainline': 'GAINLINE',
      'more.erase': 'ERASE',
      'more.arrow': 'ARROW',
      'more.circle': 'CIRCLE',
      'more.notes': 'NOTES',
      'more.clear': 'CLEAR',
      'more.fitPitch': 'FIT FULL PITCH',
      'more.editingView': 'EDITING VIEW',
      'mode.move': 'Move',
      'mode.run': 'Run',
      'mode.pass': 'Pass',
      'mode.kick': 'Kick',
      'mode.erase': 'Erase',
      'mode.box': 'Box Highlight',
      'mode.note': 'Note',
      'mode.arrow': 'Arrow',
      'mode.zone': 'Circle Highlight',
      'mode.ellipse': 'Circle Highlight',
      'mode.tele': 'Telestrator',
      'hint.move': 'MOVE - drag players, ball, paths or notes to reposition. Click a path to select it.',
      'hint.run': 'RUN - click a player, then drag to draw their movement path.',
      'hint.pass': 'PASS - click the passer (ball transfers automatically), then click the receiver.',
      'hint.kick': 'KICK - click the kicker (ball transfers automatically), then click a player or field target.',
      'hint.erase': 'ERASE - click any player, ball, path or annotation to remove it.',
      'hint.box': 'BOX - drag on the pitch to highlight a channel or area.',
      'hint.note': 'NOTE - click the pitch to place a coaching cue card.',
      'hint.arrow': 'ARROW - drag to draw a coaching annotation arrow. Does not animate players.',
      'hint.zone': 'CIRCLE - drag to place a circle or oval highlight. Hold Shift for a perfect circle.',
      'hint.tele': 'TELESTRATOR - draw live ink that fades in 3 seconds.',
      'guide.move': 'Move objects. Drag players, ball, paths or notes to reposition. Click a run path, pass or kick to select it.',
      'guide.run': 'Create player movement. Click a player, draw the run path, then play the step.',
      'guide.pass': 'Tap the passer - ball moves to them automatically. Then tap the receiver.',
      'guide.kick': 'Tap the kicker - ball moves to them automatically. Then tap a receiver or field target.',
      'guide.zone': 'Drag on the field to draw a circle highlight area.',
      'guide.box': 'Drag on the field to draw a box zone or channel.',
      'guide.arrow': 'Add visual annotation. Arrows explain intent but do not animate players.',
      'guide.note': 'Tap on the field to place a coaching cue card.',
      'guide.erase': 'Tap any player, ball, path, or annotation to remove it.',
      'guide.ellipse': 'Drag on the field to draw a circle or oval highlight area. Hold Shift for a perfect circle.',
      'guide.kick.select': 'Select your kicker, then choose a target or landing zone.',
      'summary.ballSelected.title': 'Ball Selected',
      'summary.ballSelected.meta': 'Drag the ball to a new spot or remove it from the board.{owner}{candidate}',
      'summary.note.title': 'Tactical Note',
      'summary.note.meta': 'Move it on the board, drag a corner handle to resize it, or update the note text below.',
      'summary.arrow.title': 'Free Arrow',
      'summary.arrow.meta': 'Drag the line or either endpoint in Move to refine the arrow.',
      'summary.zone.title': 'Circle Highlight',
      'summary.zone.meta': 'Drag the circle to move it or drag the outer handle to resize it.',
      'summary.box.title': 'Box Highlight',
      'summary.box.meta': 'Drag inside the box to move it, use the round handle above it to rotate, or drag any corner handle to resize it.',
      'summary.ellipse.title': 'Circle Highlight',
      'summary.ellipse.meta': 'Drag inside the shape to move it, use the round handle above it to rotate, or drag any corner handle to resize it. Hold Shift while resizing for a perfect circle.',
      'summary.multiPlayers.title': '{count} Players Selected',
      'summary.multiPlayers.meta': 'Ctrl/Cmd-click lets you build a temporary player set. Any color change now applies to all selected players.',
      'summary.runPath.title': 'Run Path',
      'summary.runPath.meta': 'Run path for {label}. Press Delete to remove it.',
      'summary.passLine.title': 'Pass Line',
      'summary.passLine.meta': 'Pass line {from}{to}. Press Delete to remove it.',
      'summary.kickPath.title': 'Kick Path',
      'summary.kickPath.meta': 'Kick path {from}. Press Delete to remove it.',
      'summary.none.meta': 'Select a player or ball to inspect it here.',
      'saved.empty': 'No local saves yet. Save the current board to keep building from it later.',
      'saved.local': 'Saved locally',
      'saved.load': 'Load',
      'saved.export': 'Export',
      'saved.delete': 'Delete',
      'saved.meta': '{steps} {stepsLabel} · {players} players · {paths} paths · {passes} passes',
      'saved.step': 'step',
      'saved.steps': 'steps',
      'tour.aria': 'Onboarding tour',
      'tour.skip': 'Skip tour',
      'tour.next': 'Next →',
      'tour.done': 'Done ✓',
      'tour.counter': 'Step {current} of {total}',
      'tour.1.title': 'Add players',
      'tour.1.body': 'Tap <strong>+ ATTACK</strong> or <strong>+ DEFENCE</strong> to drop numbered players onto the board. Add as many as you need.',
      'tour.2.title': 'Place the ball',
      'tour.2.body': 'Tap <strong>BALL</strong> to add the ball, then drag it to the starting position for your play.',
      'tour.3.title': 'Drag & arrange',
      'tour.3.body': 'With <strong>MOVE</strong> active, drag any player or the ball to set up your starting formation.',
      'tour.4.title': 'Draw movement',
      'tour.4.body': 'Select <strong>RUN</strong>, <strong>PASS</strong>, or <strong>KICK</strong> from the toolbar, then drag from a player to draw the action.',
      'tour.5.title': 'Build moves',
      'tour.5.body': 'Tap <strong>+</strong> to add the next move. Each chip represents one move - scrub through them to review the sequence.',
      'tour.6.title': 'Play it back',
      'tour.6.body': 'Tap <strong>PLAY</strong> to animate the whole sequence. Use <strong>PLAY ALL</strong> to run through every phase automatically. You are ready to coach!',
      'dock.removeBreak': 'Remove Break',
      'dock.cancelPhase': 'Cancel Phase',
      'dock.newPhase': 'New Phase',
      'dock.phase': 'Phase',
      'dock.more': 'More',
      'dock.back': 'Back',
      'dock.duplicate': 'Duplicate',
      'dock.duplicateMove': 'Duplicate Move',
      'dock.deleteMove': 'Delete Move',
      'dock.addMove': 'Add Move',
      'dock.addMove.short': '+ Move',
      'dock.preview': 'Preview',
      'dock.previewMove': 'Preview Move',
      'dock.playPhase': 'Play Phase',
      'dock.undo': 'Undo',
      'dock.redo': 'Redo',
    },
    'pt-BR': {
      'brand.sub': 'Quadro Tático',
      'language.change': 'Mudar idioma',
      'board.name': 'Nome do quadro',
      'board.placeholder': 'Nome da jogada...',
      'sequence.controls': 'Controles da sequência',
      'history.controls': 'Controles de histórico',
      'move.previous': 'Movimento anterior',
      'move.next': 'Próximo movimento',
      'play.label': 'Reproduzir',
      'play.play': 'Reproduzir',
      'play.pause': 'Pausar',
      'play.resume': 'Retomar',
      'play.playAll': 'Reproduzir tudo',
      'play.pauseAll': 'Pausar tudo',
      'play.playFromHere': 'Reproduzir daqui',
      'play.playPhase': 'Reproduzir fase',
      'play.previewMove': 'Prévia do movimento',
      'play.stop': 'Parar',
      'portal': 'Portal',
      'autosave.saved': 'Salvo',
      'autosave.saving': 'Salvando...',
      'autosave.unsaved': 'Não salvo',
      'autosave.failed': 'Falha ao salvar',
      'save': 'Salvar',
      'export.pdf': 'Exportar PDF',
      'export.json': 'Exportar JSON',
      'import': 'Importar',
      'menu': 'Menu',
      'recovery.kicker': 'Rascunho de recuperação',
      'recovery.title': 'Jogada não salva encontrada',
      'recovery.message': 'Encontramos uma jogada não salva.',
      'restore': 'Restaurar',
      'discard': 'Descartar',
      'notNow': 'Agora não',
      'board.actions': 'Ações do quadro',
      'board.menu': 'Menu do quadro',
      'coaching.notes': 'Notas de treino',
      'context.panel': 'Painel de contexto',
      'default.copy': 'Escolha uma ferramenta e monte a fase. O painel acompanha o seu trabalho.',
      'default.tip.mode': 'Modo:',
      'default.tip.tip': 'Dica:',
      'default.tip.action': 'Ação:',
      'default.tip.modeValue': 'Mover',
      'default.tip.tipValue': 'Adicione um movimento para registrar a progressão da fase.',
      'default.tip.actionValue': 'Toque em um jogador para selecionar ou use CORRIDA / PASSE / CHUTE.',
      'kick.step1': 'Toque no chutador para armar o chute',
      'kick.step2': 'Toque em um recebedor ou em um espaço livre',
      'annotation.text': 'Texto da anotação',
      'annotation.placeholder': 'Gatilho da fase',
      'annotation.copy.default': 'Escolha um destaque ou ferramenta secundária e depois clique ou arraste no campo.',
      'annotation.copy.note': 'Clique no campo para colocar um cartão premium de observação. O campo acima define o texto padrão.',
      'annotation.copy.arrow': 'Arraste no campo para desenhar uma seta tática livre.',
      'annotation.copy.circle': 'Arraste no campo para dimensionar um destaque circular ou oval para espaço, apoio ou buracos defensivos. Segure Shift para um círculo perfeito.',
      'annotation.copy.box': 'Arraste no campo para dimensionar um destaque em caixa para canais, zonas de pressão ou áreas do campo.',
      'annotation.copy.kick': 'Ferramenta secundária: clique no chutador e depois no alvo.',
      'annotation.copy.erase': 'Ferramenta secundária: remova jogadores, bola, trajetos, passes ou destaques.',
      'arrow.style': 'Estilo da seta',
      'shape.style': 'Estilo da forma',
      'style.chooseDefault': 'Escolha o estilo padrão antes de desenhar.',
      'style.selectedLive': '{item} selecionado atualiza ao vivo enquanto você muda o estilo.',
      'color': 'Cor',
      'lineStyle': 'Estilo da linha',
      'line': 'Linha',
      'weight': 'Peso',
      'thickness': 'Espessura',
      'solid': 'Sólida',
      'dashed': 'Tracejada',
      'thin': 'Fina',
      'normal': 'Normal',
      'thick': 'Grossa',
      'selected': 'Selecionado',
      'note.text': 'Texto da nota',
      'note.placeholder': 'Atualize o texto da nota',
      'details': 'Detalhes',
      'giveBall': 'Dar bola',
      'deselect': 'Desselecionar',
      'remove': 'Remover',
      'editIndividuals': 'Editar individuais',
      'regroupPack': 'Reagrupar pack',
      'gainline.status': 'Na linha de ganho',
      'plays.opposition': 'Jogadas e oposição',
      'opposition.off': 'Oposição: desligada',
      'opposition.on': 'Oposição: ligada',
      'phase.purpose': 'Objetivo da fase',
      'phase.purpose.placeholder': 'O que esta jogada busca alcançar?',
      'decision.cue': 'Leitura decisiva',
      'decision.cue.placeholder': 'O que o jogador deve ler?',
      'coaching.points': 'Pontos de treino',
      'coaching.point1': 'Ponto 1',
      'coaching.point2': 'Ponto 2',
      'coaching.point3': 'Ponto 3',
      'common.mistakes': 'Erros comuns',
      'mistake.1': 'Erro 1',
      'mistake.2': 'Erro 2',
      'mistake.3': 'Erro 3',
      'empty.kicker': 'Comece aqui',
      'empty.title': 'Monte o primeiro estado do quadro',
      'empty.copy': 'Adicione jogadores pela barra inferior, coloque a bola e depois escolha uma ferramenta para desenhar o movimento.',
      'toolbar.addAttack.desktop': '+ ATAQUE',
      'toolbar.addAttack.mobile': '+ATQ',
      'toolbar.addDefence.desktop': '+ DEFESA',
      'toolbar.addDefence.mobile': '+DEF',
      'toolbar.ball': 'BOLA',
      'toolbar.run': 'CORRIDA',
      'toolbar.pass': 'PASSE',
      'toolbar.kick': 'CHUTE',
      'toolbar.move': 'MOVER',
      'toolbar.move.mobile': 'MOV',
      'toolbar.erase': 'APAGAR',
      'toolbar.erase.mobile': 'DEL',
      'toolbar.tele': 'TELÊ',
      'toolbar.tele.mobile': 'TEL',
      'toolbar.undo': 'DESFAZER',
      'toolbar.undo.mobile': '&#8617;',
      'toolbar.redo': 'REFAZER',
      'toolbar.redo.mobile': '&#8618;',
      'toolbar.circle': 'CÍRCULO',
      'toolbar.circle.mobile': 'O',
      'toolbar.box': 'CAIXA',
      'toolbar.arrow': 'SETA',
      'toolbar.arrow.mobile': 'SET',
      'toolbar.note': 'NOTA',
      'toolbar.clear': 'LIMPAR',
      'toolbar.clear.mobile': '&#10005;',
      'toolbar.gainline': 'LINHA DE GANHO',
      'toolbar.ghostPrev': 'FANTASMA ANT.',
      'toolbar.mode': 'Modo: {mode}',
      'player.summary.copy': 'Clique simples adiciona o próximo jogador. Use ▼ para escolher um número específico.',
      'picker.attackNumbers': 'Números do ataque',
      'picker.defenceNumbers': 'Números da defesa',
      'picker.meta': 'Escolha um número para posicionar ou volte para um que já está no quadro.',
      'picker.available': 'Números de jogadores disponíveis',
      'palette.notPlaced': 'Não colocada',
      'palette.loose': 'Solta',
      'palette.copy': 'Números de {team} prontos para entrar. Os usados ficam escurecidos até serem removidos.',
      'palette.attack': 'ataque',
      'palette.defence': 'defesa',
      'status.mode': 'Modo',
      'status.step': 'Movimento {current} de {total}',
      'status.ball.off': 'Bola: fora do quadro',
      'status.ball.loose': 'Bola: solta',
      'status.board': 'Quadro',
      'toggle.on': 'LIG',
      'toggle.off': 'DESL',
      'more.phase': 'FASE',
      'more.move': 'MOV',
      'more.gainline': 'LINHA',
      'more.erase': 'APAGAR',
      'more.arrow': 'SETA',
      'more.circle': 'CÍRCULO',
      'more.notes': 'NOTAS',
      'more.clear': 'LIMPAR',
      'more.fitPitch': 'ENCAIXAR CAMPO',
      'more.editingView': 'VISTA DE EDIÇÃO',
      'mode.move': 'Mover',
      'mode.run': 'Corrida',
      'mode.pass': 'Passe',
      'mode.kick': 'Chute',
      'mode.erase': 'Apagar',
      'mode.box': 'Destaque em caixa',
      'mode.note': 'Nota',
      'mode.arrow': 'Seta',
      'mode.zone': 'Destaque circular',
      'mode.ellipse': 'Destaque circular',
      'mode.tele': 'Telestrador',
      'hint.move': 'MOVER - arraste jogadores, bola, trajetos ou notas para reposicionar. Clique em um trajeto para selecioná-lo.',
      'hint.run': 'CORRIDA - clique em um jogador e depois arraste para desenhar a corrida.',
      'hint.pass': 'PASSE - clique no passador (a bola vai para ele automaticamente) e depois no recebedor.',
      'hint.kick': 'CHUTE - clique no chutador (a bola vai para ele automaticamente) e depois em um jogador ou alvo no campo.',
      'hint.erase': 'APAGAR - clique em qualquer jogador, bola, trajeto ou anotação para remover.',
      'hint.box': 'CAIXA - arraste no campo para destacar um canal ou área.',
      'hint.note': 'NOTA - clique no campo para colocar um cartão de treino.',
      'hint.arrow': 'SETA - arraste para desenhar uma seta de anotação tática. Não anima jogadores.',
      'hint.zone': 'CÍRCULO - arraste para colocar um destaque circular ou oval. Segure Shift para um círculo perfeito.',
      'hint.tele': 'TELESTRADOR - desenhe tinta ao vivo que some em 3 segundos.',
      'guide.move': 'Mova objetos. Arraste jogadores, bola, trajetos ou notas para reposicionar. Clique em uma corrida, passe ou chute para selecionar.',
      'guide.run': 'Crie o movimento do jogador. Clique em um jogador, desenhe a corrida e depois reproduza o movimento.',
      'guide.pass': 'Toque no passador - a bola vai para ele automaticamente. Depois toque no recebedor.',
      'guide.kick': 'Toque no chutador - a bola vai para ele automaticamente. Depois toque em um recebedor ou alvo no campo.',
      'guide.zone': 'Arraste no campo para desenhar um destaque circular.',
      'guide.box': 'Arraste no campo para desenhar uma zona ou canal em caixa.',
      'guide.arrow': 'Adicione anotação visual. As setas explicam a intenção, mas não animam jogadores.',
      'guide.note': 'Toque no campo para colocar um cartão de treino.',
      'guide.erase': 'Toque em qualquer jogador, bola, trajeto ou anotação para remover.',
      'guide.ellipse': 'Arraste no campo para desenhar um destaque circular ou oval. Segure Shift para um círculo perfeito.',
      'guide.kick.select': 'Selecione o chutador e depois escolha um alvo ou ponto de queda.',
      'summary.ballSelected.title': 'Bola selecionada',
      'summary.ballSelected.meta': 'Arraste a bola para outro ponto ou remova-a do quadro.{owner}{candidate}',
      'summary.note.title': 'Nota tática',
      'summary.note.meta': 'Mova a nota no quadro, arraste uma alça de canto para redimensionar ou atualize o texto abaixo.',
      'summary.arrow.title': 'Seta livre',
      'summary.arrow.meta': 'Arraste a linha ou qualquer ponta no modo Mover para ajustar a seta.',
      'summary.zone.title': 'Destaque circular',
      'summary.zone.meta': 'Arraste o círculo para mover ou arraste a alça externa para redimensionar.',
      'summary.box.title': 'Destaque em caixa',
      'summary.box.meta': 'Arraste dentro da caixa para mover, use a alça redonda acima para girar ou arraste qualquer canto para redimensionar.',
      'summary.ellipse.title': 'Destaque circular',
      'summary.ellipse.meta': 'Arraste dentro da forma para mover, use a alça redonda acima para girar ou arraste qualquer canto para redimensionar. Segure Shift para um círculo perfeito.',
      'summary.multiPlayers.title': '{count} jogadores selecionados',
      'summary.multiPlayers.meta': 'Ctrl/Cmd-clique permite montar um grupo temporário. Qualquer mudança de cor agora vale para todos os jogadores selecionados.',
      'summary.runPath.title': 'Trajeto de corrida',
      'summary.runPath.meta': 'Trajeto de corrida de {label}. Pressione Delete para remover.',
      'summary.passLine.title': 'Linha de passe',
      'summary.passLine.meta': 'Linha de passe {from}{to}. Pressione Delete para remover.',
      'summary.kickPath.title': 'Trajeto de chute',
      'summary.kickPath.meta': 'Trajeto de chute {from}. Pressione Delete para remover.',
      'summary.none.meta': 'Selecione um jogador ou a bola para inspecionar aqui.',
      'saved.empty': 'Ainda não há salvamentos locais. Salve o quadro atual para continuar depois.',
      'saved.local': 'Salvo localmente',
      'saved.load': 'Carregar',
      'saved.export': 'Exportar',
      'saved.delete': 'Excluir',
      'saved.meta': '{steps} {stepsLabel} · {players} jogadores · {paths} trajetos · {passes} passes',
      'saved.step': 'movimento',
      'saved.steps': 'movimentos',
      'tour.aria': 'Tour de introdução',
      'tour.skip': 'Pular tour',
      'tour.next': 'Próximo →',
      'tour.done': 'Concluir ✓',
      'tour.counter': 'Etapa {current} de {total}',
      'tour.1.title': 'Adicione jogadores',
      'tour.1.body': 'Toque em <strong>+ ATAQUE</strong> ou <strong>+ DEFESA</strong> para colocar jogadores numerados no quadro. Adicione quantos precisar.',
      'tour.2.title': 'Coloque a bola',
      'tour.2.body': 'Toque em <strong>BOLA</strong> para adicionar a bola e depois arraste-a para a posição inicial da jogada.',
      'tour.3.title': 'Arraste e organize',
      'tour.3.body': 'Com <strong>MOVER</strong> ativo, arraste qualquer jogador ou a bola para montar a formação inicial.',
      'tour.4.title': 'Desenhe o movimento',
      'tour.4.body': 'Selecione <strong>CORRIDA</strong>, <strong>PASSE</strong> ou <strong>CHUTE</strong> na barra e depois arraste a partir de um jogador para desenhar a ação.',
      'tour.5.title': 'Monte os movimentos',
      'tour.5.body': 'Toque em <strong>+</strong> para adicionar o próximo movimento. Cada chip representa um movimento - percorra-os para revisar a sequência.',
      'tour.6.title': 'Reproduza a jogada',
      'tour.6.body': 'Toque em <strong>REPRODUZIR</strong> para animar toda a sequência. Use <strong>REPRODUZIR TUDO</strong> para passar por todas as fases automaticamente. Pronto para treinar!',
      'dock.removeBreak': 'Remover quebra',
      'dock.cancelPhase': 'Cancelar fase',
      'dock.newPhase': 'Nova fase',
      'dock.phase': 'Fase',
      'dock.more': 'Mais',
      'dock.back': 'Voltar',
      'dock.duplicate': 'Duplicar',
      'dock.duplicateMove': 'Duplicar movimento',
      'dock.deleteMove': 'Excluir movimento',
      'dock.addMove': 'Adicionar movimento',
      'dock.addMove.short': '+ Mov',
      'dock.preview': 'Prévia',
      'dock.previewMove': 'Prévia do movimento',
      'dock.playPhase': 'Reproduzir fase',
      'dock.undo': 'Desfazer',
      'dock.redo': 'Refazer',
    },
    es: {},
    fr: {},
  };

  // Populate ES/FR from EN first; targeted rugby UI terms are overridden below.
  dictionaries.es = {
    ...dictionaries.en,
    'brand.sub': 'Pizarra táctica',
    'language.change': 'Cambiar idioma',
    'board.name': 'Nombre de la pizarra',
    'board.placeholder': 'Nombre de la jugada...',
    'play.play': 'Reproducir',
    'play.pause': 'Pausar',
    'play.resume': 'Reanudar',
    'play.playAll': 'Reproducir todo',
    'play.playFromHere': 'Reproducir desde aquí',
    'play.playPhase': 'Reproducir fase',
    'play.previewMove': 'Vista previa del movimiento',
    'play.stop': 'Detener',
    'save': 'Guardar',
    'export.pdf': 'Exportar PDF',
    'export.json': 'Exportar JSON',
    'import': 'Importar',
    'menu': 'Menú',
    'coaching.notes': 'Notas de entrenamiento',
    'context.panel': 'Panel contextual',
    'arrow.style': 'Estilo de flecha',
    'shape.style': 'Estilo de forma',
    'style.chooseDefault': 'Elige el estilo predeterminado antes de dibujar.',
    'color': 'Color',
    'lineStyle': 'Estilo de línea',
    'weight': 'Peso',
    'thickness': 'Grosor',
    'solid': 'Sólida',
    'dashed': 'Discontinua',
    'thin': 'Fina',
    'normal': 'Normal',
    'thick': 'Gruesa',
    'selected': 'Seleccionado',
    'note.text': 'Texto de la nota',
    'giveBall': 'Dar balón',
    'deselect': 'Deseleccionar',
    'remove': 'Eliminar',
    'editIndividuals': 'Editar individuales',
    'regroupPack': 'Reagrupar pack',
    'gainline.status': 'En la línea de ventaja',
    'plays.opposition': 'Jugadas y oposición',
    'phase.purpose': 'Objetivo de la fase',
    'decision.cue': 'Clave de decisión',
    'coaching.points': 'Puntos de coaching',
    'common.mistakes': 'Errores comunes',
    'empty.kicker': 'Empieza aquí',
    'empty.title': 'Construye tu primer estado del tablero',
    'empty.copy': 'Añade jugadores desde la barra inferior, coloca el balón y luego elige una herramienta para dibujar el movimiento.',
    'toolbar.addAttack.desktop': '+ ATAQUE',
    'toolbar.addAttack.mobile': '+ATQ',
    'toolbar.addDefence.desktop': '+ DEFENSA',
    'toolbar.addDefence.mobile': '+DEF',
    'toolbar.ball': 'BALÓN',
    'toolbar.run': 'CARRERA',
    'toolbar.pass': 'PASE',
    'toolbar.kick': 'PATADA',
    'toolbar.move': 'MOVER',
    'toolbar.move.mobile': 'MOV',
    'toolbar.erase': 'BORRAR',
    'toolbar.tele': 'TELÉ',
    'toolbar.circle': 'CÍRCULO',
    'toolbar.box': 'CAJA',
    'toolbar.arrow': 'FLECHA',
    'toolbar.note': 'NOTA',
    'toolbar.clear': 'LIMPIAR',
    'toolbar.gainline': 'LÍNEA DE VENTAJA',
    'toolbar.ghostPrev': 'FANTASMA PREV.',
    'player.summary.copy': 'Un clic añade el siguiente jugador. Usa ▼ para elegir un número específico.',
    'picker.attackNumbers': 'Números de ataque',
    'picker.defenceNumbers': 'Números de defensa',
    'palette.notPlaced': 'Sin colocar',
    'palette.loose': 'Suelto',
    'palette.attack': 'ataque',
    'palette.defence': 'defensa',
    'status.ball.off': 'Balón: fuera del tablero',
    'status.ball.loose': 'Balón: suelto',
    'more.phase': 'FASE',
    'more.move': 'MOV',
    'more.gainline': 'VENTAJA',
    'more.notes': 'NOTAS',
    'more.clear': 'LIMPIAR',
    'more.fitPitch': 'AJUSTAR CAMPO',
    'more.editingView': 'VISTA DE EDICIÓN',
    'mode.move': 'Mover',
    'mode.run': 'Carrera',
    'mode.pass': 'Pase',
    'mode.kick': 'Patada',
    'mode.erase': 'Borrar',
    'mode.box': 'Resalte de caja',
    'mode.note': 'Nota',
    'mode.arrow': 'Flecha',
    'mode.zone': 'Resalte circular',
    'mode.ellipse': 'Resalte circular',
    'mode.tele': 'Telestrador',
    'tour.skip': 'Saltar tour',
    'tour.counter': 'Paso {current} de {total}',
    'dock.back': 'Volver',
      'dock.duplicateMove': 'Duplicar movimiento',
      'dock.deleteMove': 'Borrar movimiento',
      'dock.addMove': 'Añadir movimiento',
      'dock.previewMove': 'Vista previa del movimiento',
      'dock.playPhase': 'Reproducir fase',
  };
  dictionaries.fr = {
    ...dictionaries.en,
    'brand.sub': 'Tableau tactique',
    'language.change': 'Changer de langue',
    'board.name': 'Nom du tableau',
    'board.placeholder': 'Nom du lancement...',
    'play.play': 'Lecture',
    'play.pause': 'Pause',
    'play.resume': 'Reprendre',
    'play.playAll': 'Tout lire',
    'play.playFromHere': 'Lire à partir d’ici',
    'play.playPhase': 'Lire la phase',
    'play.previewMove': 'Prévisualiser le mouvement',
    'play.stop': 'Arrêter',
    'save': 'Enregistrer',
    'export.pdf': 'Exporter PDF',
    'export.json': 'Exporter JSON',
    'import': 'Importer',
    'menu': 'Menu',
    'coaching.notes': 'Notes de coaching',
    'context.panel': 'Panneau de contexte',
    'arrow.style': 'Style de flèche',
    'shape.style': 'Style de forme',
    'style.chooseDefault': 'Choisissez le style par défaut avant de dessiner.',
    'lineStyle': 'Style de ligne',
    'weight': 'Poids',
    'thickness': 'Épaisseur',
    'solid': 'Pleine',
    'dashed': 'Pointillée',
    'thin': 'Fine',
    'normal': 'Normale',
    'thick': 'Épaisse',
    'selected': 'Sélectionné',
    'note.text': 'Texte de la note',
    'giveBall': 'Donner le ballon',
    'deselect': 'Désélectionner',
    'remove': 'Supprimer',
    'editIndividuals': 'Éditer individuellement',
    'regroupPack': 'Regrouper le pack',
    'gainline.status': 'Sur la ligne d’avantage',
    'plays.opposition': 'Lancements et opposition',
    'phase.purpose': 'Objectif de la phase',
    'decision.cue': 'Indice de décision',
    'coaching.points': 'Points de coaching',
    'common.mistakes': 'Erreurs fréquentes',
    'empty.kicker': 'Commencer ici',
    'empty.title': 'Construisez votre premier état de tableau',
    'empty.copy': 'Ajoutez des joueurs depuis la barre du bas, placez le ballon puis choisissez un outil pour dessiner le mouvement.',
    'toolbar.addAttack.desktop': '+ ATTAQUE',
    'toolbar.addAttack.mobile': '+ATT',
    'toolbar.addDefence.desktop': '+ DÉFENSE',
    'toolbar.addDefence.mobile': '+DEF',
    'toolbar.ball': 'BALLON',
    'toolbar.run': 'COURSE',
    'toolbar.pass': 'PASSE',
    'toolbar.kick': 'JEU AU PIED',
    'toolbar.move': 'DÉPLACER',
    'toolbar.move.mobile': 'DEP',
    'toolbar.erase': 'EFFACER',
    'toolbar.tele': 'TÉLÉ',
    'toolbar.circle': 'CERCLE',
    'toolbar.box': 'BOÎTE',
    'toolbar.arrow': 'FLÈCHE',
    'toolbar.note': 'NOTE',
    'toolbar.clear': 'VIDER',
    'toolbar.gainline': 'LIGNE D’AVANTAGE',
    'toolbar.ghostPrev': 'FANTÔME PRÉC.',
    'player.summary.copy': 'Un clic simple ajoute le joueur suivant. Utilisez ▼ pour choisir un numéro précis.',
    'picker.attackNumbers': 'Numéros d’attaque',
    'picker.defenceNumbers': 'Numéros de défense',
    'palette.notPlaced': 'Non placé',
    'palette.loose': 'Libre',
    'palette.attack': 'attaque',
    'palette.defence': 'défense',
    'status.ball.off': 'Ballon : hors tableau',
    'status.ball.loose': 'Ballon : libre',
    'more.phase': 'PHASE',
    'more.move': 'MVT',
    'more.gainline': 'AVANTAGE',
    'more.notes': 'NOTES',
    'more.clear': 'VIDER',
    'more.fitPitch': 'AJUSTER LE TERRAIN',
    'more.editingView': 'VUE D’ÉDITION',
    'mode.move': 'Déplacer',
    'mode.run': 'Course',
    'mode.pass': 'Passe',
    'mode.kick': 'Jeu au pied',
    'mode.erase': 'Effacer',
    'mode.box': 'Zone en boîte',
    'mode.note': 'Note',
    'mode.arrow': 'Flèche',
    'mode.zone': 'Zone circulaire',
    'mode.ellipse': 'Zone circulaire',
    'mode.tele': 'Téléscripteur',
    'tour.skip': 'Ignorer la visite',
    'tour.counter': 'Étape {current} sur {total}',
    'dock.back': 'Retour',
    'dock.duplicateMove': 'Dupliquer le mouvement',
    'dock.deleteMove': 'Supprimer le mouvement',
    'dock.addMove': 'Ajouter un mouvement',
    'dock.previewMove': 'Prévisualiser le mouvement',
    'dock.playPhase': 'Lire la phase',
  };

  let currentLanguage = 'en';

  function safeGetItem(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }

  function safeSetItem(key, value) {
    try { window.localStorage.setItem(key, value); } catch {}
  }

  function resolveLanguage(code) {
    return LANGUAGES.some(lang => lang.code === code) ? code : 'en';
  }

  function formatMessage(template, params = {}) {
    return String(template).replace(/\{(\w+)\}/g, (_, key) => {
      return Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : `{${key}}`;
    });
  }

  function t(key, params = {}, fallback = '') {
    const fallbackText = dictionaries.en[key] || fallback || key;
    const langDict = dictionaries[currentLanguage] || {};
    const template = langDict[key] || dictionaries.en[key] || fallbackText;
    return formatMessage(template, params);
  }

  function setText(selector, key, params) {
    document.querySelectorAll(selector).forEach((node) => {
      node.textContent = t(key, params);
    });
  }

  function setHtml(selector, key, params) {
    document.querySelectorAll(selector).forEach((node) => {
      node.innerHTML = t(key, params);
    });
  }

  function setAttr(selector, attr, key, params) {
    document.querySelectorAll(selector).forEach((node) => {
      node.setAttribute(attr, t(key, params));
    });
  }

  function buildLanguageMenu() {
    const menu = document.getElementById('languageSwitcherMenu');
    if (!menu) return;
    menu.innerHTML = '';
    LANGUAGES.forEach((lang) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tb-language-option${lang.code === currentLanguage ? ' is-active' : ''}`;
      btn.innerHTML = `<span>${lang.label}</span><span class="tb-language-option-code">${lang.short}</span>`;
      btn.onclick = () => {
        setLanguage(lang.code);
        setLanguageMenuOpen(false);
      };
      menu.appendChild(btn);
    });
  }

  function setLanguageMenuOpen(open) {
    const btn = document.getElementById('languageSwitcherBtn');
    const menu = document.getElementById('languageSwitcherMenu');
    if (!btn || !menu) return;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.hidden = !open;
  }

  function applyStaticTranslations() {
    document.documentElement.lang = currentLanguage;
    const active = LANGUAGES.find((lang) => lang.code === currentLanguage) || LANGUAGES[0];
    const label = document.getElementById('languageSwitcherLabel');
    if (label) label.textContent = active.short;
    setAttr('#languageSwitcherBtn', 'aria-label', 'language.change');
    setAttr('#languageSwitcherBtn', 'title', 'language.change');
    setText('.tb-brand-sub', 'brand.sub');
    setText('.tb-title-label', 'board.name');
    setAttr('#playName', 'placeholder', 'board.placeholder');
    setAttr('.seq-bar', 'aria-label', 'sequence.controls');
    setAttr('.tb-history-controls', 'aria-label', 'history.controls');
    setText('.tb-portal', 'portal');
    setText('#autosaveStatus', `autosave.${document.getElementById('autosaveStatus')?.dataset.state || 'saved'}`);
    setText('#mobileSaveBtn', 'save');
    setText('button[onclick="exportPDF()"]', 'export.pdf');
    setText('button[onclick="exportCurrentPlay()"]', 'export.json');
    setText('button[onclick="triggerImportPlay()"]', 'import');
    setText('#mobileBoardMenuBtn', 'menu');
    setText('.tb-recovery-prompt__kicker', 'recovery.kicker');
    setText('#recoveryDraftTitle', 'recovery.title');
    setText('#recoveryDraftMessage', 'recovery.message');
    setText('#recoveryDraftRestoreBtn', 'restore');
    setText('#recoveryDraftDiscardBtn', 'discard');
    setText('#recoveryDraftLaterBtn', 'notNow');
    setAttr('.mobile-board-menu-sheet', 'aria-label', 'board.actions');
    setText('.mobile-board-menu-kicker', 'board.menu');
    setText('label[for="mobilePlayNameInput"]', 'board.name');
    setAttr('#mobilePlayNameInput', 'placeholder', 'board.placeholder');
    setAttr('.mobile-notes-sheet', 'aria-label', 'coaching.notes');
    setText('.mobile-notes-sheet-head .mobile-board-menu-kicker', 'coaching.notes');
    setAttr('#smartPanel', 'aria-label', 'context.panel');
    setText('.sp-default-copy', 'default.copy');
    setText('.sp-default-tip strong:nth-of-type(1)', 'default.tip.mode');
    setText('.sp-default-tip strong:nth-of-type(2)', 'default.tip.tip');
    setText('.sp-default-tip strong:nth-of-type(3)', 'default.tip.action');
    setText('#spKickStep1 .sp-kick-label', 'kick.step1');
    setText('#spKickStep2 .sp-kick-label', 'kick.step2');
    setText('label[for="annotationText"]', 'annotation.text');
    setAttr('#annotationText', 'placeholder', 'annotation.placeholder');
    setText('#spArrowToolCard .sp-sel-label', 'arrow.style');
    setText('#spShapeToolCard .sp-sel-label', 'shape.style');
    setText('#spArrowColorPicker .sp-field-label', 'color');
    setText('#spShapeColorPicker .sp-field-label', 'color');
    setText('#selInfo .sp-sel-label', 'selected');
    setText('#selEditLabel', 'note.text');
    setAttr('#selNoteInput', 'placeholder', 'note.placeholder');
    setText('#floatingSelectionToolbar .floating-selection-toolbar-kicker', 'selected');
    setText('#floatingToolbarColorGroup .floating-selection-toolbar-group-label', 'color');
    setText('#floatingToolbarOpacityLabel', 'fill');
    setText('#emptyState .empty-state-kicker', 'empty.kicker');
    setText('#emptyState .empty-state-title', 'empty.title');
    setText('#emptyState .empty-state-copy', 'empty.copy');
    setAttr('#tourTooltip', 'aria-label', 'tour.aria');
    setText('#tourSkip', 'tour.skip');
    buildLanguageMenu();
  }

  function syncResponsiveLabels() {
    document.querySelectorAll('[data-i18n-label-desktop]').forEach((node) => {
      node.setAttribute('data-label-desktop', t(node.getAttribute('data-i18n-label-desktop')));
      node.setAttribute('data-label-mobile', t(node.getAttribute('data-i18n-label-mobile')));
    });
  }

  function setLanguage(code, { persist = true } = {}) {
    currentLanguage = resolveLanguage(code);
    if (persist) safeSetItem(STORAGE_KEY, currentLanguage);
    applyStaticTranslations();
    syncResponsiveLabels();
    window.dispatchEvent(new CustomEvent('animator-languagechange', { detail: { language: currentLanguage } }));
  }

  function init() {
    currentLanguage = resolveLanguage(safeGetItem(STORAGE_KEY) || 'en');
    const btn = document.getElementById('languageSwitcherBtn');
    const menu = document.getElementById('languageSwitcherMenu');
    if (btn && menu) {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        setLanguageMenuOpen(menu.hidden);
      });
      document.addEventListener('pointerdown', (event) => {
        if (!menu.hidden && !document.getElementById('languageSwitcher')?.contains(event.target)) {
          setLanguageMenuOpen(false);
        }
      });
    }
    setLanguage(currentLanguage, { persist: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  return {
    t,
    setLanguage,
    getLanguage: () => currentLanguage,
    applyStaticTranslations,
    syncResponsiveLabels,
    languages: LANGUAGES,
  };
})();
