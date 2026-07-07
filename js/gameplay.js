let lastPlacedInfo = null;
let isGameOver = false;

function initGame() {
  if (gridEl) {
      const existingCells = gridEl.querySelectorAll('.grid-cell:not(.alpha-cell)');
      existingCells.forEach(cell => cell.remove());
  }

  cells = Array(gridSize * gridSize).fill('');
  wildcardState = Array(gridSize * gridSize).fill(false);

  placedCount = 0;
  currentDeckIndex = 0;
  pendingCellIndex = null;
  explodedWords.clear();
  currentScore = 0;
  usedWildcards.clear();
  lastPlacedInfo = null;
  isGameOver = false;

  isCurrentGameDaily = true;
  if (isCurrentGameDaily && typeof getDailySeed === 'function') {
      dailySeed = getDailySeed();
  }

  if (typeof generateBagSequence === 'function') {
      gameDeck = generateBagSequence();
  }

  document.dispatchEvent(new CustomEvent('ws:beforeInit'));

  if (scoreEl) scoreEl.innerText = '0';
  const headerLabelEl = document.getElementById('header-label');
  if (headerLabelEl) headerLabelEl.innerText = 'Next:';

  if (alphabetModal) alphabetModal.classList.remove('active');
  if (highscoreEntryModal) highscoreEntryModal.classList.remove('active');
  if (leaderboardModal) leaderboardModal.classList.remove('active');
  
  const bestBoardModal = document.getElementById('best-board-modal');
  if (bestBoardModal) bestBoardModal.classList.remove('active');

  if (topBarEl) topBarEl.style.opacity = '1';

  for (let i = 0; i < 25; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.dataset.index = i;
    cell.style.position = 'relative'; 
    cell.addEventListener('click', () => handleCellClick(i, cell));
    cell.addEventListener('mouseenter', () => handleHoverEnter(i, cell));
    cell.addEventListener('mouseleave', () => handleHoverLeave(cell));
    if (gridEl) gridEl.appendChild(cell);
  }

  const leftHeaderEl = document.getElementById('left-header');
  if (leftHeaderEl) leftHeaderEl.title = 'Click to open wildcard picker';
  
  document.dispatchEvent(new CustomEvent('ws:afterInit'));
  
  setNextLetter();
}

function triggerEndGame() {
    if (isGameOver) return;
    isGameOver = true;

    if (lastPlacedInfo) {
        const oldCell = document.querySelector(`.grid-cell[data-index='${lastPlacedInfo.index}']`);
        if (oldCell) oldCell.classList.remove('is-undoable');
    }
    lastPlacedInfo = null;

    const headerLabelEl = document.getElementById('header-label');
    if (headerLabelEl) headerLabelEl.innerText = 'Score:';
    
    const leftHeaderEl = document.getElementById('left-header');
    if (leftHeaderEl) leftHeaderEl.title = '';
    
    if (topBarEl) topBarEl.style.opacity = '0';

    if (typeof logGameToServer === 'function') logGameToServer();

    const finalScoreEl = document.getElementById('final-score-display');
    if (finalScoreEl) finalScoreEl.innerText = currentScore;

    if (isCurrentGameDaily) {
      const dailySect = document.getElementById('daily-save-section');
      const nonDailySect = document.getElementById('non-daily-section');
      if (dailySect) dailySect.hidden = false;
      if (nonDailySect) nonDailySect.hidden = true;

      if (initialsInput) {
          initialsInput.value = '';
          initialsInput.focus();
      }
      
      const t1 = document.getElementById('init-tile-1');
      const t2 = document.getElementById('init-tile-2');
      const t3 = document.getElementById('init-tile-3');
      if (t1) t1.innerText = '';
      if (t2) t2.innerText = '';
      if (t3) t3.innerText = '';

      if (highscoreEntryModal) highscoreEntryModal.classList.add('active');
    } else {
      const dailySect = document.getElementById('daily-save-section');
      const nonDailySect = document.getElementById('non-daily-section');
      if (dailySect) dailySect.hidden = true;
      if (nonDailySect) nonDailySect.hidden = false;
      
      if (highscoreEntryModal) highscoreEntryModal.classList.add('active');
    }
}

function setNextLetter() {
  if (currentDeckIndex >= gameDeck.length || placedCount >= 25) {
      return;
  }
  
  const nextLetterEl = document.getElementById('next-letter');
  if (nextLetterEl) {
      nextLetterEl.innerText = gameDeck[currentDeckIndex];
  }

  document.dispatchEvent(new CustomEvent('ws:nextLetterUpdated'));
}

function handleHoverEnter(index, cellEl) {
  if (cells[index] !== '' || placedCount >= 25 || isGameOver) return;
  
  let letter = '';
  
  const previewEvent = new CustomEvent('ws:getHoverLetter', { detail: { letter: '' } });
  document.dispatchEvent(previewEvent);
  
  if (previewEvent.detail.letter !== '') {
      letter = previewEvent.detail.letter;
  } else {
      const nextLetterEl = document.getElementById('next-letter');
      if (nextLetterEl) letter = nextLetterEl.innerText;
  }

  if (!letter || letter === '?' || letter === '-') return;

  const currentWords = findValidWordsLocalArray(cells);
  const tempCells = [...cells];
  tempCells[index] = letter;
  const newWords = findValidWordsLocalArray(tempCells).filter(w => !currentWords.includes(w));

  let maxLen = 0;
  newWords.forEach(w => {
    if (w.length > maxLen) maxLen = w.length;
  });

  const hoverEvent = new CustomEvent('ws:applyHover', {
      detail: { cellEl: cellEl, maxLen: maxLen, newWords: newWords },
      cancelable: true
  });

  if (!document.dispatchEvent(hoverEvent)) return;

  if (maxLen === 3) cellEl.classList.add('hover-3');
  else if (maxLen === 4) cellEl.classList.add('hover-4');
  else if (maxLen === 5) cellEl.classList.add('hover-5');
}

function handleHoverLeave(cellEl) {
  if (cellEl) cellEl.classList.remove('hover-3', 'hover-4', 'hover-5');
}

function handleCellClick(index, cellEl) {
  if (isGameOver || placedCount >= 25) return;
  
  if (cells[index] !== '') {
      if (lastPlacedInfo && lastPlacedInfo.index === index) {
          undoLastMove();
      }
      return;
  }
  
  const clickEvent = new CustomEvent('ws:cellClick', { 
      detail: { index: index, cellEl: cellEl }, 
      cancelable: true 
  });
  
  if (!document.dispatchEvent(clickEvent)) {
      return; 
  }

  const nextLetterEl = document.getElementById('next-letter');
  if (!nextLetterEl || nextLetterEl.innerText === '') return;

  const letter = nextLetterEl.innerText;
  if (letter === '?') {
    pendingCellIndex = index;
    if (typeof updateWildcardModal === 'function') updateWildcardModal();
    if (alphabetModal) alphabetModal.classList.add('active');
    return;
  }

  placeLetter(index, letter, cellEl, false);
}

function placeLetter(index, letter, cellEl, isWildcard) {
  if (lastPlacedInfo) {
      const oldCell = document.querySelector(`.grid-cell[data-index='${lastPlacedInfo.index}']`);
      if (oldCell) oldCell.classList.remove('is-undoable');
  }

  if (cellEl) cellEl.classList.remove('hover-3', 'hover-4', 'hover-5');

  cells[index] = letter;
  wildcardState[index] = isWildcard;

  if (cellEl) {
      cellEl.innerText = letter;
      cellEl.dataset.letter = letter; 

      if (isWildcard) {
        cellEl.classList.add('is-wildcard');
      }
      
      cellEl.classList.add('tile-pop', 'is-undoable');
      setTimeout(() => {
        if (cellEl) cellEl.classList.remove('tile-pop');
      }, 300);
  }
  
  lastPlacedInfo = { index: index, letter: letter, isWildcard: isWildcard };
  placedCount++;

  calculateRealTimeScoreLocal();
  
  if (placedCount === 25) {
    triggerEndGame();
  } else {
    document.dispatchEvent(new CustomEvent('ws:tilePlaced'));
  }
}

function undoLastMove() {
    if (!lastPlacedInfo) return;

    const index = lastPlacedInfo.index;
    const letter = lastPlacedInfo.letter;
    const isWildcard = lastPlacedInfo.isWildcard;
    const cellEl = document.querySelector(`.grid-cell[data-index='${index}']`);

    cells[index] = '';
    wildcardState[index] = false;
    placedCount--;

    if (isWildcard) {
        usedWildcards.delete(letter);
    }

    if (cellEl) {
        cellEl.innerText = '';
        delete cellEl.dataset.letter;
        cellEl.classList.remove('is-wildcard', 'is-undoable', 'tile-pop');
    }

    const undoneEvent = new CustomEvent('ws:tileUndone', {
        detail: { index: index, letter: letter }
    });
    document.dispatchEvent(undoneEvent);

    calculateRealTimeScoreLocal();

    lastPlacedInfo = null;
}

function selectWildcard(letter) {
  if (usedWildcards.has(letter) && letter !== 'Cancel') return;

  if (alphabetModal) alphabetModal.classList.remove('active');

  if (letter === 'Cancel') {
    pendingCellIndex = null;
    return;
  }

  usedWildcards.add(letter);

  if (pendingCellIndex === -1) {
    const nextLetterEl = document.getElementById('next-letter');
    if (nextLetterEl) nextLetterEl.innerText = letter;
  } else {
    const cellEl = document.querySelector(`.grid-cell[data-index='${pendingCellIndex}']`);
    placeLetter(pendingCellIndex, letter, cellEl, true);
  }

  pendingCellIndex = null;
}

function calculateRealTimeScoreLocal() {
  const scoreEvent = new CustomEvent('ws:calculateScore', { cancelable: true });
  if (!document.dispatchEvent(scoreEvent)) {
      return; 
  }

  const validWords = findValidWordsLocalArray(cells);
  const groupedData = buildGroupedWordData(validWords);

  currentScore = (groupedData.display[3].length * 1) + 
                 (groupedData.display[4].length * 5) + 
                 (groupedData.display[5].length * 20);

  groupedData.display[5].forEach(displayStr => {
    if (!explodedWords.has(displayStr)) {
      if (typeof triggerExplosion === 'function') triggerExplosion(false);
      explodedWords.add(displayStr);
    }
  });

  if (scoreEl) scoreEl.innerText = currentScore;
  if (typeof renderWordListsForBoard === 'function') renderWordListsForBoard(groupedData);
  if (typeof applyColorsToSpecificGrid === 'function' && gridEl) {
      applyColorsToSpecificGrid(groupedData.rawScoringWords, cells, gridEl);
  }
}

async function logGameToServer() {
  let gridString = "";
  for (let i = 0; i < 25; i++) {
    let char = cells[i];
    if (!char || char === '') char = '-'; 
    if (wildcardState[i] && char !== '-') gridString += char.toLowerCase();
    else gridString += char;
  }

  try {
    await fetch('validate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'log_game',
        session_id: typeof sessionId !== 'undefined' ? sessionId : '',
        game_seed: typeof dailySeed !== 'undefined' ? dailySeed : 0,
        is_daily: isCurrentGameDaily,
        daily_offset: typeof dailyOffset !== 'undefined' ? dailyOffset : 0,
        final_score: currentScore,
        grid: gridString
      })
    });
  } catch (e) {
    console.error("Failed to log game to server", e);
  }
}

document.addEventListener('ws:tilePlaced', () => {
    if (window.GAME_CONFIG && window.GAME_CONFIG.isScrabbleDay) return;
    currentDeckIndex++;
    if (currentDeckIndex >= gameDeck.length) {
        triggerEndGame();
    } else {
        setNextLetter();
    }
});

document.addEventListener('ws:tileUndone', () => {
    if (window.GAME_CONFIG && window.GAME_CONFIG.isScrabbleDay) return;
    currentDeckIndex--;
    setNextLetter();
});