// ================================
// BOMB VARIANT - FIXED DAILY DECK
// ================================

// Variant-only state
var deckIndex = 0;
var activeBombs = [];


// Small deterministic PRNG from a string seed
function seededHash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeDailyRandom(suffix) {
  return mulberry32(seededHash(String(typeof dailySeed !== 'undefined' ? dailySeed : 0) + ':' + suffix));
}


// Build the fixed 28-letter deck for the day
function buildBombDailyDeck() {
  const frequencies = {
    A:9, B:2, C:2, D:4, E:12, F:2, G:3, H:2, I:9, J:1, K:1, L:4,
    M:2, N:6, O:8, P:2, Q:1, R:6, S:4, T:6, U:4, V:2, W:2, X:1, Y:2, Z:1
  };

  const rnd = makeDailyRandom('bomb-deck');
  let pool = [];

  for (const [letter, count] of Object.entries(frequencies)) {
    for (let i = 0; i < count; i++) {
      pool.push(letter);
    }
  }

  // Fisher-Yates using our own RNG
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, 28);
}


// Build the fixed bomb positions for the day
function buildBombPositions() {
  const rnd = makeDailyRandom('bomb-positions');
  const positions = [];

  while (positions.length < 3) {
    const r = Math.floor(rnd() * 25);
    if (!positions.includes(r)) positions.push(r);
  }

  return positions;
}


// Override initGame completely for the bomb mode
window.initGame = function() {
  const existingCells = document.querySelectorAll('#grid > .grid-cell:not(.alpha-cell)');
  existingCells.forEach(cell => cell.remove());

  cells = Array(gridSize * gridSize).fill('');
  wildcardState = Array(gridSize * gridSize).fill(false);

  placedCount = 0;
  pendingCellIndex = null;
  
  if (typeof explodedWords !== 'undefined') explodedWords.clear();
  currentScore = 0;
  if (typeof usedWildcards !== 'undefined') usedWildcards.clear();

  deckIndex = 0;
  activeBombs = [];

  isCurrentGameDaily = true;
  if (isCurrentGameDaily && typeof getDailySeed === 'function') {
      dailySeed = getDailySeed();
  }

  // IMPORTANT:
  // Build the fixed 28-letter daily deck directly from the daily seed.
  gameDeck = buildBombDailyDeck();

  if (scoreEl) scoreEl.innerText = '0';
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
    
    if (typeof handleCellClick === 'function') cell.addEventListener('click', () => handleCellClick(i, cell));
    if (typeof handleHoverEnter === 'function') cell.addEventListener('mouseenter', () => handleHoverEnter(i, cell));
    if (typeof handleHoverLeave === 'function') cell.addEventListener('mouseleave', () => handleHoverLeave(cell));
    
    if (gridEl) gridEl.appendChild(cell);
  }

  // Explicitly ensure lookahead queue is disabled for Bomb Mode
  if (queueContainerEl) queueContainerEl.classList.remove('is-active');
  if (queue1El) queue1El.classList.remove('is-active');
  if (queue2El) queue2El.classList.remove('is-active');

  if (leftHeaderEl) leftHeaderEl.title = 'Click to open wildcard picker';

  // Fixed bomb positions for the same day
  activeBombs = buildBombPositions();
  const gridCells = document.querySelectorAll('#grid .grid-cell');
  activeBombs.forEach(i => {
    if (gridCells[i]) gridCells[i].classList.add('has-bomb');
  });

  setNextLetter();
};


// Override next letter to read from the 28-letter deck and explicitly kill queue
window.setNextLetter = function() {
  if (deckIndex >= gameDeck.length || placedCount >= 25) {
      if (queueContainerEl) queueContainerEl.classList.remove('is-active');
      return;
  }
  
  if (nextLetterEl) nextLetterEl.innerText = gameDeck[deckIndex];

  // Bomb days NEVER show lookahead queue
  if (queue1El) {
      queue1El.classList.remove('is-active');
      queue1El.innerText = '';
  }
  if (queue2El) {
      queue2El.classList.remove('is-active');
      queue2El.innerText = '';
  }
};


// Particle engine
function createBombParticles(cellEl, letter) {
  if (!cellEl) return;
  
  const rect = cellEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100vw';
  container.style.height = '100vh';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';
  document.body.appendChild(container);

  const colors = ['#ef4444', '#f97316', '#eab308', '#44403c', '#1c1917'];

  for (let i = 0; i < 6; i++) {
    const shard = document.createElement('div');
    shard.innerText = letter;
    shard.className = 'bomb-particle shard';

    const angle = Math.random() * Math.PI * 2;
    const distance = 80 + Math.random() * 200;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;

    shard.style.left = centerX + 'px';
    shard.style.top = centerY + 'px';
    shard.style.setProperty('--tx', tx + 'px');
    shard.style.setProperty('--ty', ty + 'px');

    container.appendChild(shard);
  }

  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'bomb-particle debris';

    const color = colors[Math.floor(Math.random() * colors.length)];
    p.style.backgroundColor = color;
    p.style.color = color;

    const size = 10 + Math.random() * 25;
    p.style.width = size + 'px';
    p.style.height = size + 'px';

    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 250;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;

    p.style.left = centerX + 'px';
    p.style.top = centerY + 'px';
    p.style.setProperty('--tx', tx + 'px');
    p.style.setProperty('--ty', ty + 'px');

    container.appendChild(p);
  }

  setTimeout(() => { if (container) container.remove(); }, 1500);
}


// Override click logic for bombs
const originalHandleCellClick = window.handleCellClick;
window.handleCellClick = function(index, cellEl) {
  if (!cellEl) return;
  if (cells[index] !== '' || placedCount >= 25) return;

  if (activeBombs.includes(index)) {
    activeBombs = activeBombs.filter(b => b !== index);

    const letterToBurn = nextLetterEl ? nextLetterEl.innerText : '';

    cellEl.classList.remove('has-bomb');
    createBombParticles(cellEl, letterToBurn);

    setTimeout(() => {
      if (cellEl) {
          cellEl.classList.remove('exploding');
          cellEl.innerText = '';
      }
    }, 1000);

    // Burn letter, do not place it
    deckIndex++;
    setNextLetter();
    return;
  }

  if (typeof originalHandleCellClick === 'function') {
      originalHandleCellClick(index, cellEl);
  }
};


// Override placement so normal placements also advance the 28-letter deck
const originalPlaceLetter = window.placeLetter;
window.placeLetter = function(index, letter, cellEl, isWildcard) {
  if (cellEl) cellEl.classList.remove('hover-3', 'hover-4', 'hover-5');

  cells[index] = letter;
  wildcardState[index] = isWildcard;

  if (cellEl) {
      cellEl.innerText = letter;
      if (isWildcard) {
        cellEl.classList.add('is-wildcard');
      }
      cellEl.classList.add('tile-pop');
      setTimeout(() => {
        if (cellEl) cellEl.classList.remove('tile-pop');
      }, 300);
  }
  
  placedCount++;
  deckIndex++;

  if (typeof calculateRealTimeScoreLocal === 'function') calculateRealTimeScoreLocal();

  if (placedCount === 25) {
    if (headerLabelEl) headerLabelEl.innerText = 'Score:';
    if (queueContainerEl) queueContainerEl.classList.remove('is-active');
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
  } else {
    setNextLetter();
  }
};