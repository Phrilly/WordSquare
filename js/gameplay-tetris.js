// ================================
// TETRIS VARIANT (DROP ROW + GRAVITY)
// ================================

let pendingDropColumn = null;
let tetrisBusy = false;
let tetrisBombsRemaining = 3;

const TETRIS_CLEAR_PREVIEW_MS = 380;
const TETRIS_LOAD_MS = 220;
const TETRIS_LOADED_SETTLE_MS = 380;
const TETRIS_LOADED_COLOR_SHIFT_MS = 320;
const TETRIS_LOADED_FINAL_HOLD_MS = 360;
const TETRIS_DROP_MS = 1320;

function isTetrisMode() {
  return Boolean(window.GAME_CONFIG && window.GAME_CONFIG.isTetrisDay);
}

function getDropRowEl() {
  return document.getElementById('tetris-drop-row');
}

function getDropSlots() {
  const row = getDropRowEl();
  return row ? Array.from(row.querySelectorAll('.drop-slot')) : [];
}

function getDropSlot(col) {
  return getDropSlots()[col] || null;
}

function getBombIndicatorEl() {
  return document.getElementById('tetris-bomb-indicator');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findDropTargetIndex(col) {
  for (let row = gridSize - 1; row >= 0; row--) {
    const idx = (row * gridSize) + col;
    if (!cells[idx]) {
      return idx;
    }
  }
  return -1;
}

function syncTetrisQueueUI() {
  if (!isTetrisMode()) return;

  const queueContainer = document.getElementById('queue-container');
  const nextLetter = document.getElementById('next-letter');
  const q1 = document.getElementById('queue-1');
  const q2 = document.getElementById('queue-2');

  if (nextLetter) nextLetter.style.display = 'inline-flex';
  if (queueContainer) queueContainer.classList.add('is-active');

  if (q1) {
    q1.classList.toggle('is-active', (q1.innerText || '').trim() !== '');
  }
  if (q2) {
    q2.classList.toggle('is-active', (q2.innerText || '').trim() !== '');
  }
}

function syncDropSlots() {
  if (!isTetrisMode()) return;

  const slots = getDropSlots();
  slots.forEach((slot, col) => {
    const topIdx = col;
    const blocked = Boolean(cells[topIdx]) || tetrisBusy;
    slot.classList.toggle('is-blocked', Boolean(cells[topIdx]));
    slot.disabled = blocked;
  });
}

function syncTetrisBombUI() {
  if (!isTetrisMode()) return;

  const toolsRow = document.getElementById('tetris-tools-row');
  const bombIndicator = getBombIndicatorEl();
  if (toolsRow) toolsRow.classList.add('is-active');
  if (bombIndicator) {
    bombIndicator.classList.toggle('is-empty', tetrisBombsRemaining <= 0);
    const bombIcons = bombIndicator.querySelectorAll('.tetris-bomb-icon');
    bombIcons.forEach((icon, index) => {
      const spent = index >= tetrisBombsRemaining;
      icon.classList.toggle('is-spent', spent);
    });
  }
}

function setSlotLoadedLetter(slot, letter) {
  if (!slot) return;
  slot.dataset.loadedLetter = letter;
  slot.classList.add('is-loading');
}

function sealLoadedSlot(slot) {
  if (!slot) return;
  slot.classList.add('is-sealed');
}

function clearSlotLoadedLetter(slot) {
  if (!slot) return;
  delete slot.dataset.loadedLetter;
  slot.classList.remove('is-loading');
  slot.classList.remove('is-sealed');
  slot.classList.remove('is-drop-ready');
  slot.classList.remove('is-engaged');
}

function triggerColumnImpact(col, targetIdx) {
  const slot = getDropSlot(col);
  if (slot) {
    slot.classList.remove('impact-rattle');
    void slot.offsetWidth;
    slot.classList.add('impact-rattle');
    setTimeout(() => slot.classList.remove('impact-rattle'), 360);
  }

  if (!gridEl) return;
  const cellEls = gridEl.querySelectorAll('.grid-cell:not(.alpha-cell)');
  for (let row = 0; row < gridSize; row++) {
    const idx = (row * gridSize) + col;
    const cellEl = cellEls[idx];
    if (!cellEl) continue;
    cellEl.classList.remove('tetris-column-impact');
    void cellEl.offsetWidth;
    cellEl.classList.add('tetris-column-impact');
    if (idx === targetIdx) {
      cellEl.classList.add('tetris-impact-hit');
    } else {
      cellEl.classList.remove('tetris-impact-hit');
    }
    setTimeout(() => {
      cellEl.classList.remove('tetris-column-impact', 'tetris-impact-hit');
    }, 360);
  }
}

function refreshBoardFromState() {
  if (!gridEl) return;

  const cellEls = gridEl.querySelectorAll('.grid-cell:not(.alpha-cell)');
  for (let i = 0; i < 25; i++) {
    const cellEl = cellEls[i];
    if (!cellEl) continue;

    const letter = cells[i] || '';
    cellEl.classList.remove('hover-3', 'hover-4', 'hover-5', 'word-3', 'word-4', 'word-5', 'is-undoable', 'tile-pop', 'tetris-clear-preview');

    if (letter) {
      cellEl.innerText = letter;
      cellEl.dataset.letter = letter;
      if (wildcardState[i]) {
        cellEl.classList.add('is-wildcard');
      } else {
        cellEl.classList.remove('is-wildcard');
      }
    } else {
      cellEl.innerText = '';
      delete cellEl.dataset.letter;
      cellEl.classList.remove('is-wildcard');
    }
  }
}

function getTetrisWordScore(wordLength) {
  if (wordLength === 5) return 20;
  if (wordLength === 4) return 5;
  return 0;
}

function createMatchedWordResult() {
  const dirs = [[0,1], [0,-1], [1,0], [-1,0], [1,1], [-1,-1], [-1,1], [1,-1]];
  const matchedMap = new Map();
  const canonicalWords = new Set();

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      for (const dir of dirs) {
        let word = '';
        const path = [];

        for (let step = 0; step < 5; step++) {
          const nr = r + (dir[0] * step);
          const nc = c + (dir[1] * step);
          if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize) break;

          const idx = (nr * gridSize) + nc;
          const letter = cells[idx];
          if (!letter) break;

          word += letter;
          path.push(idx);

          if (word.length >= 4 && gameDictionary.has(word)) {
            const reversed = word.split('').reverse().join('');
            canonicalWords.add(word < reversed ? word : reversed);
            path.forEach((pIdx) => {
              const existing = matchedMap.get(pIdx) || 0;
              matchedMap.set(pIdx, Math.max(existing, word.length));
            });
          }
        }
      }
    }
  }

  let scoreGain = 0;
  canonicalWords.forEach((word) => {
    scoreGain += getTetrisWordScore(word.length);
  });

  return { matchedMap, scoreGain };
}

function collectMatchedWordIndices() {
  return Array.from(createMatchedWordResult().matchedMap.keys());
}

function applyGravity() {
  for (let col = 0; col < gridSize; col++) {
    const stack = [];
    for (let row = 0; row < gridSize; row++) {
      const idx = (row * gridSize) + col;
      if (cells[idx]) {
        stack.push({ letter: cells[idx], isWildcard: Boolean(wildcardState[idx]) });
      }
    }

    for (let row = gridSize - 1; row >= 0; row--) {
      const idx = (row * gridSize) + col;
      if (stack.length > 0) {
        const next = stack.pop();
        cells[idx] = next.letter;
        wildcardState[idx] = next.isWildcard;
      } else {
        cells[idx] = '';
        wildcardState[idx] = false;
      }
    }
  }
}

function applyGravityToColumn(col) {
  const stack = [];
  for (let row = 0; row < gridSize; row++) {
    const idx = (row * gridSize) + col;
    if (cells[idx]) {
      stack.push({ letter: cells[idx], isWildcard: Boolean(wildcardState[idx]) });
    }
  }

  for (let row = gridSize - 1; row >= 0; row--) {
    const idx = (row * gridSize) + col;
    if (stack.length > 0) {
      const next = stack.pop();
      cells[idx] = next.letter;
      wildcardState[idx] = next.isWildcard;
    } else {
      cells[idx] = '';
      wildcardState[idx] = false;
    }
  }
}

function showComboFeedback(comboCount) {
  if (!gridEl || comboCount <= 1) return;

  const label = document.createElement('div');
  label.className = 'tetris-combo-banner';
  label.textContent = `COMBO x${comboCount}`;
  gridEl.appendChild(label);
  setTimeout(() => label.remove(), 900);
}

function showScoreGainFeedback(scoreGain, matchedMap) {
  if (!gridEl || scoreGain <= 0) return;

  const label = document.createElement('div');
  label.className = 'tetris-score-banner';
  label.textContent = `+${scoreGain}`;

  if (matchedMap && matchedMap.size > 0) {
    const cellEls = gridEl.querySelectorAll('.grid-cell:not(.alpha-cell)');
    let totalX = 0;
    let totalY = 0;
    let count = 0;

    matchedMap.forEach((_, idx) => {
      const cellEl = cellEls[idx];
      if (!cellEl) return;
      const cellRect = cellEl.getBoundingClientRect();
      const gridRect = gridEl.getBoundingClientRect();
      totalX += (cellRect.left - gridRect.left) + (cellRect.width / 2);
      totalY += (cellRect.top - gridRect.top) + (cellRect.height / 2);
      count++;
    });

    if (count > 0) {
      label.style.left = `${totalX / count}px`;
      label.style.top = `${Math.max(18, (totalY / count) - 12)}px`;
    }
  }

  gridEl.appendChild(label);
  setTimeout(() => label.remove(), 950);
}

async function animateDropToCell(col, targetIdx, letter) {
  const sourceSlot = getDropSlot(col);
  const targetCell = document.querySelector(`.grid-cell[data-index='${targetIdx}']`);
  if (!sourceSlot || !targetCell) return;

  const sourceRect = sourceSlot.getBoundingClientRect();
  const targetRect = targetCell.getBoundingClientRect();
  const animTile = document.createElement('div');
  animTile.className = 'tetris-falling-tile';
  animTile.textContent = letter;
  animTile.style.width = `${sourceRect.width}px`;
  animTile.style.height = `${sourceRect.height}px`;
  animTile.style.left = `${sourceRect.left + (sourceRect.width / 2)}px`;
  animTile.style.top = `${sourceRect.top + (sourceRect.height / 2)}px`;
  animTile.style.setProperty('--drop-x', `${(targetRect.left + (targetRect.width / 2)) - (sourceRect.left + (sourceRect.width / 2))}px`);
  animTile.style.setProperty('--drop-y', `${(targetRect.top + (targetRect.height / 2)) - (sourceRect.top + (sourceRect.height / 2))}px`);
  animTile.classList.add('is-drop');
  animTile.style.animationDuration = `${TETRIS_DROP_MS}ms`;
  document.body.appendChild(animTile);

  await delay(TETRIS_DROP_MS);
  animTile.remove();
  triggerColumnImpact(col, targetIdx);
}

async function animateLoadIntoSlot(col, letter) {
  const slot = getDropSlot(col);
  const nextLetterEl = document.getElementById('next-letter');
  if (!slot || !nextLetterEl) return;

  slot.classList.add('is-engaged');

  const sourceRect = nextLetterEl.getBoundingClientRect();
  const targetRect = slot.getBoundingClientRect();
  const animTile = document.createElement('div');
  animTile.className = 'tetris-falling-tile is-load';
  animTile.textContent = letter;
  animTile.style.width = `${targetRect.width}px`;
  animTile.style.height = `${targetRect.height}px`;
  animTile.style.left = `${sourceRect.left + (sourceRect.width / 2)}px`;
  animTile.style.top = `${sourceRect.top + (sourceRect.height / 2)}px`;
  animTile.style.setProperty('--drop-x', `${(targetRect.left + (targetRect.width / 2)) - (sourceRect.left + (sourceRect.width / 2))}px`);
  animTile.style.setProperty('--drop-y', `${(targetRect.top + (targetRect.height / 2)) - (sourceRect.top + (sourceRect.height / 2))}px`);
  animTile.style.animationDuration = `${TETRIS_LOAD_MS}ms`;
  document.body.appendChild(animTile);

  await delay(TETRIS_LOAD_MS);
  animTile.remove();
  setSlotLoadedLetter(slot, letter);
  await delay(TETRIS_LOADED_SETTLE_MS);
  sealLoadedSlot(slot);
  await delay(TETRIS_LOADED_COLOR_SHIFT_MS);
  slot.classList.add('is-drop-ready');
  await delay(TETRIS_LOADED_FINAL_HOLD_MS);
  slot.classList.remove('is-drop-ready');
}

function paintMatchedPreview(matchedMap) {
  if (!gridEl) return;
  const cellEls = gridEl.querySelectorAll('.grid-cell:not(.alpha-cell)');
  matchedMap.forEach((len, idx) => {
    const cellEl = cellEls[idx];
    if (!cellEl) return;
    cellEl.classList.remove('word-3', 'word-4', 'word-5');
    cellEl.classList.add(`word-${len}`);
    cellEl.classList.add('tetris-clear-preview');
  });
}

function clearMatchedPreview() {
  if (!gridEl) return;
  const cellEls = gridEl.querySelectorAll('.grid-cell:not(.alpha-cell)');
  cellEls.forEach((cellEl) => {
    cellEl.classList.remove('tetris-clear-preview');
  });
}

async function resolveTetrisClears() {
  if (!isTetrisMode()) return;

  let loopGuard = 0;
  let comboCount = 0;

  while (loopGuard < 12) {
    const matchedResult = createMatchedWordResult();
    const toClear = Array.from(matchedResult.matchedMap.keys());
    if (toClear.length === 0) break;

    comboCount++;
    currentScore += matchedResult.scoreGain;
    if (scoreEl) scoreEl.innerText = currentScore;
    showScoreGainFeedback(matchedResult.scoreGain, matchedResult.matchedMap);
    paintMatchedPreview(matchedResult.matchedMap);
    calculateRealTimeScoreLocal();
    await delay(TETRIS_CLEAR_PREVIEW_MS);

    toClear.forEach((idx) => {
      cells[idx] = '';
      wildcardState[idx] = false;
    });

    clearMatchedPreview();
    applyGravity();
    refreshBoardFromState();
    loopGuard++;
  }

  placedCount = cells.reduce((count, letter) => count + (letter ? 1 : 0), 0);
  refreshBoardFromState();
  syncDropSlots();
  calculateRealTimeScoreLocal();
  showComboFeedback(comboCount);
}

function ensureDeckBufferForTetris() {
  if (!isTetrisMode()) return;
  if (typeof generateBagSequence !== 'function' || !Array.isArray(gameDeck)) return;

  if ((gameDeck.length - currentDeckIndex) < 4) {
    gameDeck = gameDeck.concat(generateBagSequence());
  }
}

async function handleDropClick(col) {
  if (!isTetrisMode() || isGameOver || tetrisBusy) return;

  const targetIdx = findDropTargetIndex(col);
  if (targetIdx < 0) {
    syncDropSlots();
    return;
  }

  ensureDeckBufferForTetris();

  const nextLetterEl = document.getElementById('next-letter');
  if (!nextLetterEl || !nextLetterEl.innerText) return;

  const letter = nextLetterEl.innerText;
  const cellEl = document.querySelector(`.grid-cell[data-index='${targetIdx}']`);

  if (letter === '?') {
    pendingDropColumn = col;
    pendingCellIndex = targetIdx;
    if (typeof updateWildcardModal === 'function') updateWildcardModal();
    if (typeof alphabetModal !== 'undefined' && alphabetModal) {
      alphabetModal.classList.add('active');
    }
    return;
  }

  const slot = getDropSlot(col);
  if (slot) slot.classList.add('is-engaged');
  tetrisBusy = true;
  syncDropSlots();
  await animateLoadIntoSlot(col, letter);
  await animateDropToCell(col, targetIdx, letter);
  clearSlotLoadedLetter(getDropSlot(col));
  placeLetter(targetIdx, letter, cellEl, false);
}

document.addEventListener('ws:afterInit', () => {
  if (!isTetrisMode()) return;

  const row = getDropRowEl();
  if (row) {
    row.classList.add('is-active');
    const slots = getDropSlots();
    slots.forEach((slot) => {
      const col = Number(slot.dataset.col || '-1');
      slot.onclick = () => {
        if (col >= 0 && col < gridSize) {
          handleDropClick(col);
        }
      };
    });
  }

  if (topBarEl) topBarEl.classList.add('tetris-mode');
  syncTetrisQueueUI();
  syncDropSlots();
  syncTetrisBombUI();
});

document.addEventListener('ws:nextLetterUpdated', () => {
  if (!isTetrisMode()) return;
  syncTetrisQueueUI();
  syncDropSlots();
  syncTetrisBombUI();
});

document.addEventListener('ws:applyHover', (e) => {
  if (!isTetrisMode()) return;
  e.preventDefault();
});

document.addEventListener('ws:cellClick', (e) => {
  if (!isTetrisMode()) return;
  e.preventDefault();
});

document.addEventListener('ws:occupiedCellClick', async (e) => {
  if (!isTetrisMode() || isGameOver || tetrisBusy) return;
  if (tetrisBombsRemaining <= 0) return;

  const index = e.detail.index;
  const cellEl = e.detail.cellEl;
  if (!cellEl || !cells[index]) return;

  const col = index % gridSize;
  tetrisBusy = true;
  tetrisBombsRemaining--;
  syncDropSlots();
  syncTetrisBombUI();

  cellEl.classList.add('tetris-bomb-hit');
  await delay(180);
  cellEl.classList.remove('tetris-bomb-hit');

  cells[index] = '';
  wildcardState[index] = false;
  applyGravityToColumn(col);
  refreshBoardFromState();
  await resolveTetrisClears();

  placedCount = cells.reduce((count, letter) => count + (letter ? 1 : 0), 0);
  if (placedCount >= 25) {
    tetrisBusy = false;
    syncDropSlots();
    triggerEndGame();
    return;
  }

  tetrisBusy = false;
  syncDropSlots();
  syncTetrisBombUI();
});

document.addEventListener('ws:beforeWildcardPlaced', (e) => {
  if (!isTetrisMode()) return;
  if (pendingDropColumn == null) return;

  e.preventDefault();

  const index = e.detail.index;
  const letter = e.detail.letter;
  const cellEl = e.detail.cellEl;
  const dropCol = pendingDropColumn;
  pendingDropColumn = null;

  tetrisBusy = true;
  syncDropSlots();
  (async () => {
    await animateLoadIntoSlot(dropCol, letter);
    await animateDropToCell(dropCol, index, letter);
    clearSlotLoadedLetter(getDropSlot(dropCol));
    placeLetter(index, letter, cellEl, true);
  })();
});

document.addEventListener('ws:tilePlaced', async () => {
  if (!isTetrisMode()) return;

  await resolveTetrisClears();

  if (placedCount >= 25) {
    tetrisBusy = false;
    syncDropSlots();
    triggerEndGame();
    return;
  }

  ensureDeckBufferForTetris();
  currentDeckIndex++;
  setNextLetter();
  tetrisBusy = false;
  syncDropSlots();
  syncTetrisBombUI();
});

document.addEventListener('ws:calculateScore', (e) => {
  if (!isTetrisMode()) return;
  e.preventDefault();
  if (scoreEl) scoreEl.innerText = currentScore;
});

document.addEventListener('ws:beforeInit', () => {
  if (!isTetrisMode()) return;
  pendingDropColumn = null;
  tetrisBusy = false;
  tetrisBombsRemaining = 3;
  currentScore = 0;
  if (scoreEl) scoreEl.innerText = '0';
  syncTetrisBombUI();
});
