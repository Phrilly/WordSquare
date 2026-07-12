'use strict';

const MAX_BOMB_POSITION_ITERATIONS = 5000;
const BOMB_PARTICLE_CLEANUP_MS = 1500;
const BOMB_EXPLOSION_RESET_MS = 1000;

let activeBombs = new Set();
let defusedBombs = new Set();
let _bombParticleTimeouts = new Set();
let _bombResetTimeouts = new Set();

function bombSeededHash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function bombMulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeBombDailyRandom(suffix) {
  const seed = GameState.getDailySeed();
  return bombMulberry32(bombSeededHash(String(seed) + ':' + suffix));
}

function buildBombDailyDeck() {
  const frequencies = {
    A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4,
    M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1
  };
  const rnd = makeBombDailyRandom('bomb-deck');
  let pool = [];

  for (const [letter, count] of Object.entries(frequencies)) {
    for (let i = 0; i < count; i++) pool.push(letter);
  }

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, GameState.CELL_COUNT);
}

function buildBombPositions() {
  const rnd = makeBombDailyRandom('bomb-positions');
  const positions = new Set();
  let iterations = 0;

  while (positions.size < 3) {
    iterations++;
    if (iterations > MAX_BOMB_POSITION_ITERATIONS) {
      console.error('buildBombPositions: exceeded max iterations, returning partial set.');
      break;
    }
    const r = Math.floor(rnd() * GameState.CELL_COUNT);
    positions.add(r);
  }

  return positions;
}

function resetBombState() {
  _bombParticleTimeouts.forEach(id => clearTimeout(id));
  _bombParticleTimeouts.clear();
  _bombResetTimeouts.forEach(id => clearTimeout(id));
  _bombResetTimeouts.clear();

  document.querySelectorAll('.bomb-particle-container').forEach(el => el.remove());

  activeBombs = new Set();
  defusedBombs.clear();
}

function createBombParticles(cellEl, letter) {
  if (!cellEl || typeof cellEl.getBoundingClientRect !== 'function') {
    console.error('createBombParticles: invalid cellEl provided.');
    return;
  }

  const safeLetter = typeof letter === 'string' && letter.length === 1 ? letter : '?';
  const rect = cellEl.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const container = document.createElement('div');
  container.className = 'bomb-particle-container';
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100vw';
  container.style.height = '100vh';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';

  const colors = ['#ef4444', '#f97316', '#eab308', '#44403c', '#1c1917'];
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < 6; i++) {
    const shard = document.createElement('div');
    shard.textContent = safeLetter;
    shard.className = 'bomb-particle shard';

    const angle = Math.random() * Math.PI * 2;
    const distance = 80 + Math.random() * 200;
    shard.style.left = centerX + 'px';
    shard.style.top = centerY + 'px';
    shard.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
    shard.style.setProperty('--ty', Math.sin(angle) * distance + 'px');

    fragment.appendChild(shard);
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
    p.style.left = centerX + 'px';
    p.style.top = centerY + 'px';
    p.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
    p.style.setProperty('--ty', Math.sin(angle) * distance + 'px');

    fragment.appendChild(p);
  }

  container.appendChild(fragment);
  document.body.appendChild(container);

  const timeoutId = setTimeout(() => {
    container.remove();
    _bombParticleTimeouts.delete(timeoutId);
  }, BOMB_PARTICLE_CLEANUP_MS);
  _bombParticleTimeouts.add(timeoutId);
}

document.addEventListener('ws:beforeInit', () => {
  if (!window.GAME_CONFIG || !window.GAME_CONFIG.isBombDay) return;
  try {
    GameState.setDeck(buildBombDailyDeck());
    resetBombState();
  } catch (err) {
    console.error('ws:beforeInit (bomb): failed to initialize bomb deck.', err);
  }
});

document.addEventListener('ws:afterInit', () => {
  if (!window.GAME_CONFIG || !window.GAME_CONFIG.isBombDay) return;
  try {
    activeBombs = buildBombPositions();
    const gridEl = DomRefs.gridEl;
    if (gridEl) {
      const gridCells = gridEl.querySelectorAll('.grid-cell:not(.alpha-cell)');
      activeBombs.forEach(i => {
        if (gridCells[i]) gridCells[i].classList.add('has-bomb');
      });
    } else {
      console.error('ws:afterInit (bomb): grid element not found, bombs not rendered.');
    }

    ['queue-container', 'queue-1', 'queue-2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('is-active');
    });
  } catch (err) {
    console.error('ws:afterInit (bomb): failed to place bombs on board.', err);
  }
});

document.addEventListener('ws:cellClick', (e) => {
  if (!window.GAME_CONFIG || !window.GAME_CONFIG.isBombDay) return;
  if (!e || !e.detail) {
    console.error('ws:cellClick (bomb): event missing detail payload.');
    return;
  }

  const idx = e.detail.index;
  const cellEl = e.detail.cellEl;

  if (!Number.isInteger(idx)) {
    console.error(`ws:cellClick (bomb): invalid index ${idx}.`);
    return;
  }

  if (activeBombs.has(idx) && !defusedBombs.has(idx)) {
    e.preventDefault();
    defusedBombs.add(idx);

    const nextLetterEl = document.getElementById('next-letter');
    const letterToBurn = nextLetterEl ? nextLetterEl.innerText : '';

    if (cellEl) {
      cellEl.classList.remove('has-bomb');
      cellEl.classList.add('bomb-exploded');
      createBombParticles(cellEl, letterToBurn);

      const resetTimeoutId = setTimeout(() => {
        if (cellEl) cellEl.classList.remove('bomb-exploded', 'exploding');
        _bombResetTimeouts.delete(resetTimeoutId);
      }, BOMB_EXPLOSION_RESET_MS);
      _bombResetTimeouts.add(resetTimeoutId);
    } else {
      console.warn(`ws:cellClick (bomb): cellEl missing for exploded index ${idx}.`);
    }

    lastPlacedInfo = null;
    document.querySelectorAll('.is-undoable').forEach(c => c.classList.remove('is-undoable'));

    document.dispatchEvent(new CustomEvent('ws:tilePlaced'));
  }
});

document.addEventListener('ws:nextLetterUpdated', () => {
  if (!window.GAME_CONFIG || !window.GAME_CONFIG.isBombDay) return;

  ['queue-container', 'queue-1', 'queue-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('is-active');
  });

  const deck = GameState.getDeck();
  const deckIndex = GameState.getCurrentDeckIndex();
  const placedCount = GameState.getPlacedCount();

  console.log(`[Bomb State] placedCount: ${placedCount}, deckIndex: ${deckIndex}, deckLength: ${deck.length}`);

  if (deckIndex >= deck.length && placedCount < GameState.CELL_COUNT) {
    const cells = GameState.getCells();
    const emptySlots = cells.filter(c => c === '').length;
    console.warn(
      `[Bomb Diagnostic] Deck pointer exceeded bounds. Placed: ${placedCount}, Empty: ${emptySlots}, ` +
      `DeckIndex: ${deckIndex}, DeckSize: ${deck.length}.`
    );
  }
});