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
            words.push({ key: path.join('-'), length });
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
          matches.push({ key: indices.join('-'), indices, word });
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
      currentScore += word.length === 3 ? 1 : 5;
    }
  });

  topUpScoredWordKeys = activeKeys;
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

// Diagonal/short-word previews don't apply to Top Up's row/column-only rule.
document.addEventListener('ws:applyHover', (e) => {
  if (!isTopUpMode()) return;
  e.preventDefault();
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
      cellEl.classList.remove('highlight-active', 'is-undoable', 'is-wildcard');
      cellEl.classList.add('topup-cleared');
      setTimeout(() => cellEl.classList.remove('topup-cleared'), 300);
    }
  });

  if (lastPlacedInfo && clearedIndices.has(lastPlacedInfo.index)) {
    lastPlacedInfo = null;
  }

  currentScore += 20;
  if (scoreEl) scoreEl.innerText = currentScore;

  // Re-evaluating here (rather than waiting for the next placement) is what drops an
  // intersecting word's highlight the instant its shared letter is cleared away.
  refreshTopUpBoardState();

  // Reopen the queue gate now that the board has room again.
  if (typeof setNextLetter === 'function') setNextLetter();
});
