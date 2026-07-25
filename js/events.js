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
      return 'Bomb mode is active: hidden bomb cells burn the current queued letter when triggered.';
    }
    if (mode === 'scrabble') {
      return 'Scrabble mode is active: only 5-letter words score, using letter values and double-letter squares.';
    }
    if (mode === 'lookahead') {
      return 'Lookahead mode is active: you can see additional upcoming queue letters.';
    }
    if (mode === 'tetris') {
      return 'Tetris mode is active: drop letters into columns, clear 4- and 5-letter words, and survive increasing speed.';
    }
    if (mode === 'mfd') {
      return 'MFD mode is active: gameplay is Classic, but only words flagged in the MFD dictionary are valid.';
    }
    return 'Classic mode is active: standard WordSquare rules and scoring.';
  };

  const getScheduleDebugInfo = () => {
    const epochUtcMs = Date.UTC(2026, 4, 21, 0, 0, 0);
    const now = new Date();
    const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0);
    const daysSinceEpoch = Math.floor((todayUtcMs - epochUtcMs) / 86400000);
    const cycleDay = ((daysSinceEpoch % 6) + 6) % 6;

    let computedMode = 'classic';
    if (daysSinceEpoch > 0 && cycleDay === 0) computedMode = 'bomb';
    else if (daysSinceEpoch > 0 && cycleDay === 1) computedMode = 'scrabble';
    else if (daysSinceEpoch > 0 && cycleDay === 2) computedMode = 'lookahead';
    else if (daysSinceEpoch > 0 && cycleDay === 3) computedMode = 'mfd';
    else if (daysSinceEpoch > 0 && cycleDay === 4) computedMode = 'tetris';

    const utcDate = now.toISOString().slice(0, 10);

    return {
      utcDate,
      daysSinceEpoch,
      cycleDay,
      computedMode,
    };
  };

  const renderHelpContent = () => {
    if (!helpContent) return;

    const helpVersion = '1.2.2';
    const helpChanges = [
      '1.2.2 refresh marker for latest Tetris bomb-top-up visibility updates.',
    ];

    const mode = typeof getCurrentGameMode === 'function' ? getCurrentGameMode() : 'classic';
    const modeLabel = getModeLabel(mode);
    const scheduleDebug = getScheduleDebugInfo();
    const computedModeLabel = getModeLabel(scheduleDebug.computedMode);

    helpContent.innerHTML = `
      <h3>Current Mode</h3>
      <p><strong>${modeLabel}</strong></p>
      <p>${getModeRules(mode)}</p>

      <h3>Help Version</h3>
      <ul>
        <li>Help Version: ${helpVersion}</li>
        <li>Change Log: ${helpChanges.join(' ')}</li>
      </ul>

      <h3>Core Rules</h3>
      <ul>
        <li>Fill the 5x5 grid using letters from the current queue/tray system.</li>
        <li>Words are scored from valid rows, columns, and diagonals.</li>
        <li>Letters stay on the board unless removed by a mode mechanic (for example, Tetris clears or bombs).</li>
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
        <li>Classic/Bomb/Lookahead/MFD: 3-letter = 1, 4-letter = 5, 5-letter = 20.</li>
        <li>Scrabble: only 5-letter words score; 3-letter and 4-letter words do not score.</li>
        <li>Scrabble: wildcard tiles score 0; double-letter squares apply on highlighted DL cells.</li>
        <li>Tetris: 4-letter clears = 5 and 5-letter clears = 20, with gravity after clears.</li>
      </ul>

      <h3>Bomb Notes</h3>
      <ul>
        <li>There are 3 hidden bomb cells on the board.</li>
        <li>Clicking a bomb burns the current queued letter instead of placing it.</li>
      </ul>

      <h3>Lookahead Notes</h3>
      <ul>
        <li>Lookahead shows additional upcoming queue letters.</li>
        <li>Scoring is otherwise the same as Classic mode.</li>
      </ul>

      <h3>Scrabble Notes</h3>
      <ul>
        <li>Only 5-letter words are considered for scoring.</li>
        <li>Word score is based on Scrabble letter values across the word path.</li>
        <li>If the same canonical word appears in multiple paths, the highest scoring path is used.</li>
      </ul>

      <h3>MFD Notes</h3>
      <ul>
        <li>MFD plays the same as Classic mode.</li>
        <li>The only difference is dictionary scope: only MFD-tagged words are accepted.</li>
      </ul>

      <h3>Tetris Notes</h3>
      <ul>
        <li>Click a DROP slot above the grid to let the current letter fall into that column.</li>
        <li>4-letter and 5-letter words clear. They can run horizontally, vertically, or diagonally.</li>
        <li>Turn timer starts at 10.0s and drops by 0.2s per round to a 2.8s minimum.</li>
        <li>You start with 3 bombs. Click a filled tile to blast it and let the letters above fall down.</li>
        <li>Survival reward: +1 bomb every 60 seconds survived, up to a cap of 3 bombs.</li>
        <li>If a column is full, its DROP slot greys out. The game ends when no legal drops remain.</li>
      </ul>

      <h3>Scheduler Debug</h3>
      <ul>
        <li>UTC Date: ${scheduleDebug.utcDate}</li>
        <li>Days Since Epoch (2026-05-21): ${scheduleDebug.daysSinceEpoch}</li>
        <li>Cycle Day: ${scheduleDebug.cycleDay}</li>
        <li>Computed Mode: ${computedModeLabel}</li>
        <li>Loaded Mode: ${modeLabel}</li>
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