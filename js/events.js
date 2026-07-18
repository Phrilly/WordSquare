document.addEventListener('DOMContentLoaded', () => {
  // Highscore Entry Modal
  document.getElementById('submit-score-btn')?.addEventListener('click', submitHighscore);
  document.getElementById('skip-to-leaderboard-btn')?.addEventListener('click', skipToLeaderboard);

  // Leaderboard Modal
  document.getElementById('play-again-btn')?.addEventListener('click', initGame);

  // Best Board Modal
  document.getElementById('back-to-leaderboard-btn')?.addEventListener('click', showLeaderboardFromBest);

  // Help Modal
  const openHelpBtns = document.querySelectorAll('[data-help-open="1"]');
  const closeHelpBtn = document.getElementById('close-help-btn');
  const helpModal = document.getElementById('help-modal');
  const helpContent = document.getElementById('help-content');

  const getModeLabel = (mode) => {
    if (mode === 'bomb') return 'Bomb';
    if (mode === 'scrabble') return 'Scrabble';
    if (mode === 'lookahead') return 'Lookahead';
    if (mode === 'tetris') return 'Tetris';
    if (mode === 'mfd') return 'My First Dictionary (MFD)';
    return 'Classic';
  };

  const getModeRules = (mode) => {
    if (mode === 'bomb') {
      return 'Bomb mode is active: avoid unstable placements and plan around bomb interactions.';
    }
    if (mode === 'scrabble') {
      return 'Scrabble mode is active: points come from letter values and special squares.';
    }
    if (mode === 'lookahead') {
      return 'Lookahead mode is active: you can see additional upcoming queue letters.';
    }
    if (mode === 'tetris') {
      return 'Tetris mode is active: drop each queued letter into a column, build 5-letter words to clear them, and use three bombs to blast occupied tiles.';
    }
    if (mode === 'mfd') {
      return 'MFD mode is active: gameplay is Classic, but only words flagged in the MFD dictionary are valid.';
    }
    return 'Classic mode is active: standard WordSquare rules and scoring.';
  };

  const renderHelpContent = () => {
    if (!helpContent) return;

    const mode = typeof getCurrentGameMode === 'function' ? getCurrentGameMode() : 'classic';
    const modeLabel = getModeLabel(mode);

    helpContent.innerHTML = `
      <h3>Current Mode</h3>
      <p><strong>${modeLabel}</strong></p>
      <p>${getModeRules(mode)}</p>

      <h3>Core Rules</h3>
      <ul>
        <li>Fill the 5x5 grid using letters from the current queue/tray system.</li>
        <li>Words are scored from valid rows, columns, and diagonals.</li>
        <li>Placed tiles are locked: inserted tiles cannot be deleted.</li>
      </ul>

      <h3>Daily Schedule (6-Day)</h3>
      <ul>
        <li>Day 0: Bomb</li>
        <li>Day 1: Scrabble</li>
        <li>Day 2: Lookahead</li>
        <li>Day 3: MFD (My First Dictionary)</li>
        <li>Day 4: Tetris</li>
        <li>Day 5: Classic</li>
      </ul>

      <h3>Scoring Notes</h3>
      <ul>
        <li>Classic/Bomb/Lookahead/MFD score with standard WordSquare word scoring.</li>
        <li>Scrabble mode scores by letter values and board modifiers.</li>
        <li>Tetris mode uses live gameplay scoring, then saves a verified final score.</li>
      </ul>

      <h3>MFD Notes</h3>
      <ul>
        <li>MFD plays the same as Classic mode.</li>
        <li>The only difference is dictionary scope: only MFD-tagged words are accepted.</li>
      </ul>

      <h3>Tetris Notes</h3>
      <ul>
        <li>Click a DROP slot above the grid to let the current letter fall into that column.</li>
        <li>Only 5-letter words clear. They can run horizontally, vertically, or diagonally.</li>
        <li>You have 3 bombs. Click a filled tile to blast it and let the letters above fall down.</li>
        <li>If a column is full, its DROP slot greys out. The game ends when no legal drops remain.</li>
      </ul>

      <p class="help-subtle">Full docs: <a href="HELP.md" target="_blank" rel="noopener noreferrer">HELP.md</a> and <a href="HELP_MFD.md" target="_blank" rel="noopener noreferrer">HELP_MFD.md</a>.</p>
    `;
  };

  const openHelp = () => {
    if (!helpModal) return;
    renderHelpContent();
    helpModal.classList.add('active');
  };

  const closeHelp = () => {
    if (!helpModal) return;
    helpModal.classList.remove('active');
  };

  openHelpBtns.forEach((btn) => {
    btn.addEventListener('click', openHelp);
  });
  closeHelpBtn?.addEventListener('click', closeHelp);

  helpModal?.addEventListener('click', (event) => {
    if (event.target === helpModal) {
      closeHelp();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && helpModal?.classList.contains('active')) {
      closeHelp();
    }
  });
});