'use strict';

function showLeaderboardFromBest() {
  const bestBoardModal = document.getElementById('best-board-modal');
  const leaderboardModal = DomRefs.leaderboardModal;

  if (bestBoardModal) bestBoardModal.classList.remove('active');
  else console.warn('showLeaderboardFromBest: #best-board-modal not found.');

  if (leaderboardModal) leaderboardModal.classList.add('active');
  else console.error('showLeaderboardFromBest: leaderboard modal not found.');

  if (DomRefs.topBarEl) DomRefs.topBarEl.style.opacity = '0';
}

function showBoardViewer(titleText, score, initials, gridChars, themeClass) {
  if (!gridChars || gridChars.length !== GameState.CELL_COUNT) {
    console.error(`showBoardViewer: gridChars invalid or wrong length (${gridChars ? gridChars.length : 'null'}).`);
    return;
  }
  if (typeof titleText !== 'string') {
    console.error('showBoardViewer: titleText must be a string.');
    return;
  }

  const leaderboardModal = DomRefs.leaderboardModal;
  if (leaderboardModal) leaderboardModal.classList.remove('active');
  if (DomRefs.topBarEl) DomRefs.topBarEl.style.opacity = '0';

  if (typeof setBoardViewerTheme === 'function') setBoardViewerTheme(themeClass);

  const boardViewerTitleEl = document.getElementById('board-viewer-title');
  if (boardViewerTitleEl) boardViewerTitleEl.innerHTML = titleText;

  const scoreEl = document.getElementById('best-board-score');
  if (scoreEl) scoreEl.innerText = String(score);

  const initialsEl = document.getElementById('best-board-initials');
  if (initialsEl) initialsEl.innerText = escapeHtml(String(initials));

  const bg = document.getElementById('best-grid');
  if (!bg) {
    console.error('showBoardViewer: #best-grid element not found.');
    return;
  }

  try {
    bg.innerHTML = '';
    const chars = typeof gridChars === 'string' ? gridChars.split('') : gridChars;
    const normalizedChars = chars.map(c => (typeof c === 'string' ? c.toUpperCase() : '-'));
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < GameState.CELL_COUNT; i++) {
      const c = document.createElement('div');
      c.className = 'grid-cell';

      if (normalizedChars[i] !== '-') {
        if (chars[i] && typeof chars[i] === 'string' && chars[i] !== chars[i].toUpperCase()) {
          c.classList.add('is-wildcard');
        }
        c.innerText = normalizedChars[i];
      } else {
        c.classList.add('is-empty');
      }
      fragment.appendChild(c);
    }
    bg.appendChild(fragment);

    if (typeof findValidWordsLocalArray === 'function') {
      const bValid = findValidWordsLocalArray(normalizedChars);
      const groupedData = buildGroupedWordData(bValid);

      if (typeof applyColorsToSpecificGrid === 'function') {
        applyColorsToSpecificGrid(groupedData.rawScoringWords, normalizedChars, bg);
      }
      if (typeof renderWordListsForBoard === 'function') renderWordListsForBoard(groupedData);
    }
  } catch (err) {
    console.error('showBoardViewer: failed to render board grid.', err);
    return;
  }

  const bestBoardModal = document.getElementById('best-board-modal');
  if (bestBoardModal) bestBoardModal.classList.add('active');
}

function sanitizeInitials(raw) {
  if (typeof raw !== 'string') return '---';
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  return cleaned.length > 0 ? cleaned : '---';
}

async function submitHighscore() {
  const initials = sanitizeInitials(DomRefs.initialsInput ? DomRefs.initialsInput.value : '');

  let gridString;
  try {
    gridString = buildCurrentGridString();
  } catch (err) {
    console.error('submitHighscore: failed to build grid string, aborting submission.', err);
    gridString = '-'.repeat(GameState.CELL_COUNT);
  }

  let isNewTopScore = false;

  try {
    const res = await fetchWithTimeout('validate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_score',
        initials,
        score: GameState.getCurrentScore(),
        grid: gridString
      })
    }, 8000);

    if (!res.ok) {
      throw new Error(`Server responded with status ${res.status}.`);
    }

    const data = await res.json();
    isNewTopScore = Boolean(data && data.is_top_score);
  } catch (err) {
    console.error('submitHighscore: error saving score.', err);
  }

  if (DomRefs.highscoreEntryModal) DomRefs.highscoreEntryModal.classList.remove('active');

  const lbTitle = document.getElementById('leaderboard-title');
  if (lbTitle) {
    if (isNewTopScore) {
      lbTitle.innerText = '🏆 NEW DAILY HIGH SCORE! 🏆';
      lbTitle.style.color = '#FFD700';
      if (typeof triggerExplosion === 'function') triggerExplosion(true);
    } else {
      lbTitle.innerText = "TODAY'S HIGH SCORES";
      lbTitle.style.color = 'var(--highlight)';
    }
  }

  try {
    await loadLeaderboard();
  } catch (err) {
    console.error('submitHighscore: failed to refresh leaderboard.', err);
  }
}

function skipToLeaderboard() {
  if (DomRefs.highscoreEntryModal) DomRefs.highscoreEntryModal.classList.remove('active');

  const lbTitle = document.getElementById('leaderboard-title');
  if (lbTitle) {
    lbTitle.innerText = "TODAY'S HIGH SCORES";
    lbTitle.style.color = 'var(--highlight)';
  }

  loadLeaderboard().catch(err => console.error('skipToLeaderboard: failed to load leaderboard.', err));
}

async function loadLeaderboard() {
  const listEl = document.getElementById('leaderboard-list');
  if (!listEl) {
    console.error('loadLeaderboard: #leaderboard-list not found.');
    return;
  }

  listEl.innerHTML = '<li style="border:none; justify-content:center;">Loading...</li>';
  if (DomRefs.leaderboardModal) DomRefs.leaderboardModal.classList.add('active');
  if (DomRefs.topBarEl) DomRefs.topBarEl.style.opacity = '0';

  try {
    const res = await fetchWithTimeout('validate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_highscores' })
    }, 8000);

    if (!res.ok) {
      throw new Error(`Server responded with status ${res.status}.`);
    }

    const data = await res.json();
    listEl.innerHTML = '';

    const viewAiBtn = document.getElementById('view-ai-btn');
    if (viewAiBtn) viewAiBtn.style.display = 'none';

    const highscores = Array.isArray(data && data.highscores) ? data.highscores : [];

    if (highscores.length > 0) {
      const bestDailyData = highscores[0];
      GameState.setBestDailyData(bestDailyData);

      const viewWinningBtn = document.getElementById('view-winning-btn');
      if (bestDailyData && typeof bestDailyData.grid === 'string' && bestDailyData.grid.length === GameState.CELL_COUNT) {
        if (viewWinningBtn) viewWinningBtn.style.display = 'block';
        if (typeof runAIOptimizerOnBestGrid === 'function') {
          runAIOptimizerOnBestGrid(bestDailyData.grid).catch(err =>
            console.error('loadLeaderboard: AI optimizer failed.', err)
          );
        }
      } else if (viewWinningBtn) {
        viewWinningBtn.style.display = 'none';
      }

      const fragment = document.createDocumentFragment();

      highscores.forEach((entry, index) => {
        const safeInitials = sanitizeInitials(entry && entry.initials).padEnd(3, '-').substring(0, 3);
        const safeScore = entry && Number.isFinite(entry.score) ? entry.score : 0;

        let initialsHtml = '';
        for (let i = 0; i < 3; i++) {
          initialsHtml += `<div class="lb-initial-tile">${escapeHtml(safeInitials[i] || '-')}</div>`;
        }

        const li = document.createElement('li');
        li.style.borderBottom = 'none';
        li.style.padding = '0';
        li.innerHTML = `
          <div class="lb-row-container">
            <div style="display:flex; align-items:center;">
              <div class="lb-rank">${index + 1}.</div>
              <div class="lb-initials-group">${initialsHtml}</div>
            </div>
            <div class="lb-score-tile">${escapeHtml(String(safeScore))}</div>
          </div>
        `;

        li.addEventListener('click', () => {
          if (!entry || typeof entry.grid !== 'string' || entry.grid.length !== GameState.CELL_COUNT) {
            console.warn(`loadLeaderboard: entry ${index} has invalid grid, skipping viewer.`);
            return;
          }
          showBoardViewer(
            index === 0 ? '👑 #1 BOARD 👑' : `BOARD BY ${escapeHtml(safeInitials)}`,
            safeScore,
            safeInitials,
            entry.grid,
            index === 0 ? 'top' : 'default'
          );
        });

        fragment.appendChild(li);
      });

      listEl.appendChild(fragment);
    } else {
      const viewWinningBtn = document.getElementById('view-winning-btn');
      if (viewWinningBtn) viewWinningBtn.style.display = 'none';
      listEl.innerHTML = '<li style="border:none; justify-content:center;">No scores today!</li>';
    }
  } catch (err) {
    console.error('loadLeaderboard: failed to load scores.', err);
    listEl.innerHTML = '<li style="border:none; justify-content:center;">Error loading leaderboard.</li>';
  }
}