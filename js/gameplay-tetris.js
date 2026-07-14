// ================================
// TETRIS VARIANT (DROP ROW + GRAVITY)
// ================================

let pendingDropColumn = null;
let tetrisBusy = false;

const TETRIS_CLEAR_PREVIEW_MS = 380;
const TETRIS_DROP_MS = 180;

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

function createMatchedWordMap() {
  const dirs = [[0,1], [0,-1], [1,0], [-1,0], [1,1], [-1,-1], [-1,1], [1,-1]];
  const matchedMap = new Map();

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

          if (word.length >= 3 && gameDictionary.has(word)) {
            path.forEach((pIdx) => {
              const existing = matchedMap.get(pIdx) || 0;
              matchedMap.set(pIdx, Math.max(existing, word.length));
            });
          }
        }
      }
    }
  }

  return matchedMap;
}

function collectMatchedWordIndices() {
  return Array.from(createMatchedWordMap().keys());
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

function showComboFeedback(comboCount) {
  if (!gridEl || comboCount <= 1) return;

  const label = document.createElement('div');
  label.className = 'tetris-combo-banner';
  label.textContent = `COMBO x${comboCount}`;
  gridEl.appendChild(label);
  setTimeout(() => label.remove(), 900);
}

async function animateDropToCell(col, targetIdx, letter) {
  const slots = getDropSlots();
  const sourceSlot = slots[col];
  const targetCell = document.querySelector(`.grid-cell[data-index='${targetIdx}']`);
  if (!sourceSlot || !targetCell) return;

  const sourceRect = sourceSlot.getBoundingClientRect();
  const targetRect = targetCell.getBoundingClientRect();
  const animTile = document.createElement('div');
  animTile.className = 'tetris-falling-tile';
  animTile.textContent = letter;
  animTile.style.left = `${sourceRect.left + (sourceRect.width / 2)}px`;
  animTile.style.top = `${sourceRect.top + (sourceRect.height / 2)}px`;
  animTile.style.setProperty('--drop-x', `${(targetRect.left + (targetRect.width / 2)) - (sourceRect.left + (sourceRect.width / 2))}px`);
  animTile.style.setProperty('--drop-y', `${(targetRect.top + (targetRect.height / 2)) - (sourceRect.top + (sourceRect.height / 2))}px`);
  animTile.style.animationDuration = `${TETRIS_DROP_MS}ms`;
  document.body.appendChild(animTile);

  await delay(TETRIS_DROP_MS);
  animTile.remove();
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
    const matchedMap = createMatchedWordMap();
    const toClear = Array.from(matchedMap.keys());
    if (toClear.length === 0) break;

    comboCount++;
    paintMatchedPreview(matchedMap);
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

  tetrisBusy = true;
  syncDropSlots();
  await animateDropToCell(col, targetIdx, letter);
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
});

document.addEventListener('ws:nextLetterUpdated', () => {
  if (!isTetrisMode()) return;
  syncTetrisQueueUI();
  syncDropSlots();
});

document.addEventListener('ws:applyHover', (e) => {
  if (!isTetrisMode()) return;
  e.preventDefault();
});

document.addEventListener('ws:cellClick', (e) => {
  if (!isTetrisMode()) return;
  e.preventDefault();
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
    await animateDropToCell(dropCol, index, letter);
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
});

document.addEventListener('ws:beforeInit', () => {
  if (!isTetrisMode()) return;
  pendingDropColumn = null;
  tetrisBusy = false;
});
