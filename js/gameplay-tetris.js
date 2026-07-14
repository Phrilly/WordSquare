// ================================
// TETRIS VARIANT (DROP ROW + GRAVITY)
// ================================

let pendingDropColumn = null;

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
    const blocked = Boolean(cells[topIdx]);
    slot.classList.toggle('is-blocked', blocked);
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
    cellEl.classList.remove('hover-3', 'hover-4', 'hover-5', 'word-3', 'word-4', 'word-5', 'is-undoable', 'tile-pop');

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

function collectMatchedWordIndices() {
  const dirs = [[0,1], [0,-1], [1,0], [-1,0], [1,1], [-1,-1], [-1,1], [1,-1]];
  const matched = new Set();

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
            path.forEach((pIdx) => matched.add(pIdx));
          }
        }
      }
    }
  }

  return Array.from(matched);
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

function resolveTetrisClears() {
  if (!isTetrisMode()) return;

  let loopGuard = 0;
  while (loopGuard < 12) {
    const toClear = collectMatchedWordIndices();
    if (toClear.length === 0) break;

    toClear.forEach((idx) => {
      cells[idx] = '';
      wildcardState[idx] = false;
    });

    applyGravity();
    loopGuard++;
  }

  placedCount = cells.reduce((count, letter) => count + (letter ? 1 : 0), 0);
  refreshBoardFromState();
  syncDropSlots();
  calculateRealTimeScoreLocal();
}

function ensureDeckBufferForTetris() {
  if (!isTetrisMode()) return;
  if (typeof generateBagSequence !== 'function' || !Array.isArray(gameDeck)) return;

  if ((gameDeck.length - currentDeckIndex) < 4) {
    gameDeck = gameDeck.concat(generateBagSequence());
  }
}

function handleDropClick(col) {
  if (!isTetrisMode() || isGameOver) return;

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

document.addEventListener('ws:tilePlaced', () => {
  if (!isTetrisMode()) return;

  resolveTetrisClears();

  if (placedCount >= 25) {
    triggerEndGame();
    return;
  }

  ensureDeckBufferForTetris();
  currentDeckIndex++;
  setNextLetter();
});

document.addEventListener('ws:beforeInit', () => {
  if (!isTetrisMode()) return;
  pendingDropColumn = null;
});
