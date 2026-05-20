function showLeaderboardFromBest() {
  document.getElementById('best-board-modal').classList.remove('active');
  document.getElementById('leaderboard-modal').classList.add('active');
  topBarEl.style.opacity = '0';
}

function showBoardViewer(titleText, score, initials, gridChars, themeClass) {
  if (!gridChars || gridChars.length !== 25) return;

  document.getElementById('leaderboard-modal').classList.remove('active');
  topBarEl.style.opacity = '0';

  setBoardViewerTheme(themeClass);
  boardViewerTitleEl.innerHTML = titleText;
  document.getElementById('best-board-score').innerText = score;
  document.getElementById('best-board-initials').innerText = initials;

  const bg = document.getElementById('best-grid');
  bg.innerHTML = '';

  let chars = typeof gridChars === 'string' ? gridChars.split('') : gridChars;
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

    if (data.highscores && data.highscores.length > 0) {
      bestDailyData = data.highscores[0];

      if (bestDailyData && bestDailyData.grid && bestDailyData.grid.length === 25) {
        runAIOptimizerOnBestGrid(bestDailyData.grid);
      }

      data.highscores.forEach((entry, index) => {
        let initials = (entry.initials || '---').padEnd(3, '-').substring(0, 3);
        let initialsHtml = '';

        for (let i = 0; i < 3; i++) {
          initialsHtml += `<div class="lb-initial-tile">${initials[i]}</div>`;
        }

        const topClass = index === 0 ? 'is-top-score' : '';
        const rankLabel = index === 0 ? '👑 1.' : `${index + 1}.`;

        const li = document.createElement('li');
        li.className = topClass;
        li.style.borderBottom = 'none';
        li.style.padding = '0';
        li.title = "Click to view this board";
        li.innerHTML = `
          <div class="lb-row-container">
            <div style="display:flex; align-items:center;">
              <div class="lb-rank">${rankLabel}</div>
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
            index === 0 ? 'top' : 'default'
          );
        });
        listEl.appendChild(li);
      });

      if (bestDailyData && bestDailyData.grid && bestDailyData.grid.length === 25) {
        const aiRow = document.createElement('li');
        aiRow.id = 'ai-leaderboard-row';
        aiRow.style.borderBottom = 'none';
        aiRow.style.padding = '0';
        const cupSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="#cbd5e1" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom;"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10"/><path d="M17 4v8a5 5 0 0 1-10 0V4"/><path d="M4 4h3v5H4z"/><path d="M17 4h3v5h-3z"/></svg>`;
        aiRow.innerHTML = `
          <div class="lb-row-container" style="opacity: 0.6;">
            <div style="display:flex; align-items:center;">
              <div class="lb-rank">${cupSvg}</div>
              <div class="lb-initials-group"><div class="lb-initial-tile">S</div><div class="lb-initial-tile">t</div><div class="lb-initial-tile">C</div></div>
            </div>
            <div class="lb-score-tile">...</div>
          </div>
        `;
        listEl.appendChild(aiRow);
      }
    } else {
      listEl.innerHTML = '<li style="border:none; justify-content:center;">No scores today!</li>';
    }
  } catch (e) {
    console.error("Error loading scores", e);
    listEl.innerHTML = '<li style="border:none; justify-content:center;">Error loading leaderboard.</li>';
  }
}
