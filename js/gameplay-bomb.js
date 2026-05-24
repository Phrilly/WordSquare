const gridSize = 5;
let cells = Array(gridSize * gridSize).fill('');
let wildcardState = Array(gridSize * gridSize).fill(false);

// Dedicated Bomb Variables
let placedCount = 0;
let deckIndex = 0; 
let activeBombs = []; 

let pendingCellIndex = null;
let explodedWords = new Set();
let currentScore = 0;
let isCurrentGameDaily = true;

let usedWildcards = new Set();
let gameDictionary = new Set();
let gameDeck = [];
let bestDailyData = null;

let aiBestScore = 0;
let aiBestGrid = [];
localStorage.removeItem('ws_daily_offset');
let dailyOffset = 0;
let dailySeed = 0;
let sessionId = '';

const gridEl = document.getElementById('grid');
const headerLabelEl = document.getElementById('header-label');
const nextLetterEl = document.getElementById('next-letter');
const scoreEl = document.getElementById('score');
const alphabetModal = document.getElementById('alphabet-modal');
const leftHeaderEl = document.getElementById('left-header');

const highscoreEntryModal = document.getElementById('highscore-entry-modal');
const leaderboardModal = document.getElementById('leaderboard-modal');
const initialsInput = document.getElementById('hidden-initials');
const topBarEl = document.querySelector('.top-bar');

const boardViewerTitleEl = document.getElementById('board-viewer-title');
const boardViewerScoreLineEl = document.getElementById('board-score-line');
const boardViewerScoreEl = document.getElementById('best-board-score');

// OVERRIDE: Custom 28-letter bag generator ensuring variant is self-contained
function generateBagSequence() {
  const frequencies = { A:9, B:2, C:2, D:4, E:12, F:2, G:3, H:2, I:9, J:1, K:1, L:4, M:2, N:6, O:8, P:2, Q:1, R:6, S:4, T:6, U:4, V:2, W:2, X:1, Y:2, Z:1 };
  let pool = [];
  for (const [letter, count] of Object.entries(frequencies)) {
    for (let i = 0; i < count; i++) pool.push(letter);
  }

  // Uses seeded random if it's the daily puzzle so all players get the same letters
  const randomFunc = (isCurrentGameDaily && typeof seededRandom === 'function') ? seededRandom : Math.random;

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(randomFunc() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 28); 
}

function spawnBombs() {
  const gridCells = document.querySelectorAll('#grid .grid-cell');
  gridCells.forEach(c => c.classList.remove('has-bomb', 'exploding'));
  activeBombs = [];

  // Ensures bombs are in the exact same spot for everyone if playing the daily
  const randomFunc = (isCurrentGameDaily && typeof seededRandom === 'function') ? seededRandom : Math.random;

  while (activeBombs.length < 3) {
    let r = Math.floor(randomFunc() * 25);
    if (!activeBombs.includes(r)) {
      activeBombs.push(r);
      if (gridCells[r]) gridCells[r].classList.add('has-bomb');
    }
  }
}

function initGame() {
  const existingCells = document.querySelectorAll('#grid > .grid-cell:not(.alpha-cell)');
  existingCells.forEach(cell => cell.remove());

  cells = Array(gridSize * gridSize).fill('');
  wildcardState = Array(gridSize * gridSize).fill(false);

  placedCount = 0;
  deckIndex = 0;
  activeBombs = [];
  pendingCellIndex = null;
  explodedWords.clear();
  currentScore = 0;
  usedWildcards.clear();

  isCurrentGameDaily = true;
  if (isCurrentGameDaily) dailySeed = getDailySeed();

  gameDeck = generateBagSequence(); 

  scoreEl.innerText = '0';
  headerLabelEl.innerText = 'Next:';

  alphabetModal.classList.remove('active');
  highscoreEntryModal.classList.remove('active');
  leaderboardModal.classList.remove('active');
  document.getElementById('best-board-modal').classList.remove('active');

  topBarEl.style.opacity = '1';

  for (let i = 0; i < 25; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.dataset.index = i;
    cell.addEventListener('click', () => handleCellClick(i, cell));
    cell.addEventListener('mouseenter', () => handleHoverEnter(i, cell));
    cell.addEventListener('mouseleave', () => handleHoverLeave(cell));
    gridEl.appendChild(cell);
  }

  spawnBombs();

  nextLetterEl.style.display = 'inline-flex';
  leftHeaderEl.title = 'Click to open wildcard picker';
  setNextLetter();
}

function setNextLetter() {
  if (deckIndex >= gameDeck.length || placedCount >= 25) return;
  nextLetterEl.innerText = gameDeck[deckIndex];
}

function handleHoverEnter(index, cellEl) {
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

  // Intercept the click if it's an active bomb
  if (activeBombs.includes(index)) {
    activeBombs = activeBombs.filter(b => b !== index);
    
    cellEl.classList.remove('has-bomb');
    cellEl.classList.add('exploding');
    
    setTimeout(() => {
      cellEl.classList.remove('exploding');
    }, 500);

    deckIndex++; 
    setNextLetter(); 
    return; 
  }

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
  deckIndex++;

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

  const groupedData = buildGroupedWordData(validWords);

  currentScore = (groupedData.display[3].length * 1) + 
                 (groupedData.display[4].length * 5) + 
                 (groupedData.display[5].length * 20);

  groupedData.display[5].forEach(displayStr => {
    if (!explodedWords.has(displayStr)) {
      triggerExplosion(false);
      explodedWords.add(displayStr);
    }
  });

  scoreEl.innerText = currentScore;
  renderWordListsForBoard(groupedData);
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