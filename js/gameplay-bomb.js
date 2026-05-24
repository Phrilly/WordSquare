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
  gridCells.forEach(c => c.classList.remove('has-bomb'));
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
  
  originalInitGame(); 
  
  window.spawnBombs();
  window.setNextLetter();
};

// 5. Hook into setNextLetter: Read from the 28-letter deck
window.setNextLetter = function() {
  if (deckIndex >= gameDeck.length || placedCount >= 25) return;
  document.getElementById('next-letter').innerText = gameDeck[deckIndex];
};

// 6. NEW: The JavaScript Particle Engine for Fire, Smoke, and Letter Shards
function createBombParticles(cellEl, letter) {
  // Find exactly where the cell is on the user's screen
  const rect = cellEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // Create a temporary overlay container for the explosion
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100vw';
  container.style.height = '100vh';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';
  document.body.appendChild(container);

  // Hex colors for fire and smoke
  const colors = ['#ef4444', '#f97316', '#eab308', '#44403c', '#1c1917'];

  // Spawn 6 Letter Shards
  for (let i = 0; i < 6; i++) {
    const shard = document.createElement('div');
    shard.innerText = letter;
    shard.className = 'bomb-particle shard';
    
    // Calculate a random distance and angle for each shard to fly
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

  // Spawn 25 pieces of Fire and Smoke Debris
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'bomb-particle debris';
    
    const color = colors[Math.floor(Math.random() * colors.length)];
    p.style.backgroundColor = color;
    p.style.color = color; 
    
    // Give each piece of debris a random size
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

  // Sweep up the debris from the DOM once the animation finishes
  setTimeout(() => container.remove(), 800);
}

// 7. Hook into Clicks: Intercept bombs and trigger the particle engine
const originalHandleCellClick = window.handleCellClick;
window.handleCellClick = function(index, cellEl) {
  if (typeof cells !== 'undefined' && cells[index] !== '') return;
  if (placedCount >= 25) return;

  // Intercept the Bomb!
  if (activeBombs.includes(index)) {
    activeBombs = activeBombs.filter(b => b !== index);
    
    // Identify which letter is currently being sacrificed
    const letterToBurn = document.getElementById('next-letter').innerText;
    
    // Remove the bomb visuals instantly
    cellEl.classList.remove('has-bomb');
    
    // Trigger the JavaScript particle blast across the screen
    createBombParticles(cellEl, letterToBurn);

    // Consume the letter without locking the square
    deckIndex++; 
    window.setNextLetter(); 
    return; 
  }

  // If it's a normal square, run your classic click logic
  originalHandleCellClick(index, cellEl);
};

// 8. Hook into placeLetter: Advance the custom deck counter
const originalPlaceLetter = window.placeLetter;
window.placeLetter = function(index, letter, cellEl, isWildcard) {
  deckIndex++; // Advance our burned letter tracker
  originalPlaceLetter(index, letter, cellEl, isWildcard);
};