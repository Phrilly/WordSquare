function showLeaderboardFromBest() {
  document.getElementById('best-board-modal').classList.remove('active');
  document.getElementById('leaderboard-modal').classList.add('active');
  if (typeof topBarEl !== 'undefined' && topBarEl) topBarEl.style.opacity = '0';
}

function getModeAwareLeaderboardTitle() {
  if (typeof getLeaderboardTitleText === 'function') {
    return getLeaderboardTitleText();
  }
  return "TODAY'S HIGH SCORES";
}

function getSubmittedWordEvents() {
  const mode = typeof getCurrentGameMode === 'function' ? getCurrentGameMode() : 'classic';
  if (mode === 'topup' && typeof topUpScoreEvents !== 'undefined') return topUpScoreEvents;
  if (mode === 'tetris' && typeof tetrisScoreEvents !== 'undefined') return tetrisScoreEvents;
  if (mode === 'scrabble' && typeof scrabbleScoreEvents !== 'undefined') return scrabbleScoreEvents;
  if (typeof getCurrentGridScoreEvents === 'function') return getCurrentGridScoreEvents();
  return [];
}

function showBoardViewer(titleText, score, initials, gridChars, themeClass, wordEvents = []) {
  if (!gridChars || gridChars.length !== 25) return;

  document.getElementById('leaderboard-modal').classList.remove('active');
  if (typeof topBarEl !== 'undefined' && topBarEl) topBarEl.style.opacity = '0';

  if (typeof setBoardViewerTheme === 'function') setBoardViewerTheme(themeClass);
  
  const boardViewerTitleEl = document.getElementById('board-viewer-title');
  if (boardViewerTitleEl) boardViewerTitleEl.innerHTML = titleText;
  
  const scoreEl = document.getElementById('best-board-score');
  if (scoreEl) scoreEl.innerText = score;
  
  const initialsEl = document.getElementById('best-board-initials');
  if (initialsEl) initialsEl.innerText = initials;

  if (typeof renderScoreBreakdown === 'function') {
    renderScoreBreakdown(wordEvents, 'best-board-score-breakdown');
  }

  const bg = document.getElementById('best-grid');
  if (bg) {
      bg.innerHTML = '';
      let chars = typeof gridChars === 'string' ? gridChars.split('') : gridChars;
      let normalizedChars = chars.map(c => c.toUpperCase());
    
      for (let i = 0; i < 25; i++) {
        let c = document.createElement('div');
        c.className = 'grid-cell';
        
        if (normalizedChars[i] !== '-') {
            if (chars[i] && chars[i] !== chars[i].toUpperCase()) {
              c.classList.add('is-wildcard');
            }
            c.innerText = normalizedChars[i];
        } else {
            c.classList.add('is-empty');
        }
        bg.appendChild(c);
      }
    
      if (typeof findValidWordsLocalArray === 'function') {
          const bValid = findValidWordsLocalArray(normalizedChars);
          const mode = typeof getCurrentGameMode === 'function' ? getCurrentGameMode() : 'classic';

          // Scrabble only ever scores 5-letter words, so the reconstructed
          // highlighting and word lists must ignore shorter matches. Without
          // this the board viewer paints and lists 3- and 4-letter words that
          // never earned a single point.
          const scoringWords = (mode === 'scrabble')
              ? bValid.filter(word => word.length === 5)
              : bValid;

          const groupedData = buildGroupedWordData(scoringWords);
        
          applyColorsToSpecificGrid(groupedData.rawScoringWords, normalizedChars, bg);
          if (typeof renderWordListsForBoard === 'function') renderWordListsForBoard(groupedData);
      }
  }
  
  const bestBoardModal = document.getElementById('best-board-modal');
  if (bestBoardModal) bestBoardModal.classList.add('active');
}

async function submitHighscore() {
  const initialsInput = document.getElementById('hidden-initials');
  let initials = initialsInput ? initialsInput.value.trim().toUpperCase() : "---";
  if (initials.length === 0) initials = "---";

  let isNewTopScore = false;
  let gridString = "";
  
  if (typeof cells !== 'undefined') {
      for (let i = 0; i < 25; i++) {
        let char = cells[i];
        if (!char || char === '') char = '-';
        if (typeof wildcardState !== 'undefined' && wildcardState[i] && char !== '-') {
            gridString += char.toLowerCase();
        } else {
            gridString += char;
        }
      }
  }

  try {
    const requestBody = { 
        action: 'save_score', 
        initials: initials, 
        mode: typeof getCurrentGameMode === 'function' ? getCurrentGameMode() : 'classic',
        session_id: typeof sessionId !== 'undefined' ? sessionId : '',
        score: typeof currentScore !== 'undefined' ? currentScore : 0, 
        grid: gridString,
        word_events: getSubmittedWordEvents()
    };
    
    // NOTE: the DL/DW layout is deliberately not sent. validate.php derives it
    // from the UTC daily seed so a client cannot award itself multipliers.
    
    const res = await fetch('validate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    const data = await res.json();
    if (!res.ok || data.success !== true) {
      throw new Error(data.error || `Score submission failed with status ${res.status}.`);
    }

    isNewTopScore = data.is_top_score === true;

    // The server owns Scrabble scoring. Keep the completed-game UI in sync with
    // the exact score and events that were persisted, even if a stale browser
    // asset calculated a different value locally.
    if (requestBody.mode === 'scrabble') {
      if (Number.isInteger(data.verified_score)) {
        currentScore = data.verified_score;
        if (scoreEl) scoreEl.innerText = currentScore;
      }
      if (Array.isArray(data.word_events)) {
        scrabbleScoreEvents = data.word_events;
      }
    }
  } catch (e) {
    console.error("Error saving score", e);
    alert(e instanceof Error ? e.message : 'Unable to save your score. Please try again.');
    return;
  }

  const highscoreEntryModal = document.getElementById('highscore-entry-modal');
  if (highscoreEntryModal) highscoreEntryModal.classList.remove('active');

  const lbTitle = document.getElementById('leaderboard-title');
  if (lbTitle) {
      if (isNewTopScore) {
        lbTitle.innerText = "🏆 NEW DAILY HIGH SCORE! 🏆";
        lbTitle.style.color = "#FFD700";
        if (typeof triggerExplosion === 'function') triggerExplosion(true);
      } else {
        lbTitle.innerText = getModeAwareLeaderboardTitle();
        lbTitle.style.color = "var(--highlight)";
      }
  }

  loadLeaderboard();
}

function skipToLeaderboard() {
  const highscoreEntryModal = document.getElementById('highscore-entry-modal');
  if (highscoreEntryModal) highscoreEntryModal.classList.remove('active');
  const lbTitle = document.getElementById('leaderboard-title');
  if (lbTitle) {
      lbTitle.innerText = getModeAwareLeaderboardTitle();
      lbTitle.style.color = "var(--highlight)";
  }
  loadLeaderboard();
}

async function loadLeaderboard() {
  const listEl = document.getElementById('leaderboard-list');
  if (!listEl) return;
  
  listEl.innerHTML = '<li style="border:none; justify-content:center;">Loading...</li>';
  const leaderboardModal = document.getElementById('leaderboard-modal');
  if (leaderboardModal) leaderboardModal.classList.add('active');
  if (typeof topBarEl !== 'undefined' && topBarEl) topBarEl.style.opacity = '0';

  try {
    const res = await fetch('validate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_highscores',
        mode: typeof getCurrentGameMode === 'function' ? getCurrentGameMode() : 'classic'
      })
    });
    const data = await res.json();

    listEl.innerHTML = '';
    const viewAiBtn = document.getElementById('view-ai-btn');
    if (viewAiBtn) viewAiBtn.style.display = 'none';

    if (data.highscores && data.highscores.length > 0) {
      const bestDailyData = data.highscores[0];

      const viewWinningBtn = document.getElementById('view-winning-btn');
      if (bestDailyData && bestDailyData.grid && bestDailyData.grid.length === 25) {
        if (viewWinningBtn) viewWinningBtn.style.display = 'block';
        if (typeof runAIOptimizerOnBestGrid === 'function') runAIOptimizerOnBestGrid(bestDailyData.grid);
      } else {
        if (viewWinningBtn) viewWinningBtn.style.display = 'none';
      }

      data.highscores.forEach((entry, index) => {
        let initials = (entry.initials || '---').padEnd(3, '-').substring(0, 3);
        let initialsHtml = '';
        for (let i = 0; i < 3; i++) {
          initialsHtml += `<div class="lb-initial-tile">${initials[i]}</div>`;
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
            <div class="lb-score-tile">${entry.score}</div>
          </div>
        `;
        li.addEventListener('click', () => {
          showBoardViewer(
            index === 0 ? "👑 #1 BOARD 👑" : `BOARD BY ${initials}`,
            entry.score,
            initials,
            entry.grid,
            index === 0 ? 'top' : 'default',
            Array.isArray(entry.word_events) ? entry.word_events : []
          );
        });
        listEl.appendChild(li);
      });
    } else {
      const viewWinningBtn = document.getElementById('view-winning-btn');
      if (viewWinningBtn) viewWinningBtn.style.display = 'none';
      listEl.innerHTML = '<li style="border:none; justify-content:center;">No scores today!</li>';
    }
  } catch (e) {
    console.error("Error loading scores", e);
    listEl.innerHTML = '<li style="border:none; justify-content:center;">Error loading leaderboard.</li>';
  }
}