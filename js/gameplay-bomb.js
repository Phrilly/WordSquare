// 1. Declare ONLY the new tracking variables needed for the variant
var deckIndex = 0;
var activeBombs = [];

// 2. Override the Bag Generator to yield 28 letters instead of 25
window.generateBagSequence = function() {
  const frequencies = { A:9, B:2, C:2, D:4, E:12, F:2, G:3, H:2, I:9, J:1, K:1, L:4, M:2, N:6, O:8, P:2, Q:1, R:6, S:4, T:6, U:4, V:2, W:2, X:1, Y:2, Z:1 };
  let pool = [];
  for (const [letter, count] of Object.entries(frequencies)) {
    for (let i = 0; i < count; i++) pool.push(letter);
  }
  
  const randomFunc = (typeof isCurrentGameDaily !== 'undefined' && isCurrentGameDaily && typeof seededRandom === 'function') ? seededRandom : Math.random;
  
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(randomFunc() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 28); 
};

// 3. The Bomb Spawner Logic
window.spawnBombs = function() {
  const gridCells = document.querySelectorAll('#grid .grid-cell');
  gridCells.forEach(c => c.classList.remove('has-bomb', 'exploding'));
  activeBombs = [];
  
  const randomFunc = (typeof isCurrentGameDaily !== 'undefined' && isCurrentGameDaily && typeof seededRandom === 'function') ? seededRandom : Math.random;
  
  while (activeBombs.length < 3) {
    let r = Math.floor(randomFunc() * 25);
    if (!activeBombs.includes(r)) {
      activeBombs.push(r);
      if (gridCells[r]) gridCells[r].classList.add('has-bomb');
    }
  }
};

// 4. Hook into initGame: Run classic setup, then deploy bombs
const originalInitGame = window.initGame;
window.initGame = function() {
  deckIndex = 0;
  activeBombs = [];
  
  // Run your original code to build the board
  originalInitGame(); 
  
  // Add the variant features
  window.spawnBombs();
  window.setNextLetter();
};

// 5. Hook into setNextLetter: Read from the 28-letter deck
window.setNextLetter = function() {
  if (deckIndex >= gameDeck.length || placedCount >= 25) return;
  document.getElementById('next-letter').innerText = gameDeck[deckIndex];
};

// 6. Hook into Clicks: Intercept bombs before classic logic fires
const originalHandleCellClick = window.handleCellClick;
window.handleCellClick = function(index, cellEl) {
  if (typeof cells !== 'undefined' && cells[index] !== '') return;
  if (placedCount >= 25) return;

  // Intercept the Bomb!
  if (activeBombs.includes(index)) {
    activeBombs = activeBombs.filter(b => b !== index);
    
    cellEl.classList.remove('has-bomb');
    cellEl.classList.add('exploding');
    
    setTimeout(() => { 
      cellEl.classList.remove('exploding'); 
    }, 500);

    // Consume the letter without locking the square
    deckIndex++; 
    window.setNextLetter(); 
    return; 
  }

  // If it's a normal square, run your classic click logic
  originalHandleCellClick(index, cellEl);
};

// 7. Hook into placeLetter: Advance the custom deck counter
const originalPlaceLetter = window.placeLetter;
window.placeLetter = function(index, letter, cellEl, isWildcard) {
  deckIndex++; // Advance our burned letter tracker
  
  // Run your classic placement logic
  originalPlaceLetter(index, letter, cellEl, isWildcard);
};