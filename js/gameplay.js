function initGame() {
  const existingCells = document.querySelectorAll('#grid > .grid-cell:not(.alpha-cell)');
  existingCells.forEach(cell => cell.remove());

  cells = Array(gridSize * gridSize).fill('');
  wildcardState = Array(gridSize * gridSize).fill(false);

  placedCount = 0;
  pendingCellIndex = null;
  explodedWords.clear();
  currentScore = 0;
  usedWildcards.clear();

  isCurrentGameDaily = document.getElementById('daily-toggle').checked;
  if (isCurrentGameDaily) dailySeed = getDailySeed();

  gameDeck = generateBagSequence();

  scoreEl.innerText = '0';
  headerLabelEl.innerText = 'Next:';

  alphabetModal.classList.remove('active');
  highscoreEntryModal.classList.remove('active');
  leaderboardModal.classList.remove('active');
  document.getElementById('best-board-modal').classList.remove('active');
  document.getElementById('return-to-menu-btn').hidden = true;

  topBarEl.style.opacity = '1';

  document.getElementById('list-5').innerHTML = '';
  document.getElementById('list-4').innerHTML = '';
  document.getElementById('list-3').innerHTML = '';

  for (let i = 0; i < 25; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.dataset.index = i;
    cell.addEventListener('click', () => handleCellClick(i, cell));
    cell.addEventListener('mouseenter', () => handleHoverEnter(i, cell));
    cell.addEventListener('mouseleave', () => handleHoverLeave(cell));
    gridEl.appendChild(cell);
  }

  nextLetterEl.style.display = 'inline-flex';
  leftHeaderEl.title = 'Click to open wildcard picker';
  setNextLetter();
}

function setNextLetter() {
  if (placedCount >= 25) return;
  nextLetterEl.innerText = gameDeck[placedCount];
}

function handleHoverEnter(index, cellEl) {
  if (!document.getElementById('hover-toggle').checked) return;
  if (cells[index] !== '' || placedCount >= 25) return;

  const letter = nextLetterEl.innerText;
  if (letter === '?' || letter === '-') return;

  const currentWords = findValidWordsLocalArray(cells);
  const tempCells = [...cells];
  tempCells[index] = letter;
  const newWords = findValidWordsLocalArray(tempCells).filter(w => !currentWords.includes(w));

  let maxLen = 0;
  newWords.forEach(w => {
    if (w.length > maxLen) maxLen = w.length;
  });

  if (maxLen === 3) cellEl.classList.add('hover-3');
  else if (maxLen === 4) cellEl.classList.add('hover-4');
  else if (maxLen === 5) cellEl.classList.add('hover-5');
}

function handleHoverLeave(cellEl) {
  cellEl.classList.remove('hover-3', 'hover-4', 'hover-5');
}

function handleCellClick(index, cellEl) {
  if (cells[index] !== '' || placedCount >= 25) return;

  const letter = nextLetterEl.innerText;
  if (letter === '?') {
    pendingCellIndex = index;
    updateWildcardModal();
    alphabetModal.classList.add('active');
    return;
  }

  placeLetter(index, letter, cellEl, false);
}

function placeLetter(index, letter, cellEl, isWildcard) {
  cellEl.classList.remove('hover-3', 'hover-4', 'hover-5');

  cells[index] = letter;
  wildcardState[index] = isWildcard;

  cellEl.innerText = letter;
  placedCount++;

  if (isWildcard) {
    cellEl.classList.add('is-wildcard');
  }

  cellEl.classList.add('tile-pop');
  setTimeout(() => {
    cellEl.classList.remove('tile-pop');
  }, 300);

  calculateRealTimeScoreLocal();
  

  if (placedCount === 25) {
    headerLabelEl.innerText = 'Score:';
    nextLetterEl.style.display = 'none';
    leftHeaderEl.title = '';

    topBarEl.style.opacity = '0';

    logGameToServer();

    document.getElementById('final-score-display').innerText = currentScore;

    if (isCurrentGameDaily) {
      document.getElementById('daily-save-section').hidden = false;
      document.getElementById('non-daily-section').hidden = true;

      initialsInput.value = '';
      document.getElementById('init-tile-1').innerText = '';
      document.getElementById('init-tile-2').innerText = '';
      document.getElementById('init-tile-3').innerText = '';

      highscoreEntryModal.classList.add('active');
      initialsInput.focus();
    } else {
      document.getElementById('daily-save-section').hidden = true;
      document.getElementById('non-daily-section').hidden = false;
      highscoreEntryModal.classList.add('active');
    }
  } else {
    setNextLetter();
  }
}

function selectWildcard(letter) {
  if (usedWildcards.has(letter) && letter !== 'Cancel') return;

  alphabetModal.classList.remove('active');

  if (letter === 'Cancel') {
    pendingCellIndex = null;
    return;
  }

  usedWildcards.add(letter);

  if (pendingCellIndex === -1) {
    nextLetterEl.innerText = letter;
  } else {
    const cellEl = document.querySelector(`.grid-cell[data-index='${pendingCellIndex}']`);
    placeLetter(pendingCellIndex, letter, cellEl, true);
  }

  pendingCellIndex = null;
}

function calculateRealTimeScoreLocal() {
  const validWords = findValidWordsLocalArray(cells);
  currentScore = 0;

  let grouped = {};
  validWords.forEach(w => {
    let rev = w.split('').reverse().join('');
    let key = w < rev ? w : rev;
    if (!grouped[key]) grouped[key] = new Set();
    grouped[key].add(w);
  });

  const groupedData = buildGroupedWordData(validWords);

  Object.keys(grouped).forEach(key => {
    let len = key.length;

    if (len === 3) {
      currentScore += 1;
    } else if (len === 4) {
      currentScore += 5;
    } else if (len === 5) {
      currentScore += 20;
      if (!explodedWords.has(key)) {
        triggerExplosion(false);
        explodedWords.add(key);
      }
    }
  });

  scoreEl.innerText = currentScore;
  renderWordListsForBoard(validWords);
  applyColorsToSpecificGrid(groupedData.rawScoringWords, cells, gridEl);
}

async function logGameToServer() {
  let gridString = "";
  for (let i = 0; i < 25; i++) {
    let char = cells[i];
    if (wildcardState[i]) gridString += char.toLowerCase();
    else gridString += char;
  }

  try {
    await fetch('validate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'log_game',
        session_id: sessionId,
        game_seed: dailySeed,
        is_daily: isCurrentGameDaily,
        daily_offset: dailyOffset,
        final_score: currentScore,
        grid: gridString
      })
    });
  } catch (e) {
    console.error("Failed to log game to server", e);
  }
}
