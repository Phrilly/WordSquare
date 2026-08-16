const BOGGLE_GRID_SIZE = 5;
const BOGGLE_ROUND_SECONDS = 180;
const BOGGLE_TOTAL_ROUNDS = 2;
const BOGGLE_LETTER_BAG = 'AAAAAAAAAAAAAAEEEEEEEEEEEEEEEEEEEEIIIIIIIIIIIIOOOOOOOOOO' +
  'UUUUUUUUUSSSSSSSSSSTTTTTTTTTTNNNNNNNNRRRRRRRRHHHHHHDDDDDD' +
  'LLLLLLCCCCCCMMMMMMPPPPFFGGGGYYWWVVBBKKXJQZ';

let boggleTiles = [];
let bogglePath = [];
let boggleFoundWords = new Map();
let boggleRoundScores = [];
let boggleRoundNumber = 0;
let boggleSecondsRemaining = BOGGLE_ROUND_SECONDS;
let boggleTimerId = null;
let boggleIsLocked = true;
let boggleIsPointerSelecting = false;
let boggleIgnoreClickUntil = 0;
let boggleAwaitingOpeningClose = false;
let boggleOpeningHasClosed = false;

function isBoggleModeActive() {
  return Boolean(window.GAME_CONFIG && window.GAME_CONFIG.isBoggleDay);
}

function getBoggleTileValue(tileIndex) {
  return boggleTiles[tileIndex] === 'Q' ? 'QU' : boggleTiles[tileIndex];
}

function isBoggleAdjacent(fromIndex, toIndex) {
  const rowDifference = Math.abs(Math.floor(fromIndex / BOGGLE_GRID_SIZE) - Math.floor(toIndex / BOGGLE_GRID_SIZE));
  const columnDifference = Math.abs((fromIndex % BOGGLE_GRID_SIZE) - (toIndex % BOGGLE_GRID_SIZE));
  return (rowDifference <= 1 && columnDifference <= 1) && (rowDifference !== 0 || columnDifference !== 0);
}

function getBogglePathWord() {
  return bogglePath.map(getBoggleTileValue).join('');
}

function getBogglePoints(wordLength) {
  if (wordLength === 4) return 1;
  if (wordLength === 5) return 2;
  if (wordLength === 6) return 3;
  if (wordLength === 7) return 5;
  return wordLength >= 8 ? 11 : 0;
}

function getBoggleRoundScore() {
  return Array.from(boggleFoundWords.values()).reduce((total, points) => total + points, 0);
}

function getBoggleCumulativeScore() {
  const completedRoundScore = boggleRoundScores.reduce((total, score) => total + score, 0);
  return completedRoundScore + (boggleIsLocked ? 0 : getBoggleRoundScore());
}

function updateBoggleHeader() {
  const timerEl = document.getElementById('boggle-timer');
  const roundLabelEl = document.getElementById('boggle-round-label');
  const scoreDisplay = document.getElementById('score');
  const minutes = Math.floor(boggleSecondsRemaining / 60);
  const seconds = String(boggleSecondsRemaining % 60).padStart(2, '0');

  if (timerEl) {
    timerEl.textContent = `${minutes}:${seconds}`;
    timerEl.classList.toggle('is-urgent', boggleSecondsRemaining <= 15);
  }
  if (roundLabelEl) roundLabelEl.textContent = `ROUND ${boggleRoundNumber} OF ${BOGGLE_TOTAL_ROUNDS}`;
  if (scoreDisplay) scoreDisplay.textContent = String(getBoggleCumulativeScore());
}

function setBoggleFeedback(message, state = '') {
  const feedbackEl = document.getElementById('boggle-feedback');
  if (!feedbackEl) return;
  feedbackEl.textContent = message;
  feedbackEl.className = `boggle-feedback${state ? ` is-${state}` : ''}`;
}

function renderBogglePath() {
  const currentWordEl = document.getElementById('boggle-current-word');
  const clearButton = document.getElementById('boggle-clear-btn');
  const submitButton = document.getElementById('boggle-submit-btn');
  const tileElements = document.querySelectorAll('#grid.boggle-mode .grid-cell[data-index]');

  tileElements.forEach((tileElement) => {
    const index = Number(tileElement.dataset.index);
    tileElement.classList.toggle('boggle-path', bogglePath.includes(index));
  });

  if (currentWordEl) {
    currentWordEl.textContent = bogglePath.length > 0 ? getBogglePathWord() : 'Select adjacent tiles';
  }
  if (clearButton) clearButton.disabled = boggleIsLocked || bogglePath.length === 0;
  if (submitButton) submitButton.disabled = boggleIsLocked || bogglePath.length === 0;
}

function clearBogglePath() {
  bogglePath = [];
  renderBogglePath();
}

function addBoggleTileToPath(tileIndex) {
  if (boggleIsLocked) return false;
  if (bogglePath.length === 0) {
    bogglePath.push(tileIndex);
    renderBogglePath();
    return true;
  }

  const lastTileIndex = bogglePath[bogglePath.length - 1];
  if (tileIndex === lastTileIndex) return false;
  if (bogglePath.includes(tileIndex)) {
    setBoggleFeedback('A tile can be used only once.', 'invalid');
    return false;
  }
  if (!isBoggleAdjacent(lastTileIndex, tileIndex)) {
    setBoggleFeedback('Next tile must touch the previous tile.', 'invalid');
    return false;
  }

  bogglePath.push(tileIndex);
  renderBogglePath();
  return true;
}

function submitBoggleWord() {
  if (boggleIsLocked || bogglePath.length === 0) return;

  const word = getBogglePathWord();
  if (word.length < 4) {
    setBoggleFeedback('Words need at least 4 letters.', 'invalid');
    clearBogglePath();
    return;
  }
  if (boggleFoundWords.has(word)) {
    setBoggleFeedback('Already found this round.', 'invalid');
    clearBogglePath();
    return;
  }
  if (!gameDictionary.has(word)) {
    setBoggleFeedback(`${word} is not in the dictionary.`, 'invalid');
    clearBogglePath();
    return;
  }

  const points = getBogglePoints(word.length);
  boggleFoundWords.set(word, points);
  setBoggleFeedback(`+${points} ${points === 1 ? 'point' : 'points'}: ${word}`, 'valid');
  clearBogglePath();
  updateBoggleHeader();
}

function renderBoggleBoard() {
  if (!gridEl) return;
  gridEl.querySelectorAll('.grid-cell, .boggle-summary').forEach((element) => element.remove());
  gridEl.classList.add('boggle-mode');

  boggleTiles.forEach((letter, index) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'grid-cell boggle-tile';
    tile.dataset.index = String(index);
    tile.textContent = letter === 'Q' ? 'Qu' : letter;
    tile.setAttribute('aria-label', letter === 'Q' ? 'Qu' : letter);
    tile.addEventListener('pointerdown', (event) => {
      if (boggleIsLocked) return;
      event.preventDefault();
      boggleIsPointerSelecting = true;
      addBoggleTileToPath(index);
    });
    tile.addEventListener('pointerenter', () => {
      if (boggleIsPointerSelecting) addBoggleTileToPath(index);
    });
    tile.addEventListener('click', () => {
      if (Date.now() < boggleIgnoreClickUntil || boggleIsPointerSelecting) return;
      addBoggleTileToPath(index);
    });
    gridEl.appendChild(tile);
  });
}

function stopBoggleTimer() {
  if (boggleTimerId !== null) {
    window.clearInterval(boggleTimerId);
    boggleTimerId = null;
  }
}

function startBoggleTimer() {
  stopBoggleTimer();
  boggleTimerId = window.setInterval(() => {
    if (boggleIsLocked) return;
    boggleSecondsRemaining -= 1;
    updateBoggleHeader();
    if (boggleSecondsRemaining <= 0) {
      boggleSecondsRemaining = 0;
      updateBoggleHeader();
      finishBoggleRound();
    }
  }, 1000);
}

function renderBoggleSummary(isMatchComplete) {
  if (!gridEl) return;
  gridEl.querySelectorAll('.grid-cell, .boggle-summary').forEach((element) => element.remove());

  const currentRoundScore = getBoggleRoundScore();
  const summary = document.createElement('section');
  summary.className = 'boggle-summary';
  const wordRows = Array.from(boggleFoundWords.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([word, points]) => `<li><span>${word}</span><strong>+${points}</strong></li>`)
    .join('');

  if (isMatchComplete) {
    const roundOneScore = boggleRoundScores[0] || 0;
    const roundTwoScore = boggleRoundScores[1] || 0;
    summary.innerHTML = `
      <h2>MATCH COMPLETE</h2>
      <div class="boggle-score-breakdown">
        <span>Round 1 <strong>${roundOneScore}</strong></span>
        <span>Round 2 <strong>${roundTwoScore}</strong></span>
        <span class="boggle-grand-total">Cumulative total <strong>${roundOneScore + roundTwoScore}</strong></span>
      </div>
      <p>Round 2 words</p>
      <ul class="boggle-word-list">${wordRows || '<li>No words found.</li>'}</ul>
      <div class="overlay-actions">
        <button id="boggle-play-again-btn" class="arcade-btn" type="button">PLAY AGAIN</button>
        <button id="boggle-return-btn" class="arcade-btn" type="button">RETURN TO MAIN MENU</button>
      </div>
    `;
    summary.querySelector('#boggle-play-again-btn')?.addEventListener('click', initBoggleGame);
    summary.querySelector('#boggle-return-btn')?.addEventListener('click', () => {
      window.location.href = window.location.pathname;
    });
  } else {
    const cumulativeScore = boggleRoundScores.reduce((total, score) => total + score, 0);
    summary.innerHTML = `
      <h2>ROUND ${boggleRoundNumber} COMPLETE</h2>
      <div class="boggle-score-breakdown">
        <span>Round ${boggleRoundNumber} score <strong>${currentRoundScore}</strong></span>
        <span class="boggle-grand-total">Cumulative score <strong>${cumulativeScore}</strong></span>
      </div>
      <p>Words found</p>
      <ul class="boggle-word-list">${wordRows || '<li>No words found.</li>'}</ul>
      <div class="overlay-actions">
        <button id="boggle-next-round-btn" class="arcade-btn" type="button">START ROUND 2 OF 2</button>
      </div>
    `;
    summary.querySelector('#boggle-next-round-btn')?.addEventListener('click', () => startBoggleRound(2));
  }
  gridEl.appendChild(summary);
}

function finishBoggleRound() {
  if (boggleIsLocked) return;
  boggleIsLocked = true;
  boggleIsPointerSelecting = false;
  stopBoggleTimer();
  clearBogglePath();
  boggleRoundScores.push(getBoggleRoundScore());
  updateBoggleHeader();
  setBoggleFeedback('Time is up. Review your round.', 'invalid');
  renderBoggleSummary(boggleRoundNumber === BOGGLE_TOTAL_ROUNDS);
}

function generateBoggleTiles() {
  const tiles = [];
  for (let index = 0; index < BOGGLE_GRID_SIZE * BOGGLE_GRID_SIZE; index += 1) {
    const randomIndex = Math.floor(Math.random() * BOGGLE_LETTER_BAG.length);
    tiles.push(BOGGLE_LETTER_BAG[randomIndex]);
  }
  return tiles;
}

function startBoggleRound(roundNumber) {
  boggleRoundNumber = roundNumber;
  boggleSecondsRemaining = BOGGLE_ROUND_SECONDS;
  boggleTiles = generateBoggleTiles();
  bogglePath = [];
  boggleFoundWords = new Map();
  boggleIsLocked = false;
  boggleIsPointerSelecting = false;
  const panel = document.getElementById('boggle-panel');
  if (panel) panel.hidden = false;
  renderBoggleBoard();
  updateBoggleHeader();
  setBoggleFeedback(`Round ${roundNumber} has started.`, 'valid');
  startBoggleTimer();
}

function bindBoggleControls() {
  document.getElementById('boggle-clear-btn')?.addEventListener('click', clearBogglePath);
  document.getElementById('boggle-submit-btn')?.addEventListener('click', submitBoggleWord);
  document.addEventListener('pointerup', () => {
    if (!boggleIsPointerSelecting) return;
    boggleIsPointerSelecting = false;
    boggleIgnoreClickUntil = Date.now() + 120;
    submitBoggleWord();
  });
}

function initBoggleGame() {
  if (!isBoggleModeActive()) return;
  stopBoggleTimer();
  boggleRoundScores = [];
  boggleRoundNumber = 1;
  boggleIsLocked = true;
  document.getElementById('highscore-entry-modal')?.classList.remove('active');
  document.getElementById('leaderboard-modal')?.classList.remove('active');
  if (topBarEl) {
    topBarEl.style.opacity = '1';
    topBarEl.classList.add('boggle-mode');
  }
  if (leftHeaderEl) leftHeaderEl.style.visibility = 'hidden';
  if (boggleOpeningHasClosed) {
    startBoggleRound(1);
  } else {
    boggleAwaitingOpeningClose = true;
    renderBoggleBoard();
    updateBoggleHeader();
    setBoggleFeedback('Press PLAY to begin Round 1.', '');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (isBoggleModeActive()) bindBoggleControls();
});

document.addEventListener('ws:openingClosed', () => {
  if (!isBoggleModeActive() || !boggleAwaitingOpeningClose) return;
  boggleAwaitingOpeningClose = false;
  boggleOpeningHasClosed = true;
  startBoggleRound(1);
});
