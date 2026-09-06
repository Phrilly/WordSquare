// ================================
// TOP UP VARIANT
// Survival/endurance mode: only complete 5-letter rows/columns are tracked.
// Cleared cells become permanent holes (no gravity/shifting).
// ================================

function isTopUpMode() {
  return !!(window.GAME_CONFIG && window.GAME_CONFIG.isTopUpDay);
}

let topUpActiveMatches = [];
let topUpHighlightedIndices = new Set();
let topUpScoredWordKeys = new Set();
let topUpShortWordClasses = new Map();
let topUpScoreEvents = [];
let topUpStickyPreviewCell = null;

// Removes the persistent long-press hover preview from the board.
function clearTopUpStickyPreview() {
  if (!topUpStickyPreviewCell) return;
  topUpStickyPreviewCell.classList.remove('hover-3', 'hover-4', 'hover-5');
  topUpStickyPreviewCell = null;
}

// ---------------------------------------------------------
// WORD DETECTION (all straight-line directions)
// ---------------------------------------------------------
function isTopUpDictionaryWord(word) {
  if (word.length < 3 || word.length > gridSize) return false;
  if (gameDictionary.has(word)) return true;
  const reversed = word.split('').reverse().join('');
  return gameDictionary.has(reversed);
}

function computeTopUpScoringWords() {
  const words = [];
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      directions.forEach(([rowStep, columnStep]) => {
        for (let length = 3; length <= 4; length++) {
          const endRow = r + ((length - 1) * rowStep);
          const endColumn = c + ((length - 1) * columnStep);
          if (endRow < 0 || endRow >= gridSize || endColumn < 0 || endColumn >= gridSize) continue;

          const path = Array.from({ length }, (_, step) => ((r + (step * rowStep)) * gridSize) + c + (step * columnStep));
          const word = path.map(index => cells[index]).join('');
          if (word.length === length && isTopUpDictionaryWord(word)) {
            words.push({ key: path.join('-'), length, text: getDictionaryWordOrientation(word) });
          }
        }
      });
    }
  }

  return words;
}

function computeTopUpMatches() {
  const matches = [];
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      directions.forEach(([rowStep, columnStep]) => {
        const endRow = r + ((gridSize - 1) * rowStep);
        const endColumn = c + ((gridSize - 1) * columnStep);
        if (endRow < 0 || endRow >= gridSize || endColumn < 0 || endColumn >= gridSize) return;

        const indices = Array.from({ length: gridSize }, (_, step) => ((r + (step * rowStep)) * gridSize) + c + (step * columnStep));
        const word = indices.map(index => cells[index]).join('');
        if (word.length === gridSize && isTopUpDictionaryWord(word)) {
          matches.push({ key: indices.join('-'), indices, word: getDictionaryWordOrientation(word) });
        }
      });
    }
  }

  return matches;
}

function awardTopUpScoringWords() {
  const words = computeTopUpScoringWords();
  const activeKeys = new Set(words.map(word => word.key));

  words.forEach(word => {
    if (!topUpScoredWordKeys.has(word.key)) {
      const points = word.length === 3 ? 1 : 5;
      currentScore += points;
      topUpScoreEvents.push({ word: word.text, points });
    }
  });

  topUpScoredWordKeys = activeKeys;
  applyTopUpShortWordColors(words);
}

function applyTopUpShortWordColors(words) {
  const nextClasses = new Map();

  words.forEach(word => {
    const className = word.length === 3 ? 'word-3' : 'word-4';
    word.key.split('-').forEach(index => {
      const previousClass = nextClasses.get(index);
      nextClasses.set(index, previousClass === 'word-4' ? previousClass : className);
    });
  });

  topUpShortWordClasses.forEach((className, index) => {
    if (nextClasses.get(index) !== className) {
      const cellEl = document.querySelector(`.grid-cell[data-index='${index}']`);
      if (cellEl) cellEl.classList.remove(className);
    }
  });

  nextClasses.forEach((className, index) => {
    if (topUpShortWordClasses.get(index) !== className) {
      const cellEl = document.querySelector(`.grid-cell[data-index='${index}']`);
      if (cellEl) cellEl.classList.remove('word-3', 'word-4');
      if (cellEl) cellEl.classList.add(className);
    }
  });

  topUpShortWordClasses = nextClasses;
}

function renderTopUpScoreList() {
  const listEl = document.getElementById('topup-score-list');
  if (!listEl) return;

  listEl.replaceChildren(...topUpScoreEvents.map(event => {
    const item = document.createElement('li');
    item.className = 'found-word-row';
    for (const letter of event.word) {
      const tile = document.createElement('span');
      tile.className = `mini-tile word-${event.word.length}`;
      tile.textContent = letter;
      item.append(tile);
    }
    const points = document.createElement('span');
    points.className = 'mini-tile points-tile';
    points.textContent = `+${event.points}`;
    item.append(points);
    return item;
  }));
}

// ---------------------------------------------------------
// HIGHLIGHTING
// ---------------------------------------------------------
function applyTopUpHighlights(matches) {
  const nextIndices = new Set();
  matches.forEach(m => m.indices.forEach(i => nextIndices.add(i)));

  topUpHighlightedIndices.forEach(i => {
    if (!nextIndices.has(i)) {
      const cellEl = document.querySelector(`.grid-cell[data-index='${i}']`);
      if (cellEl) cellEl.classList.remove('highlight-active');
    }
  });

  nextIndices.forEach(i => {
    if (!topUpHighlightedIndices.has(i)) {
      const cellEl = document.querySelector(`.grid-cell[data-index='${i}']`);
      if (cellEl) cellEl.classList.add('highlight-active');
    }
  });

  topUpHighlightedIndices = nextIndices;
  topUpActiveMatches = matches;
}

function refreshTopUpBoardState() {
  const matches = computeTopUpMatches();
  applyTopUpHighlights(matches);
  return matches;
}

// ---------------------------------------------------------
// ENDLESS DECK (no dictionary length limit means the run can outlast a normal 25-tile deck)
// ---------------------------------------------------------
const TOPUP_LETTER_POOL = "AAAAAAAEEEEEEEEEEIIIIIOOOOOUUUSSSSRRRRRRRRTTTTTTTTNNNNNNNLLLLLLDDDDDBBCCCCFFGGGHHHJKMMMMPPPQVVWWXYYZ".split('');
const TOPUP_DECK_BUFFER = 10;
const TOPUP_DECK_REFILL = 40;
const TOPUP_INITIAL_DECK = 60;

function drawTopUpLetters(count) {
  const rnd = (isCurrentGameDaily && typeof getSeededRandom === 'function') ? getSeededRandom : Math.random;
  const letters = [];
  for (let i = 0; i < count; i++) {
    letters.push(TOPUP_LETTER_POOL[Math.floor(rnd() * TOPUP_LETTER_POOL.length)]);
  }
  return letters;
}

function ensureTopUpDeckBuffer() {
  if (gameDeck.length - currentDeckIndex < TOPUP_DECK_BUFFER) {
    gameDeck.push(...drawTopUpLetters(TOPUP_DECK_REFILL));
  }
}

// ---------------------------------------------------------
// QUEUE UI (reuses the Lookahead-style preview strip)
// ---------------------------------------------------------
function syncTopUpQueueUI() {
  if (!isTopUpMode()) return;

  const queueContainer = document.getElementById('queue-container');
  const nextLetterEl = document.getElementById('next-letter');
  const queue1El = document.getElementById('queue-1');
  const queue2El = document.getElementById('queue-2');

  if (nextLetterEl) nextLetterEl.style.display = 'inline-flex';
  if (queueContainer) queueContainer.classList.add('is-active');
  if (queue1El) queue1El.classList.toggle('is-active', (queue1El.innerText || '').trim() !== '');
  if (queue2El) queue2El.classList.toggle('is-active', (queue2El.innerText || '').trim() !== '');
}

// ---------------------------------------------------------
// LIFECYCLE HOOKS
// ---------------------------------------------------------
document.addEventListener('ws:beforeInit', () => {
  if (!isTopUpMode()) return;
  gameDeck = drawTopUpLetters(TOPUP_INITIAL_DECK);
  topUpActiveMatches = [];
  topUpHighlightedIndices = new Set();
  topUpScoredWordKeys = new Set();
  topUpShortWordClasses = new Map();
  topUpScoreEvents = [];
  topUpStickyPreviewCell = null;
});

document.addEventListener('ws:afterInit', () => {
  if (!isTopUpMode()) return;
  syncTopUpQueueUI();
});

document.addEventListener('ws:nextLetterUpdated', () => {
  if (!isTopUpMode()) return;
  syncTopUpQueueUI();
});

document.addEventListener('ws:tileUndone', () => {
  if (!isTopUpMode()) return;
  syncTopUpQueueUI();
});

// Apply hover color previews matching the word length that would be formed.
// On touch devices the preview sticks after long-press release (see
// ws:mobilePreviewCancel below) so players can inspect it before committing.
document.addEventListener('ws:applyHover', (e) => {
  if (!isTopUpMode()) return;
  e.preventDefault();
  const maxLen = e.detail.maxLen;
  const cellEl = e.detail.cellEl;
  if (topUpStickyPreviewCell && topUpStickyPreviewCell !== cellEl) {
    clearTopUpStickyPreview();
  }
  topUpStickyPreviewCell = cellEl;
  if (maxLen === 3) cellEl.classList.add('hover-3');
  else if (maxLen === 4) cellEl.classList.add('hover-4');
  else if (maxLen === 5) cellEl.classList.add('hover-5');
});

// Keep the long-press preview visible after the finger lifts.
document.addEventListener('ws:mobilePreviewCancel', (e) => {
  if (!isTopUpMode()) return;
  if (e.detail.cellEl === topUpStickyPreviewCell) {
    e.preventDefault();
  }
});

// The sticky preview is only truthful for the letter it was computed with;
// clear it whenever the queued letter changes or the board resets.
document.addEventListener('ws:tilePlaced', () => {
  if (!isTopUpMode()) return;
  clearTopUpStickyPreview();
});

document.addEventListener('ws:tileUndone', () => {
  if (!isTopUpMode()) return;
  clearTopUpStickyPreview();
});

document.addEventListener('ws:nextLetterUpdated', () => {
  if (!isTopUpMode()) return;
  clearTopUpStickyPreview();
});

// Top Up awards short words once when formed; five-letter words pay out on clear.
document.addEventListener('ws:calculateScore', (e) => {
  if (!isTopUpMode()) return;
  e.preventDefault();
  awardTopUpScoringWords();
  refreshTopUpBoardState();
  if (scoreEl) scoreEl.innerText = currentScore;
});

document.addEventListener('ws:tilePlaced', () => {
  if (!isTopUpMode()) return;
  ensureTopUpDeckBuffer();
});

// The deck never truly runs out in an endurance mode; top it up instead of ending the run.
document.addEventListener('ws:deckExhausted', (e) => {
  if (!isTopUpMode()) return;
  e.preventDefault();
  ensureTopUpDeckBuffer();
});

// Strict game-over condition: full board AND nothing left to clear.
document.addEventListener('ws:boardFull', (e) => {
  if (!isTopUpMode()) return;
  if (topUpActiveMatches.length > 0) {
    e.preventDefault();
  }
});

// Click-to-clear: one highlighted path is cleared per click.
document.addEventListener('ws:occupiedCellClick', (e) => {
  if (!isTopUpMode() || isGameOver) return;

  const index = e.detail.index;
  const matchingWord = topUpActiveMatches.find(m => m.indices.includes(index));
  if (!matchingWord) return;

  const clearedIndices = new Set(matchingWord.indices);

  clearedIndices.forEach(i => {
    const cellEl = document.querySelector(`.grid-cell[data-index='${i}']`);
    cells[i] = '';
    wildcardState[i] = false;
    placedCount--;
    if (cellEl) {
      cellEl.innerText = '';
      delete cellEl.dataset.letter;
      cellEl.classList.remove('highlight-active', 'is-undoable', 'is-wildcard', 'word-3', 'word-4');
      cellEl.classList.add('topup-cleared');
      setTimeout(() => cellEl.classList.remove('topup-cleared'), 300);
    }
  });

  if (lastPlacedInfo && clearedIndices.has(lastPlacedInfo.index)) {
    lastPlacedInfo = null;
  }

  currentScore += 20;
  topUpScoreEvents.push({ word: matchingWord.word, points: 20 });
  if (scoreEl) scoreEl.innerText = currentScore;

  // Re-evaluating here (rather than waiting for the next placement) is what drops an
  // intersecting word's highlight the instant its shared letter is cleared away.
  awardTopUpScoringWords();
  refreshTopUpBoardState();

  // Reopen the queue gate now that the board has room again.
  if (typeof setNextLetter === 'function') setNextLetter();
});

document.addEventListener('ws:topUpGameOver', () => renderScoreBreakdown(topUpScoreEvents));
