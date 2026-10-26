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
    if (mode === 'boggle') return 'Boggle';
    if (mode === 'sloggle') return 'Sloggle (Slow Boggle)';
    if (mode === 'topup') return 'Top Up';
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
    if (mode === 'boggle') {
      return 'Boggle uses three timed 5x5 word-path boards with cumulative scoring.';
    }
    if (mode === 'sloggle') {
      return 'Sloggle is Slow Boggle: three 5-minute 5x5 word-path boards with cumulative scoring and its own high scores.';
    }
    if (mode === 'topup') {
      return 'Top Up mode is active: click completed 5-letter words to clear them. Each 3- or 4-letter path and each 5-letter word scores once per game; reverse spellings count as the same 5-letter word.';
    }
    return 'Classic mode is active: standard WordSquare rules and scoring.';
  };

  const getScheduleDebugInfo = () => {
    const now = new Date();
    const utcDate = now.toISOString().slice(0, 10);
    const scheduleV3CutoverMs = Date.UTC(2026, 9, 26, 0, 0, 0); // 2026-10-26
    const scheduleV2CutoverMs = Date.UTC(2026, 8, 17, 0, 0, 0); // 2026-09-17

    if (now.getTime() >= scheduleV3CutoverMs) {
      const isoWeekday = ((now.getUTCDay() + 6) % 7) + 1; // 1 = Monday ... 7 = Sunday
      const v3Modes = { 1: 'lookahead', 2: 'bomb', 3: 'boggle', 4: 'scrabble', 5: 'topup', 6: 'tetris', 7: 'sloggle' };

      return { utcDate, daysSinceEpoch: null, cycleDay: isoWeekday, computedMode: v3Modes[isoWeekday] };
    }

    if (now.getTime() >= scheduleV2CutoverMs) {
      const isoWeekday = ((now.getUTCDay() + 6) % 7) + 1; // 1 = Monday ... 7 = Sunday
      let computedMode = 'classic';
      if (isoWeekday === 3) computedMode = 'bomb';
      else if (isoWeekday === 4) computedMode = 'scrabble';
      else if (isoWeekday === 2) computedMode = 'lookahead';
      else if (isoWeekday === 5) computedMode = 'topup';
      else if (isoWeekday === 6) computedMode = 'tetris';
      else if (isoWeekday === 7) computedMode = 'boggle';

      return { utcDate, daysSinceEpoch: null, cycleDay: isoWeekday, computedMode };
    }

    const epochUtcMs = Date.UTC(2026, 4, 21, 0, 0, 0);
    const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0);
    const daysSinceEpoch = Math.floor((todayUtcMs - epochUtcMs) / 86400000);
    const cycleDay = ((daysSinceEpoch % 7) + 7) % 7;

    let computedMode = 'classic';
    if (daysSinceEpoch > 0 && cycleDay === 0) computedMode = 'bomb';
    else if (daysSinceEpoch > 0 && cycleDay === 1) computedMode = 'scrabble';
    else if (daysSinceEpoch > 0 && cycleDay === 2) computedMode = 'lookahead';
    else if (daysSinceEpoch > 0 && cycleDay === 3) computedMode = 'topup';
    else if (daysSinceEpoch > 0 && cycleDay === 4) computedMode = 'tetris';
    else if (daysSinceEpoch > 0 && cycleDay === 6) computedMode = 'boggle';

    return {
      utcDate,
      daysSinceEpoch,
      cycleDay,
      computedMode,
    };
  };

  const renderHelpContent = () => {
    if (!helpContent) return;

    const configuredVersion = window.GAME_CONFIG && typeof window.GAME_CONFIG.appVersion === 'string'
      ? window.GAME_CONFIG.appVersion
      : '';
    const helpVersion = configuredVersion !== '' ? configuredVersion : 'unknown';
    const helpChanges = [
      '1.5.1 gives the Yesterday\'s Champion screen a quieter, more polished look with understated buttons.',
      '1.5.0 marks first goes on the high score tables: a 1 marker for every score that was a player\'s first attempt of the day at that game, and a trophy for the best first-go score. First goes are tracked per device (clearing browser data resets it), and a name that already has a score for that game today is never marked again.',
      '1.4.1 makes Yesterday\'s Champion wait for you: view yesterday\'s high score table (scores only), close it, then press the arrow to play today\'s game.',
      '1.4.0 adds Sloggle (Slow Boggle, 5 minutes per round) on Sundays with its own high scores. Boggle moves to Wednesday, Classic is retired, Lookahead moves to Monday and Bomb to Tuesday. The new schedule starts on 2026-10-26.',
      '1.3.10 reads the on-screen keyboard from the outer WordPress page (the game runs inside an iframe) and shows the debug strip when ?debug=1 is on either address.',
      '1.3.9 adds a diagnostic strip for the TRY IT panel (add ?debug=1 to the page address).',
      '1.3.8 adds a fallback so the TRY IT panel is pinned above the keyboard whenever scrolling cannot reveal it.',
      '1.3.7 makes the TRY IT panel reliable when reopened and on iPad, and the help screen now shows the live app version.',
      '1.3.6 improves the TRY IT panel so it stays visible above the on-screen keyboard.',
      '1.3.4 marks MFD (My First Dictionary) as retired - it is no longer part of the daily rotation and is not played.',
      '1.3.3 updates Tetris timing documentation and the application version.',
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

      <h3>Daily Schedule (Mon-Sun, from 2026-10-26)</h3>
      <ul>
        <li>Monday: Lookahead</li>
        <li>Tuesday: Bomb</li>
        <li>Wednesday: Boggle</li>
        <li>Thursday: Scrabble</li>
        <li>Friday: Top Up</li>
        <li>Saturday: Tetris</li>
        <li>Sunday: Sloggle (Slow Boggle, 5 minutes per round)</li>
      </ul>

      <h3>Scoring Notes</h3>
      <ul>
        <li>Classic/Bomb/Lookahead: 3-letter = 1, 4-letter = 5, 5-letter = 20.</li>
        <li>Scrabble: only 5-letter words score; 3-letter and 4-letter words do not score.</li>
        <li>Scrabble: wildcard tiles score 0; DL squares double letter value and DW squares double whole-word value.</li>
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
        <li>Special squares are daily-randomized: 50% chance of 4 DL, or 50% chance of 2 DL + 1 DW.</li>
        <li>If the same canonical word appears in multiple paths, the highest scoring path is used.</li>
      </ul>

      <h3>MFD Notes (Retired)</h3>
      <ul>
        <li>MFD is retired: it no longer appears in the daily rotation and is not played.</li>
        <li>MFD previously occupied Day 3; that slot is now Top Up.</li>
        <li>While active it played the same as Classic mode, with dictionary scope limited to MFD-tagged words.</li>
        <li>It remains reachable only through the developer <code>?mode=mfd</code> override.</li>
      </ul>

      <h3>Tetris Notes</h3>
      <ul>
        <li>Click a DROP slot above the grid to let the current letter fall into that column.</li>
        <li>4-letter and 5-letter words clear. They can run horizontally, vertically, or diagonally.</li>
        <li>Turn timer starts at 10.0s and drops by 0.15s per round to a 4.0s minimum.</li>
        <li>You start with 3 bombs. Click a filled tile to blast it and let the letters above fall down.</li>
        <li>Survival reward: +1 bomb every 45 seconds survived, up to a cap of 3 bombs.</li>
        <li>Bomb top-up cue: bright strip blast, icon flash/pop, expanding rings, and +1 BOMB READY text near the bomb bar.</li>
        <li>If a column is full, its DROP slot greys out. The game ends when no legal drops remain.</li>
      </ul>

      <h3>Boggle Notes</h3>
      <ul>
        <li>Boggle is played over three two-minute rounds on fixed daily 5x5 boards.</li>
        <li>Words use adjacent horizontal, vertical, or diagonal tiles without reusing a tile.</li>
        <li>Words must have at least four letters. Scores are 1 / 2 / 3 / 5 / 11 for lengths 4 / 5 / 6 / 7 / 8+.</li>
        <li>Every player receives the same three boards for the UTC day; Play Again repeats them.</li>
        <li>On desktop, green marks the path start and gold marks the final clicked tile. Press Escape on desktop, press and hold any board tile on touch devices, or use X to clear a path.</li>
        <li>Invalid words show red outlines; already-found words show yellow outlines. Click any tile to clear a rejected path.</li>
      </ul>

      <h3>Top Up Notes</h3>
      <ul>
        <li>Survival mode: keep playing by clearing space. 5-letter words are your lifeline — click them to score 20 pts and delete those tiles.</li>
        <li>3-letter and 4-letter words auto-score (1 / 5 pts) but never clear — they pile up as permanent obstacles on the board.</li>
        <li>Game ends when the board is completely full and no 5-letter word can be cleared.</li>
      </ul>

      <h3>Scheduler Debug</h3>
      <ul>
        <li>UTC Date: ${scheduleDebug.utcDate}</li>
        <li>Days Since Epoch (2026-05-21): ${scheduleDebug.daysSinceEpoch ?? 'n/a (post-cutover schedule)'}</li>
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