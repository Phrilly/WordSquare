// ================================
// BOMB VARIANT - DYNAMIC RESTOCK
// ================================

let activeBombs = [];
let defusedBombs = new Set();

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

// FIX: Dynamic Queue Restock Logic
// Rather than overwriting the 25-tile array, we dynamically generate a single replacement tile when a bomb is defused.
function getRestockLetter() {
  const masterBag = "AAAAAAAEEEEEEEEEEIIIIIOOOOOUUUSSSSRRRRRRRRTTTTTTTTNNNNNNNLLLLLLDDDDDBBCCCCFFGGGHHHJKMMMMPPPQVVWWXYYZ";
  const rnd = makeDailyRandom('restock-' + defusedBombs.size);
  return masterBag[Math.floor(rnd() * masterBag.length)];
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
// EDA Hooks
// ---------------------------------------------------------

document.addEventListener('ws:beforeInit', () => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isBombDay) return;
    activeBombs = [];
    defusedBombs.clear();
});

document.addEventListener('ws:afterInit', () => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isBombDay) return;
    
    activeBombs = buildBombPositions();
    if (gridEl) {
        const gridCells = gridEl.querySelectorAll('.grid-cell:not(.alpha-cell)');
        activeBombs.forEach(i => {
            if (gridCells[i]) gridCells[i].classList.add('has-bomb');
        });
    }

    const queueContainerEl = document.getElementById('queue-container');
    const queue1El = document.getElementById('queue-1');
    const queue2El = document.getElementById('queue-2');

    if (queueContainerEl) queueContainerEl.classList.remove('is-active');
    if (queue1El) queue1El.classList.remove('is-active');
    if (queue2El) queue2El.classList.remove('is-active');
});

document.addEventListener('ws:cellClick', (e) => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isBombDay) return;

    const idx = e.detail.index;
    const cellEl = e.detail.cellEl;

    if (activeBombs.includes(idx) && !defusedBombs.has(idx)) {
        e.preventDefault(); 

        defusedBombs.add(idx);
        
        // FIX: The core issue resolution. Directly restock the queue length to prevent 'EEE' freezing at 25.
        gameDeck.push(getRestockLetter());
        
        const nextLetterEl = document.getElementById('next-letter');
        const letterToBurn = nextLetterEl ? nextLetterEl.innerText : '';

        if (cellEl) {
            cellEl.classList.remove('has-bomb');
            cellEl.classList.add('bomb-exploded');
            createBombParticles(cellEl, letterToBurn);
            
            setTimeout(() => {
                if (cellEl) {
                    cellEl.classList.remove('bomb-exploded', 'exploding');
                }
            }, 1000);
        }

        if (typeof lastPlacedInfo !== 'undefined') {
            lastPlacedInfo = null;
            const glowingCells = document.querySelectorAll('.is-undoable');
            glowingCells.forEach(c => c.classList.remove('is-undoable'));
        }

        document.dispatchEvent(new CustomEvent('ws:tilePlaced'));
    }
});

document.addEventListener('ws:nextLetterUpdated', () => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isBombDay) return;
    
    const queueContainerEl = document.getElementById('queue-container');
    const queue1El = document.getElementById('queue-1');
    const queue2El = document.getElementById('queue-2');
    if (queueContainerEl) queueContainerEl.classList.remove('is-active');
    if (queue1El) queue1El.classList.remove('is-active');
    if (queue2El) queue2El.classList.remove('is-active');
});