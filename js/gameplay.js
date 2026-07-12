'use strict';
let dailySect = null;
let nonDailySect = null;
let lastPlacedInfo = null;
let isGameOver = false;
const MAX_TELEMETRY_ERRORS_PER_SESSION = 5;
let _telemetryErrorCount = 0;
let _cellElements = [];

window.addEventListener('error', function(event) {
  if (_telemetryErrorCount >= MAX_TELEMETRY_ERRORS_PER_SESSION) {
    console.warn('Telemetry throttled: max client error reports reached for this session.');
    return;
  }
  _telemetryErrorCount++;

  const errorPayload = {
    action: 'log_client_error',
    error_type: event.error ? event.error.name : 'UnknownError',
    message: typeof event.message === 'string' ? event.message.slice(0, 500) : 'Unknown error',
    filename: typeof event.filename === 'string' ? event.filename.slice(0, 300) : '',
    lineno: Number.isInteger(event.lineno) ? event.lineno : -1,
    stack_trace: event.error && typeof event.error.stack === 'string' ? event.error.stack.slice(0, 2000) : 'No stack trace available',
    url: window.location.href
  };

  fetchWithTimeout('validate.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(errorPayload)
  }, 5000).catch(e => console.error('Silent Telemetry Failure:', e));
});

function rebuildCellElementCache() {
  const gridEl = DomRefs.gridEl;
  _cellElements = Array(GameState.CELL_COUNT).fill(null);
  if (!gridEl) {
    console.error('rebuildCellElementCache: grid element missing, cache left empty.');
    return;
  }
  const nodeList = gridEl.querySelectorAll('.grid-cell:not(.alpha-cell)');
  nodeList.forEach(node => {
    const idx = Number(node.dataset.index);
    if (Number.isInteger(idx) && idx >= 0 && idx < GameState.CELL_COUNT) {
      _cellElements[idx] = node;
    }
  });
}

function getCellElement(index) {
  if (!Number.isInteger(index) || index < 0 || index >= GameState.CELL_COUNT) {
    console.warn(`getCellElement: index ${index} out of bounds.`);
    return null;
  }
  const cached = _cellElements[index];
  if (cached && document.body.contains(cached)) return cached;
  console.warn(`getCellElement: cache miss for index ${index}, cell may have been removed.`);
  return null;
}

function initGame() {
  try {
    const gridEl = DomRefs.gridEl;
    if (gridEl) {
      gridEl.querySelectorAll('.grid-cell:not(.alpha-cell)').forEach(cell => cell.remove());
    } else {
      console.error('initGame: grid element not found, cannot rebuild board.');
    }

    GameState.resetCells();
    GameState.resetWildcardState();
    GameState.resetPlacedCount();
    GameState.resetDeckIndex();
    GameState.setPendingCellIndex(null);
    GameState.clearExplodedWords();
    GameState.resetCurrentScore();
    GameState.clearUsedWildcards();

    lastPlacedInfo = null;
    isGameOver = false;
    _telemetryErrorCount = 0;

    if (typeof clearAllParticleTimeouts === 'function') clearAllParticleTimeouts();
    if (typeof resetBombState === 'function') resetBombState();

    GameState.setDaily(true);
    if (typeof getDailySeed === 'function') {
      GameState.setDailySeed(getDailySeed());
    }

    if (typeof generateBagSequence === 'function') {
      GameState.setDeck(generateBagSequence());
    }

    document.dispatchEvent(new CustomEvent('ws:beforeInit'));

    if (DomRefs.scoreEl) DomRefs.scoreEl.innerText = '0';
    const headerLabelEl = document.getElementById('header-label');
    if (headerLabelEl) headerLabelEl.innerText = 'Next:';

    if (DomRefs.alphabetModal) DomRefs.alphabetModal.classList.remove('active');
    if (DomRefs.highscoreEntryModal) DomRefs.highscoreEntryModal.classList.remove('active');
    if (DomRefs.leaderboardModal) DomRefs.leaderboardModal.classList.remove('active');

    const bestBoardModal = document.getElementById('best-board-modal');
    if (bestBoardModal) bestBoardModal.classList.remove('active');

    if (DomRefs.topBarEl) DomRefs.topBarEl.style.opacity = '1';

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < GameState.CELL_COUNT; i++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.index = String(i);
      cell.style.position = 'relative';
      cell.addEventListener('click', () => handleCellClick(i, cell));
      cell.addEventListener('mouseenter', () => handleHoverEnter(i, cell));
      cell.addEventListener('mouseleave', () => handleHoverLeave(cell));
      fragment.appendChild(cell);
    }
    if (gridEl) gridEl.appendChild(fragment);

    rebuildCellElementCache();

    const leftHeaderEl = document.getElementById('left-header');
    if (leftHeaderEl) leftHeaderEl.title = 'Click to open wildcard picker';

    document.dispatchEvent(new CustomEvent('ws:afterInit'));
    setNextLetter();
  } catch (err) {
    console.error('initGame: fatal error during game initialization.', err);
  }
}

function triggerEndGame() {
  try {
    if (isGameOver) return;
    isGameOver = true;

    if (lastPlacedInfo) {
      const oldCell = getCellElement(lastPlacedInfo.index);
      if (oldCell) oldCell.classList.remove('is-undoable');
    }
    lastPlacedInfo = null;

    const headerLabelEl = document.getElementById('header-label');
    if (headerLabelEl) headerLabelEl.innerText = 'Score:';

    const leftHeaderEl = document.getElementById('left-header');
    if (leftHeaderEl) leftHeaderEl.title = '';

    if (DomRefs.topBarEl) DomRefs.topBarEl.style.opacity = '0';

    if (typeof logGameToServer === 'function') {
      logGameToServer().catch(err => console.error('triggerEndGame: logGameToServer failed.', err));
    }

    const finalScoreEl = document.getElementById('final-score-display');
    if (finalScoreEl) finalScoreEl.innerText = String(GameState.getCurrentScore());

    dailySect = document.getElementById('daily-save-section');
    nonDailySect = document.getElementById('non-daily-section');

    if (GameState.isDaily()) {
      if (dailySect) {
        dailySect.hidden = false;
        dailySect.style.display = 'block';
      }
      if (nonDailySect) {
        nonDailySect.hidden = true;
        nonDailySect.style.display = 'none';
      }
      if (DomRefs.initialsInput) {
        DomRefs.initialsInput.value = '';
        DomRefs.initialsInput.focus();
      }

      ['init-tile-1', 'init-tile-2', 'init-tile-3'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = '';
      });
    } else {
      if (dailySect) {
        dailySect.hidden = true;
        dailySect.style.display = 'none';
      }
      if (nonDailySect) {
        nonDailySect.hidden = false;
        nonDailySect.style.display = 'block';
      }
    }

    if (DomRefs.highscoreEntryModal) {
      DomRefs.highscoreEntryModal.classList.add('active');
    }

    if (typeof loadLeaderboard === 'function') {
      loadLeaderboard().catch(err => console.error('triggerEndGame: loadLeaderboard failed.', err));
    }
  } catch (err) {
    console.error('triggerEndGame: unexpected failure.', err);
  }
}

function setNextLetter() {
  try {
    const deck = GameState.getDeck();
    const deckIndex = GameState.getCurrentDeckIndex();

    if (deckIndex >= deck.length || GameState.getPlacedCount() >= GameState.CELL_COUNT) {
      triggerEndGame();
      return;
    }

    const nextLetterEl = document.getElementById('next-letter');
    if (nextLetterEl) {
      nextLetterEl.innerText = deck[deckIndex] || '';
    }

    const q1El = document.getElementById('queue-1');
    const q2El = document.getElementById('queue-2');
    if (q1El) q1El.innerText = deck[deckIndex + 1] || '';
    if (q2El) q2El.innerText = deck[deckIndex + 2] || '';

    document.dispatchEvent(new CustomEvent('ws:nextLetterUpdated'));
  } catch (err) {
    console.error('setNextLetter: failed to advance letter queue.', err);
  }
}

function handleHoverEnter(index, cellEl) {
  try {
    const cells = GameState.getCells();
    if (!Number.isInteger(index) || index < 0 || index >= GameState.CELL_COUNT) return;
    if (cells[index] !== '' || GameState.getPlacedCount() >= GameState.CELL_COUNT || isGameOver) return;

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
    newWords.forEach(w => { if (w.length > maxLen) maxLen = w.length; });

    const hoverEvent = new CustomEvent('ws:applyHover', {
      detail: { cellEl, maxLen, newWords },
      cancelable: true
    });
    if (!document.dispatchEvent(hoverEvent)) return;

    if (maxLen === 3) cellEl.classList.add('hover-3');
    else if (maxLen === 4) cellEl.classList.add('hover-4');
    else if (maxLen === 5) cellEl.classList.add('hover-5');
  } catch (err) {
    console.error(`handleHoverEnter: failed for index ${index}.`, err);
  }
}

function handleHoverLeave(cellEl) {
  if (cellEl && cellEl.classList) {
    cellEl.classList.remove('hover-3', 'hover-4', 'hover-5');
  }
}

function handleCellClick(index, cellEl) {
  try {
    if (isGameOver || GameState.getPlacedCount() >= GameState.CELL_COUNT) return;
    if (!Number.isInteger(index) || index < 0 || index >= GameState.CELL_COUNT) {
      console.error(`handleCellClick: invalid index ${index}.`);
      return;
    }

    const cells = GameState.getCells();
    if (cells[index] !== '') {
      if (lastPlacedInfo && lastPlacedInfo.index === index) {
        undoLastMove();
      }
      return;
    }

    const clickEvent = new CustomEvent('ws:cellClick', {
      detail: { index, cellEl },
      cancelable: true
    });
    if (!document.dispatchEvent(clickEvent)) return;

    const nextLetterEl = document.getElementById('next-letter');
    if (!nextLetterEl || nextLetterEl.innerText === '') return;

    const letter = nextLetterEl.innerText;
    if (letter === '?') {
      GameState.setPendingCellIndex(index);
      if (typeof updateWildcardModal === 'function') updateWildcardModal();
      if (DomRefs.alphabetModal) DomRefs.alphabetModal.classList.add('active');
      return;
    }

    placeLetter(index, letter, cellEl, false);
  } catch (err) {
    console.error(`handleCellClick: failed for index ${index}.`, err);
  }
}

function placeLetter(index, letter, cellEl, isWildcard) {
  try {
    if (!Number.isInteger(index) || index < 0 || index >= GameState.CELL_COUNT) {
      throw new RangeError(`placeLetter: invalid index ${index}.`);
    }
    if (typeof letter !== 'string' || letter.length !== 1) {
      throw new TypeError(`placeLetter: invalid letter "${letter}".`);
    }

    if (lastPlacedInfo) {
      const oldCell = getCellElement(lastPlacedInfo.index);
      if (oldCell) oldCell.classList.remove('is-undoable');
    }

    if (cellEl) cellEl.classList.remove('hover-3', 'hover-4', 'hover-5');

    const cells = GameState.getCells();
    const wildcardState = GameState.getWildcardState();
    cells[index] = letter;
    wildcardState[index] = Boolean(isWildcard);

    if (cellEl) {
      cellEl.innerText = letter;
      cellEl.dataset.letter = letter;
      if (isWildcard) cellEl.classList.add('is-wildcard');
      cellEl.classList.add('tile-pop', 'is-undoable');
      setTimeout(() => {
        if (cellEl) cellEl.classList.remove('tile-pop');
      }, 300);
    }

    lastPlacedInfo = { index, letter, isWildcard: Boolean(isWildcard) };
    GameState.incrementPlacedCount();

    calculateRealTimeScoreLocal();
    document.dispatchEvent(new CustomEvent('ws:tilePlaced'));
  } catch (err) {
    console.error('placeLetter: failed to place tile.', err);
  }
}

function undoLastMove() {
  try {
    if (!lastPlacedInfo) return;

    const { index, letter, isWildcard } = lastPlacedInfo;
    const cellEl = getCellElement(index);

    const cells = GameState.getCells();
    const wildcardState = GameState.getWildcardState();
    cells[index] = '';
    wildcardState[index] = false;
    GameState.decrementPlacedCount();

    if (isWildcard) {
      const usedWildcards = GameState.getUsedWildcards();
      const remaining = usedWildcards.get(letter) || 0;
      if (remaining <= 1) {
        usedWildcards.delete(letter);
      } else {
        usedWildcards.set(letter, remaining - 1);
      }
    }

    if (cellEl) {
      cellEl.innerText = '';
      delete cellEl.dataset.letter;
      cellEl.classList.remove('is-wildcard', 'is-undoable', 'tile-pop');
    }

    document.dispatchEvent(new CustomEvent('ws:tileUndone', { detail: { index, letter } }));

    calculateRealTimeScoreLocal();
    lastPlacedInfo = null;
  } catch (err) {
    console.error('undoLastMove: failed to undo last placement.', err);
  }
}

function selectWildcard(letter) {
  try {
    if (typeof letter !== 'string' || letter.length === 0) {
      console.error('selectWildcard: invalid letter argument.');
      return;
    }

    const usedWildcards = GameState.getUsedWildcards();
    if (letter !== 'Cancel' && (usedWildcards.get(letter) || 0) >= 1) {
      return;
    }

    if (DomRefs.alphabetModal) DomRefs.alphabetModal.classList.remove('active');

    if (letter === 'Cancel') {
      GameState.setPendingCellIndex(null);
      return;
    }

    usedWildcards.set(letter, (usedWildcards.get(letter) || 0) + 1);

    const pendingIndex = GameState.getPendingCellIndex();
    if (pendingIndex === -1) {
      const nextLetterEl = document.getElementById('next-letter');
      if (nextLetterEl) nextLetterEl.innerText = letter;
    } else if (pendingIndex !== null) {
      const cellEl = getCellElement(pendingIndex);
      placeLetter(pendingIndex, letter, cellEl, true);
    }

    GameState.setPendingCellIndex(null);
  } catch (err) {
    console.error('selectWildcard: failed to process wildcard selection.', err);
  }
}

function calculateRealTimeScoreLocal() {
  try {
    const scoreEvent = new CustomEvent('ws:calculateScore', { cancelable: true });
    if (!document.dispatchEvent(scoreEvent)) return;

    const cells = GameState.getCells();
    const validWords = findValidWordsLocalArray(cells);
    const groupedData = buildGroupedWordData(validWords);

    const score = (groupedData.display[3].length * 1) +
                  (groupedData.display[4].length * 5) +
                  (groupedData.display[5].length * 20);
    GameState.setCurrentScore(score);

    groupedData.display[5].forEach(displayStr => {
      const exploded = GameState.getExplodedWords();
      if (!exploded.has(displayStr)) {
        if (typeof triggerExplosion === 'function') triggerExplosion(false);
        exploded.add(displayStr);
      }
    });

    if (DomRefs.scoreEl) DomRefs.scoreEl.innerText = String(score);
    if (typeof renderWordListsForBoard === 'function') renderWordListsForBoard(groupedData);
    if (typeof applyColorsToSpecificGrid === 'function' && DomRefs.gridEl) {
      applyColorsToSpecificGrid(groupedData.rawScoringWords, cells, DomRefs.gridEl);
    }
  } catch (err) {
    console.error('calculateRealTimeScoreLocal: scoring failed.', err);
  }
}

function buildCurrentGridString() {
  const cells = GameState.getCells();
  const wildcardState = GameState.getWildcardState();

  if (!Array.isArray(cells) || cells.length !== GameState.CELL_COUNT) {
    throw new Error('buildCurrentGridString: cells array is invalid or wrong length.');
  }
  if (!Array.isArray(wildcardState) || wildcardState.length !== GameState.CELL_COUNT) {
    throw new Error('buildCurrentGridString: wildcardState array is invalid or wrong length.');
  }

  let gridString = '';
  for (let i = 0; i < GameState.CELL_COUNT; i++) {
    let char = cells[i];
    if (!char || char === '') char = '-';
    gridString += (wildcardState[i] && char !== '-') ? char.toLowerCase() : char;
  }
  return gridString;
}

async function logGameToServer() {
  let gridString;
  try {
    gridString = buildCurrentGridString();
  } catch (err) {
    console.error('logGameToServer: could not build grid string, aborting log.', err);
    return;
  }

  try {
    const response = await fetchWithTimeout('validate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'log_game',
        session_id: GameState.getSessionId(),
        game_seed: GameState.getDailySeed(),
        is_daily: GameState.isDaily(),
        daily_offset: GameState.getDailyOffset(),
        final_score: GameState.getCurrentScore(),
        grid: gridString
      })
    }, 8000);

    if (!response.ok) {
      console.error(`logGameToServer: server responded with status ${response.status}.`);
    }
  } catch (err) {
    console.error('logGameToServer: request failed.', err);
  }
}

document.addEventListener('ws:tilePlaced', () => {
  if (window.GAME_CONFIG && window.GAME_CONFIG.isScrabbleDay) return;
  GameState.incrementDeckIndex();
  setNextLetter();
});

document.addEventListener('ws:tileUndone', () => {
  if (window.GAME_CONFIG && window.GAME_CONFIG.isScrabbleDay) return;
  GameState.decrementDeckIndex();
  setNextLetter();
});