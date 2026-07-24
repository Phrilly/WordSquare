// ================================
// TETRIS VARIANT (DROP ROW + GRAVITY)
// ================================

let tetrisBusy = false;
let tetrisBombsRemaining = 3;

const TETRIS_CLEAR_PREVIEW_MS = 380;
const TETRIS_DROP_MS = 1320;
const TETRIS_START_CLOCK_MS = 10000;
const TETRIS_MIN_CLOCK_MS = 2800;
const TETRIS_CLOCK_STEP_MS = 100;
const TETRIS_START_SWEEP_MS = 800;
const TETRIS_MIN_SWEEP_MS = 320;
const TETRIS_SWEEP_STEP_MS = 0;
const TETRIS_DIRECTIONAL_SPEED_MIN = 1;
const TETRIS_DIRECTIONAL_SPEED_MAX = 2;
const TETRIS_DIRECTIONAL_SPEED_STEP = 0.25;
const TETRIS_BALLOON_PULSE_MS = 500;

let tetrisSweepColumn = 0;
let tetrisSweepDirection = 1;
let tetrisMoveTimer = null;
let tetrisClockTimer = null;
let tetrisBalloonTimer = null;
let tetrisClockDeadline = 0;
let tetrisRoundToken = 0;
let tetrisActiveLetter = '';
let tetrisActiveTone = 'green';
let tetrisSuccessfulPlacements = 0;
let tetrisTurnIndex = 0;
let tetrisGameplayArmed = false;
let tetrisDirectionalSpeed = TETRIS_DIRECTIONAL_SPEED_MIN;
let tetrisSpeedControlsBound = false;
let tetrisSessionToken = 0;

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

function getTetrisClockEl() {
  return document.getElementById('tetris-clock');
}

function getTetrisClockValueEl() {
  return document.getElementById('tetris-clock-value');
}

function getTetrisActiveTileEl() {
  return document.getElementById('tetris-active-tile');
}

function getSpeedValueEl() {
  return document.getElementById('speed-value');
}

function getSpeedLeftBtn() {
  return document.getElementById('speed-left-btn');
}

function getSpeedRightBtn() {
  return document.getElementById('speed-right-btn');
}

function clampTetrisDirectionalSpeed(multiplier) {
  return Math.max(TETRIS_DIRECTIONAL_SPEED_MIN, Math.min(TETRIS_DIRECTIONAL_SPEED_MAX, multiplier));
}

function updateTetrisSpeedControlsUI() {
  const valueEl = getSpeedValueEl();
  const leftBtn = getSpeedLeftBtn();
  const rightBtn = getSpeedRightBtn();

  if (valueEl) {
    const formatted = Number.isInteger(tetrisDirectionalSpeed)
      ? String(tetrisDirectionalSpeed)
      : String(tetrisDirectionalSpeed).replace(/\.0+$/, '');
    valueEl.textContent = `x${formatted}`;
  }
  if (leftBtn) {
    leftBtn.disabled = tetrisSweepDirection >= 0 || tetrisDirectionalSpeed >= TETRIS_DIRECTIONAL_SPEED_MAX;
  }
  if (rightBtn) {
    rightBtn.disabled = tetrisSweepDirection <= 0 || tetrisDirectionalSpeed >= TETRIS_DIRECTIONAL_SPEED_MAX;
  }
}

function startOrRestartTetrisSweepTimer(token, sweepMs) {
  if (tetrisMoveTimer) {
    clearInterval(tetrisMoveTimer);
    tetrisMoveTimer = null;
  }

  tetrisMoveTimer = setInterval(() => {
    if (token !== tetrisRoundToken || tetrisBusy || isGameOver) return;

    let hitEdge = false;

    if (tetrisSweepDirection > 0 && tetrisSweepColumn >= (gridSize - 1)) {
      tetrisSweepDirection = -1;
      hitEdge = true;
    } else if (tetrisSweepDirection < 0 && tetrisSweepColumn <= 0) {
      tetrisSweepDirection = 1;
      hitEdge = true;
    }

    if (hitEdge) {
      tetrisDirectionalSpeed = TETRIS_DIRECTIONAL_SPEED_MIN;
      updateTetrisSpeedControlsUI();
      const resetSweepMs = getTetrisSweepStepMs(Math.max(0, tetrisTurnIndex - 1));
      startOrRestartTetrisSweepTimer(token, resetSweepMs);
      syncTetrisActiveSlot(tetrisActiveLetter);
      return;
    }

    tetrisSweepColumn += tetrisSweepDirection;
    if (tetrisSweepColumn < 0) tetrisSweepColumn = 0;
    if (tetrisSweepColumn > (gridSize - 1)) tetrisSweepColumn = gridSize - 1;
    syncTetrisActiveSlot(tetrisActiveLetter);
  }, sweepMs);
}

function retimeActiveTetrisSweep() {
  if (!isTetrisMode() || isGameOver || tetrisBusy) return;
  if (!tetrisGameplayArmed || !tetrisActiveLetter) return;

  const sweepMs = getTetrisSweepStepMs(Math.max(0, tetrisTurnIndex - 1));
  startOrRestartTetrisSweepTimer(tetrisRoundToken, sweepMs);
}

function setTetrisDirectionalSpeed(nextSpeed) {
  const clamped = clampTetrisDirectionalSpeed(nextSpeed);
  if (clamped === tetrisDirectionalSpeed) {
    updateTetrisSpeedControlsUI();
    return;
  }

  tetrisDirectionalSpeed = clamped;

  updateTetrisSpeedControlsUI();
  retimeActiveTetrisSweep();
}

function resetTetrisDirectionalSpeed() {
  tetrisDirectionalSpeed = TETRIS_DIRECTIONAL_SPEED_MIN;
  updateTetrisSpeedControlsUI();
}

function nudgeTetrisDirectionalSpeed(direction) {
  if (tetrisSweepDirection !== direction) return;
  setTetrisDirectionalSpeed(tetrisDirectionalSpeed + TETRIS_DIRECTIONAL_SPEED_STEP);
}

function bindTetrisSpeedControls() {
  if (tetrisSpeedControlsBound) return;

  const leftBtn = getSpeedLeftBtn();
  const rightBtn = getSpeedRightBtn();
  if (!leftBtn || !rightBtn) return;

  leftBtn.addEventListener('click', () => {
    nudgeTetrisDirectionalSpeed(-1);
  });

  rightBtn.addEventListener('click', () => {
    nudgeTetrisDirectionalSpeed(1);
  });

  tetrisSpeedControlsBound = true;
  updateTetrisSpeedControlsUI();
}

function getTetrisRoundClockMs() {
  return Math.max(TETRIS_MIN_CLOCK_MS, TETRIS_START_CLOCK_MS - (tetrisTurnIndex * TETRIS_CLOCK_STEP_MS));
}

function getTetrisSweepStepMs(turnIndex = tetrisTurnIndex) {
  const base = Math.max(TETRIS_MIN_SWEEP_MS, TETRIS_START_SWEEP_MS - (turnIndex * TETRIS_SWEEP_STEP_MS));
  return Math.max(1, Math.round(base / tetrisDirectionalSpeed));
}

function formatTetrisClock(ms) {
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}

function reportTetrisInvariant(code, details) {
  console.error(`[Tetris invariant:${code}]`, details);
}

// --- Balloon pulse (0.5s inflate cycle on the active tile) ---
function startTetrisBalloonPulse() {
  stopTetrisBalloonPulse();
  const tileEl = getTetrisActiveTileEl();
  if (!tileEl) return;

  tetrisBalloonTimer = setInterval(() => {
    tileEl.classList.remove('is-pulsing');
    void tileEl.offsetWidth;
    tileEl.classList.add('is-pulsing');
    tileEl.classList.add('is-inflated');
  }, TETRIS_BALLOON_PULSE_MS);
}

function stopTetrisBalloonPulse() {
  if (tetrisBalloonTimer) {
    clearInterval(tetrisBalloonTimer);
    tetrisBalloonTimer = null;
  }
  const tileEl = getTetrisActiveTileEl();
  if (tileEl) {
    tileEl.classList.remove('is-pulsing', 'is-inflated');
  }
}

function claimNextTetrisLetterForBar() {
  if (!isTetrisMode()) return '';

  ensureDeckBufferForTetris();
  if (!Array.isArray(gameDeck) || gameDeck.length === 0) {
    reportTetrisInvariant('queue-empty-before-claim', { currentDeckIndex });
    return '';
  }

  if (currentDeckIndex >= gameDeck.length) {
    triggerEndGame();
    return '';
  }

  const deckIndexBefore = currentDeckIndex;
  const letter = gameDeck[currentDeckIndex] || '';
  currentDeckIndex++;

  if (currentDeckIndex !== (deckIndexBefore + 1)) {
    reportTetrisInvariant('queue-claim-index-mismatch', {
      deckIndexBefore,
      deckIndexAfter: currentDeckIndex,
    });
  }

  renderNextLetterWindow();
  syncTetrisQueueUI();

  return letter;
}

function validateTetrisClockState(context) {
  if (!isTetrisMode()) return;

  if (tetrisSuccessfulPlacements < 0 || !Number.isInteger(tetrisSuccessfulPlacements)) {
    console.error(`[Tetris clock invariant] invalid placement counter in ${context}`, tetrisSuccessfulPlacements);
    tetrisSuccessfulPlacements = 0;
  }

  if (tetrisTurnIndex < 0 || !Number.isInteger(tetrisTurnIndex)) {
    console.error(`[Tetris clock invariant] invalid turn counter in ${context}`, tetrisTurnIndex);
    tetrisTurnIndex = 0;
  }

  if (tetrisTurnIndex === 0 && tetrisSuccessfulPlacements !== 0) {
    reportTetrisInvariant('clock-first-round-counter', {
      context,
      tetrisTurnIndex,
      tetrisSuccessfulPlacements,
    });
    tetrisSuccessfulPlacements = 0;
  }

  if (!tetrisGameplayArmed && tetrisTurnIndex > 0) {
    reportTetrisInvariant('clock-started-before-gameplay-armed', {
      context,
      tetrisTurnIndex,
      tetrisGameplayArmed,
    });
    tetrisTurnIndex = 0;
    tetrisSuccessfulPlacements = 0;
  }
}

function clearTetrisRoundTimers() {
  if (tetrisMoveTimer) {
    clearInterval(tetrisMoveTimer);
    tetrisMoveTimer = null;
  }
  if (tetrisClockTimer) {
    clearInterval(tetrisClockTimer);
    tetrisClockTimer = null;
  }
}

function setTetrisClockDisplay(remainingMs, roundMs) {
  const clockEl = getTetrisClockEl();
  const clockValueEl = getTetrisClockValueEl();
  if (!clockEl || !clockValueEl) return;

  if (remainingMs <= 3000) {
    clockEl.classList.add('is-urgent');
  } else {
    clockEl.classList.remove('is-urgent');
  }

  if (roundMs > 0) {
    const ratio = Math.max(0, Math.min(1, remainingMs / roundMs));
    clockEl.style.setProperty('--tetris-clock-progress', String(ratio));
    if (ratio <= 1 / 3) {
      tetrisActiveTone = 'red';
    } else if (ratio <= 2 / 3) {
      tetrisActiveTone = 'amber';
    } else {
      tetrisActiveTone = 'green';
    }
  }

  clockValueEl.textContent = formatTetrisClock(remainingMs);
  const tileEl = getTetrisActiveTileEl();
  if (tileEl) {
    tileEl.textContent = tetrisActiveLetter || '';
    tileEl.classList.toggle('is-tone-green', tetrisActiveTone === 'green');
    tileEl.classList.toggle('is-tone-amber', tetrisActiveTone === 'amber');
    tileEl.classList.toggle('is-tone-red', tetrisActiveTone === 'red');
  }
  syncTetrisActiveSlot(tetrisActiveLetter);
}

function syncTetrisActiveSlot(letter) {
  if (!isTetrisMode()) return;

  const slots = getDropSlots();
  slots.forEach((slot, col) => {
    const active = col === tetrisSweepColumn && !tetrisBusy;
    slot.classList.toggle('is-sweep-active', active);
    slot.classList.toggle('is-tone-green', active && tetrisActiveTone === 'green');
    slot.classList.toggle('is-tone-amber', active && tetrisActiveTone === 'amber');
    slot.classList.toggle('is-tone-red', active && tetrisActiveTone === 'red');
    slot.disabled = tetrisBusy;
  });
}

function isAnyTetrisColumnFull() {
  for (let col = 0; col < gridSize; col++) {
    if (cells[col]) {
      return true;
    }
  }
  return false;
}

function endTetrisIfAnyColumnFull(context) {
  if (!isTetrisMode() || isGameOver) return false;

  if (!isAnyTetrisColumnFull()) return false;

  console.error(`[Tetris stop condition] ending game because a column is full in ${context}`);
  clearTetrisRoundTimers();
  stopTetrisBalloonPulse();
  tetrisBusy = false;
  syncDropSlots();
  triggerEndGame();
  return true;
}

function finalizeTetrisTurn(context) {
  if (!isTetrisMode() || isGameOver) return;

  if (endTetrisIfAnyColumnFull(context)) {
    return;
  }

  if (placedCount >= 25) {
    clearTetrisRoundTimers();
    stopTetrisBalloonPulse();
    tetrisBusy = false;
    syncDropSlots();
    triggerEndGame();
  }
}

function advanceTetrisPreviewQueue() {
  if (!isTetrisMode()) return;
  if (!Array.isArray(gameDeck) || gameDeck.length === 0) return;

  currentDeckIndex++;
  if (currentDeckIndex >= gameDeck.length) {
    triggerEndGame();
    return;
  }

  renderNextLetterWindow();
  syncTetrisQueueUI();
}

function startTetrisRound() {
  if (!isTetrisMode() || isGameOver || tetrisBusy) return;
  if (!tetrisGameplayArmed) {
    clearTetrisRoundTimers();
    return;
  }

  const letter = claimNextTetrisLetterForBar();
  if (!letter) return;

  validateTetrisClockState('startTetrisRound');
  tetrisActiveLetter = letter;

  const thisTurnIndex = tetrisTurnIndex;
  tetrisTurnIndex++;

  getDropSlots().forEach((slot) => clearSlotLoadedLetter(slot));

  clearTetrisRoundTimers();
  tetrisRoundToken++;
  const token = tetrisRoundToken;
  tetrisSweepColumn = 0;
  tetrisSweepDirection = 1;
  resetTetrisDirectionalSpeed();

  syncTetrisActiveSlot(tetrisActiveLetter);
  startTetrisBalloonPulse();

  const roundMs = Math.max(TETRIS_MIN_CLOCK_MS, TETRIS_START_CLOCK_MS - (thisTurnIndex * TETRIS_CLOCK_STEP_MS));
  const sweepMs = getTetrisSweepStepMs(thisTurnIndex);

  if (thisTurnIndex === 0 && roundMs !== TETRIS_START_CLOCK_MS) {
    reportTetrisInvariant('clock-first-round-duration', {
      thisTurnIndex,
      roundMs,
      expected: TETRIS_START_CLOCK_MS,
      tetrisSuccessfulPlacements,
      tetrisTurnIndex,
    });
  }

  tetrisClockDeadline = Date.now() + roundMs;
  setTetrisClockDisplay(roundMs, roundMs);

  startOrRestartTetrisSweepTimer(token, sweepMs);

  tetrisClockTimer = setInterval(() => {
    if (token !== tetrisRoundToken || tetrisBusy || isGameOver) return;

    const remainingMs = tetrisClockDeadline - Date.now();
    setTetrisClockDisplay(remainingMs, roundMs);
    if (remainingMs <= 0) {
      clearTetrisRoundTimers();
      autoDropCurrentTetrisTile(token);
    }
  }, 80);
}

async function autoDropCurrentTetrisTile(token) {
  if (!isTetrisMode() || isGameOver || tetrisBusy) return;
  if (token !== tetrisRoundToken) return;

  await handleDropClick(tetrisSweepColumn);
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

function renderTetrisPreRoundPreview() {
  if (!isTetrisMode()) return;
  if (!Array.isArray(gameDeck) || gameDeck.length === 0) return;

  const nextLetter = document.getElementById('next-letter');
  const q1 = document.getElementById('queue-1');
  const q2 = document.getElementById('queue-2');

  const base = currentDeckIndex;
  if (nextLetter) nextLetter.innerText = gameDeck[base + 1] || '';
  if (q1) q1.innerText = gameDeck[base + 2] || '';
  if (q2) q2.innerText = gameDeck[base + 3] || '';

  syncTetrisQueueUI();
}

function syncDropSlots() {
  if (!isTetrisMode()) return;

  const slots = getDropSlots();
  const letter = tetrisActiveLetter || (document.getElementById('next-letter') ? document.getElementById('next-letter').innerText : '');
  slots.forEach((slot, col) => {
    const topIdx = col;
    const blocked = Boolean(cells[topIdx]) || tetrisBusy;
    const active = col === tetrisSweepColumn && !tetrisBusy;
    slot.classList.toggle('is-blocked', Boolean(cells[topIdx]));
    slot.classList.toggle('is-sweep-active', active);
    slot.disabled = blocked || !active;
    if (active) {
      slot.dataset.loadedLetter = letter || '';
    } else {
      delete slot.dataset.loadedLetter;
    }
  });
}

function syncTetrisBombUI() {
  if (!isTetrisMode()) return;

  const toolsRow = document.getElementById('tetris-tools-row');
  const bombIndicator = getBombIndicatorEl();
  const clockEl = getTetrisClockEl();
  if (toolsRow) toolsRow.classList.add('is-active');
  if (clockEl) clockEl.classList.add('is-active');
  if (bombIndicator) {
    bombIndicator.classList.toggle('is-empty', tetrisBombsRemaining <= 0);
    const bombIcons = bombIndicator.querySelectorAll('.tetris-bomb-icon');
    bombIcons.forEach((icon, index) => {
      const spent = index >= tetrisBombsRemaining;
      icon.classList.toggle('is-spent', spent);
    });
  }
}

function clearSlotLoadedLetter(slot) {
  if (!slot) return;
  delete slot.dataset.loadedLetter;
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
    gameDeck = gameDeck.concat(generateBagSequence(false));
  }
}

async function handleDropClick(col) {
  if (!isTetrisMode() || isGameOver || tetrisBusy) return;
  const sessionToken = tetrisSessionToken;

  const targetIdx = findDropTargetIndex(col);
  if (targetIdx < 0) {
    syncDropSlots();
    return;
  }

  ensureDeckBufferForTetris();

  const letter = tetrisActiveLetter || (document.getElementById('next-letter') ? document.getElementById('next-letter').innerText : '');
  if (!letter) return;
  const cellEl = document.querySelector(`.grid-cell[data-index='${targetIdx}']`);

  const slot = getDropSlot(col);
  if (slot) slot.classList.add('is-engaged');
  tetrisBusy = true;
  clearTetrisRoundTimers();
  stopTetrisBalloonPulse();
  syncDropSlots();
  await animateDropToCell(col, targetIdx, letter);
  if (sessionToken !== tetrisSessionToken || isGameOver) {
    if (slot) clearSlotLoadedLetter(slot);
    tetrisBusy = false;
    syncDropSlots();
    return;
  }
  if (slot) clearSlotLoadedLetter(slot);
  placeLetter(targetIdx, letter, cellEl, false);
}

document.addEventListener('ws:afterInit', () => {
  if (!isTetrisMode()) return;

  renderTetrisPreRoundPreview();

  bindTetrisSpeedControls();
  updateTetrisSpeedControlsUI();

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
  if (gridEl) gridEl.classList.add('tetris-mode');
  const headerLabel = document.getElementById('header-label');
  if (headerLabel) {
    headerLabel.textContent = '';
    headerLabel.style.display = 'none';
  }
  const leftHeader = document.getElementById('left-header');
  if (leftHeader) leftHeader.title = '';

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

document.addEventListener('ws:roundArmed', () => {
  if (!isTetrisMode()) return;
  tetrisGameplayArmed = true;
  startTetrisRound();
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
  finalizeTetrisTurn('ws:occupiedCellClick');
  if (isGameOver) return;

  tetrisBusy = false;
  syncDropSlots();
  syncTetrisBombUI();
});

document.addEventListener('ws:tilePlaced', async () => {
  if (!isTetrisMode()) return;

  await resolveTetrisClears();

  if (endTetrisIfAnyColumnFull('ws:tilePlaced')) {
    return;
  }

  tetrisSuccessfulPlacements++;
  validateTetrisClockState('ws:tilePlaced');

  finalizeTetrisTurn('ws:tilePlaced');
  if (isGameOver) return;

  ensureDeckBufferForTetris();
  tetrisBusy = false;
  syncDropSlots();
  syncTetrisBombUI();
  startTetrisRound();
});

document.addEventListener('ws:calculateScore', (e) => {
  if (!isTetrisMode()) return;
  e.preventDefault();
  if (scoreEl) scoreEl.innerText = currentScore;
});

document.addEventListener('ws:beforeInit', () => {
  if (!isTetrisMode()) return;
  tetrisSessionToken++;
  tetrisBusy = false;
  tetrisBombsRemaining = 3;
  tetrisActiveLetter = '';
  tetrisActiveTone = 'green';
  tetrisSuccessfulPlacements = 0;
  tetrisTurnIndex = 0;
  tetrisGameplayArmed = false;
  tetrisSweepColumn = 0;
  tetrisSweepDirection = 1;
  tetrisDirectionalSpeed = TETRIS_DIRECTIONAL_SPEED_MIN;
  tetrisRoundToken++;
  clearTetrisRoundTimers();
  stopTetrisBalloonPulse();
  if (typeof generateBagSequence === 'function') {
    gameDeck = generateBagSequence(false);
  }
  currentDeckIndex = 0;
  currentScore = 0;
  if (scoreEl) scoreEl.innerText = '0';
  renderTetrisPreRoundPreview();
  updateTetrisSpeedControlsUI();
  syncTetrisBombUI();
});