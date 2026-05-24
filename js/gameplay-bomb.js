// ================================
// BOMB VARIANT - DAILY DETERMINISTIC
// ================================

// 1. New tracking vars for the variant only
var deckIndex = 0;
var activeBombs = [];


// 2. Override the bag generator to produce a deterministic 28-letter deck
// Uses the same seededRandom path as your normal daily game.
window.generateBagSequence = function() {
  const frequencies = {
    A:9, B:2, C:2, D:4, E:12, F:2, G:3, H:2, I:9, J:1, K:1, L:4,
    M:2, N:6, O:8, P:2, Q:1, R:6, S:4, T:6, U:4, V:2, W:2, X:1, Y:2, Z:1
  };

  let pool = [];
  for (const [letter, count] of Object.entries(frequencies)) {
    for (let i = 0; i < count; i++) pool.push(letter);
  }

  const randomFunc =
    (typeof isCurrentGameDaily !== 'undefined' &&
     isCurrentGameDaily &&
     typeof seededRandom === 'function')
      ? seededRandom
      : Math.random;

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(randomFunc() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Take 28 letters for bomb mode
  return pool.slice(0, 28);
};


// 3. Deterministic bomb spawner
window.spawnBombs = function() {
  const gridCells = document.querySelectorAll('#grid .grid-cell');
  gridCells.forEach(c => c.classList.remove('has-bomb'));
  activeBombs = [];

  const randomFunc =
    (typeof isCurrentGameDaily !== 'undefined' &&
     isCurrentGameDaily &&
     typeof seededRandom === 'function')
      ? seededRandom
      : Math.random;

  while (activeBombs.length < 3) {
    const r = Math.floor(randomFunc() * 25);
    if (!activeBombs.includes(r)) {
      activeBombs.push(r);
      if (gridCells[r]) gridCells[r].classList.add('has-bomb');
    }
  }
};


// 4. Hook initGame: reset variant state, run classic setup, then deploy bombs
const originalInitGame = window.initGame;
window.initGame = function() {
  deckIndex = 0;
  activeBombs = [];

  originalInitGame();

  // originalInitGame() has already:
  // - set isCurrentGameDaily = true
  // - set dailySeed = getDailySeed()
  // - built gameDeck using generateBagSequence()

  window.spawnBombs();
  window.setNextLetter();
};


// 5. Override next-letter display to use the 28-letter bomb deck index
window.setNextLetter = function() {
  if (deckIndex >= gameDeck.length || placedCount >= 25) return;
  document.getElementById('next-letter').innerText = gameDeck[deckIndex];
};


// 6. Particle engine for bomb effects
function createBombParticles(cellEl, letter) {
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

  // Letter shards
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

  // Debris
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

  setTimeout(() => container.remove(), 1500);
}


// 7. Hook clicks: intercept bombs, burn the current letter, do not lock the cell
const originalHandleCellClick = window.handleCellClick;
window.handleCellClick = function(index, cellEl) {
  if (typeof cells !== 'undefined' && cells[index] !== '') return;
  if (placedCount >= 25) return;

  if (activeBombs.includes(index)) {
    activeBombs = activeBombs.filter(b => b !== index);

    const letterToBurn = document.getElementById('next-letter').innerText;

    cellEl.classList.remove('has-bomb');
    createBombParticles(cellEl, letterToBurn);

    setTimeout(() => {
      cellEl.classList.remove('exploding');
      cellEl.innerText = '';
    }, 1000);

    // Burn the current letter without placing it
    deckIndex++;
    window.setNextLetter();
    return;
  }

  originalHandleCellClick(index, cellEl);
};


// 8. Hook placeLetter so normal placements also advance the custom deck index
const originalPlaceLetter = window.placeLetter;
window.placeLetter = function(index, letter, cellEl, isWildcard) {
  deckIndex++;
  originalPlaceLetter(index, letter, cellEl, isWildcard);
};