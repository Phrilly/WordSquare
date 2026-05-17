function hideModalsForBoardView() {
  leaderboardModal.classList.remove('active');
  document.getElementById('best-board-modal').classList.remove('active');
  document.getElementById('return-to-menu-btn').style.display = 'block';
  topBarEl.style.opacity = '1';
  calculateRealTimeScoreLocal();
}

function showLeaderboard() {
  document.getElementById('return-to-menu-btn').style.display = 'none';
  leaderboardModal.classList.add('active');
  topBarEl.style.opacity = '0';
}

function showLeaderboardFromBest() {
  document.getElementById('best-board-modal').classList.remove('active');
  document.getElementById('leaderboard-modal').classList.add('active');
  topBarEl.style.opacity = '0';
}

function showBestBoard() {
  if (!bestDailyData || !bestDailyData.grid || bestDailyData.grid.length !== 25) return;

  document.getElementById('leaderboard-modal').classList.remove('active');
  document.getElementById('return-to-menu-btn').style.display = 'none';
  topBarEl.style.opacity = '0';

  setBoardViewerTheme('top');
  boardViewerTitleEl.innerText = "🏆 #1 BOARD 🏆";
  document.getElementById('best-board-score').innerText = bestDailyData.score;
  document.getElementById('best-board-initials').innerText = bestDailyData.initials;

  const bg = document.getElementById('best-grid');
  bg.innerHTML = '';

  let chars = bestDailyData.grid.split('');
  let normalizedChars = chars.map(c => c.toUpperCase());

  for (let i = 0; i < 25; i++) {
    let c = document.createElement('div');
    c.className = 'grid-cell';
    if (chars[i] && chars[i] !== chars[i].toUpperCase()) {
      c.classList.add('is-wildcard');
    }
    c.innerText = normalizedChars[i];
    bg.appendChild(c);
  }

  const bValid = findValidWordsLocalArray(normalizedChars);
  const groupedData = buildGroupedWordData(bValid);

  applyColorsToSpecificGrid(groupedData.rawScoringWords, normalizedChars, bg);
  renderWordListsForBoard(bValid);
  document.getElementById('best-board-modal').classList.add('active');
}

async function submitHighscore() {
  let initials = initialsInput.value.trim().toUpperCase();
  if (initials.length === 0) initials = "---";

  let isNewTopScore = false;
  let gridString = "";

  for (let i = 0; i < 25; i++) {
    let char = cells[i];
    if (wildcardState[i]) gridString += char.toLowerCase();
    else gridString += char;
  }

  try {
    const res = await fetch('validate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_score',
        initials: initials,
        score: currentScore,
        grid: gridString
      })
    });

    const data = await res.json();
    isNewTopScore = !!data.is_top_score;
  } catch (e) {
    console.error("Error saving score", e);
  }

  highscoreEntryModal.classList.remove('active');

  const lbTitle = document.getElementById('leaderboard-title');
  const lbModal = document.getElementById('leaderboard-modal');

  if (isNewTopScore) {
    lbTitle.innerText = "🏆 NEW DAILY HIGH SCORE! 🏆";
    lbTitle.classList.add('is-celebration');
    lbModal.classList.add('is-celebration');
    triggerExplosion(true);
  } else {
    lbTitle.innerText = "TODAY'S HIGH SCORES";
    lbTitle.style.color = "var(--highlight)";
    lbTitle.classList.remove('is-celebration');
    lbModal.classList.remove('is-celebration');
  }

  loadLeaderboard();
}

function skipToLeaderboard() {
  highscoreEntryModal.classList.remove('active');

  const lbTitle = document.getElementById('leaderboard-title');
  const lbModal = document.getElementById('leaderboard-modal');

  lbTitle.innerText = "TODAY'S HIGH SCORES";
  lbTitle.style.color = "var(--highlight)";
  lbTitle.classList.remove('is-celebration');
  lbModal.classList.remove('is-celebration');

  loadLeaderboard();
}

async function loadLeaderboard() {
  const listEl = document.getElementById('leaderboard-list');
  listEl.innerHTML = '<li style="border:none; justify-content:center;">Loading...</li>';
  leaderboardModal.classList.add('active');
  topBarEl.style.opacity = '0';

  try {
    const res = await fetch('validate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_highscores' })
    });

    const data = await res.json();

    listEl.innerHTML = '';
    document.getElementById('view-ai-btn').style.display = 'none';

    if (data.highscores && data.highscores.length > 0) {
      bestDailyData = data.highscores[0];

      const viewWinningBtn = document.getElementById('view-winning-btn');
      if (bestDailyData && bestDailyData.grid && bestDailyData.grid.length === 25) {
        viewWinningBtn.style.display = 'block';
        runAIOptimizerOnBestGrid(bestDailyData.grid);
      } else {
        viewWinningBtn.style.display = 'none';
      }

      data.highscores.forEach((entry, index) => {
        let initials = (entry.initials || '---').padEnd(3, '-').substring(0, 3);
        let initialsHtml = '';

        for (let i = 0; i < 3; i++) {
          initialsHtml += `<div class="lb-initial-tile">${initials[i]}</div>`;
        }

        const topClass = index === 0 ? 'is-top-score' : '';
        const rankLabel = index === 0 ? '👑 1.' : `${index + 1}.`;

        listEl.innerHTML += `
          <li class="${topClass}" style="border-bottom:none; padding:0;">
            <div class="lb-row-container">
              <div style="display:flex; align-items:center;">
                <div class="lb-rank">${rankLabel}</div>
                <div class="lb-initials-group">${initialsHtml}</div>
              </div>
              <div class="lb-score-tile">${entry.score}</div>
            </div>
          </li>
        `;
      });
    } else {
      document.getElementById('view-winning-btn').style.display = 'none';
      listEl.innerHTML = '<li style="border:none; justify-content:center;">No scores today!</li>';
    }
  } catch (e) {
    console.error("Error loading scores", e);
    listEl.innerHTML = '<li style="border:none; justify-content:center;">Error loading leaderboard.</li>';
  }
}
