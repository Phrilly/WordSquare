// ================================
// BOMB VARIANT - FIXED DAILY DECK
// ================================

let activeBombs = [];

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

// ---------------------------------------------------------
// EDA (Event-Driven Architecture) Hooks
// ---------------------------------------------------------

document.addEventListener('ws:beforeInit', () => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isBombDay) return;
    
    // Override the core deck with the 28-letter Bomb deck
    gameDeck = buildBombDailyDeck();
    activeBombs = [];
});

document.addEventListener('ws:afterInit', () => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isBombDay) return;
    
    // Inject the bombs into the DOM grid
    activeBombs = buildBombPositions();
    if (gridEl) {
        const gridCells = gridEl.querySelectorAll('.grid-cell:not(.alpha-cell)');
        activeBombs.forEach(i => {
            if (gridCells[i]) gridCells[i].classList.add('has-bomb');
        });
    }

    // Defensive Hide: Ensure queue never bleeds into Bomb day
    if (queueContainerEl) queueContainerEl.classList.remove('is-active');
    if (queue1El) queue1El.classList.remove('is-active');
    if (queue2El) queue2El.classList.remove('is-active');
});

document.addEventListener('ws:cellClick', (e) => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isBombDay) return;

    const index = e.detail.index;
    const cellEl = e.detail.cellEl;

    if (activeBombs.includes(index)) {
        // Stop standard placement logic!
        e.preventDefault(); 

        activeBombs = activeBombs.filter(b => b !== index);
        const letterToBurn = nextLetterEl ? nextLetterEl.innerText : '';

        if (cellEl) {
            cellEl.classList.remove('has-bomb');
            createBombParticles(cellEl, letterToBurn);
            setTimeout(() => {
                if (cellEl) {
                    cellEl.classList.remove('exploding');
                    cellEl.innerText = '';
                }
            }, 1000);
        }

        // Burn letter, do not place it, advance deck safely
        if (typeof currentDeckIndex !== 'undefined') {
            currentDeckIndex++;
        }
        
        if (typeof setNextLetter === 'function') {
            setNextLetter();
        }
    }
});

document.addEventListener('ws:nextLetterUpdated', () => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isBombDay) return;
    
    // Ensure queue stays dead during bomb variant
    if (queueContainerEl) queueContainerEl.classList.remove('is-active');
    if (queue1El) queue1El.classList.remove('is-active');
    if (queue2El) queue2El.classList.remove('is-active');
});