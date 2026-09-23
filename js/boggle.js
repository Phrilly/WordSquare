const BOGGLE_SIZE = 5;
const BOGGLE_ROUNDS = 3;
const BOGGLE_SECONDS = 120;
const BOGGLE_LONG_PRESS_MS = 500;
const BOGGLE_DRAG_SAFE_ZONE_RATIO = 0.6;
const BOGGLE_DIAGONAL_INTENT_RATIO = 0.55;
const BOGGLE_BAG = 'AAAAAAAAAAAAAAEEEEEEEEEEEEEEEEEEEEIIIIIIIIIIIIOOOOOOOOOOUUUUUUUUUSSSSSSSSSSTTTTTTTTTTNNNNNNNNRRRRRRRRHHHHHHDDDDDDLLLLLLCCCCCCMMMMMMPPPPFFGGGGYYWWVVBBKKXJQZ';
const BOGGLE_DAILY_SEED = new Date().toISOString().slice(0, 10);
const BOGGLE_PROPER_NOUN_DENYLIST = new Set([
  'AMERICA','AUSTRALIA','BELGIUM','BERLIN','BIRMINGHAM','BRITAIN','CANADA','CHESHIRE','CHICAGO','CHINA','DUBLIN','ENGLAND','FRANCE','GERMANY','INDIA','IRELAND','JAPAN','LIVERPOOL','LONDON','MANCHESTER','MEXICO','NORWAY','OXFORD','PARIS','PORTUGAL','RUSSIA','SCOTLAND','SPAIN','SWEDEN','TOKYO','WALES','YORK'
]);
const BOGGLE_OFFENSIVE_DENYLIST = new Set([
  'ARSE','ASS','BASTARD','BITCH','CRAP','DAMN','FUCK','SHIT','SLUT'
]);
const BOGGLE_UK_SPELLING_MAP = {
  'COLOR': 'COLOUR',
  'COLORS': 'COLOURS',
  'ORGANIZE': 'ORGANISE',
  'ORGANIZES': 'ORGANISES',
  'THEATER': 'THEATRE',
  'THEATERS': 'THEATRES',
  'FAVOR': 'FAVOUR',
  'FAVORS': 'FAVOURS',
  'BEHAVIOR': 'BEHAVIOUR',
  'BEHAVIORS': 'BEHAVIOURS',
  'HONOR': 'HONOUR',
  'HONORS': 'HONOURS',
  'LABOR': 'LABOUR',
  'LABORS': 'LABOURS',
  'CENTER': 'CENTRE',
  'CENTERS': 'CENTRES',
  'METER': 'METRE',
  'METERS': 'METRES'
};
const state = {
  tiles: [], path: [], words: new Map(), round: 1, roundScores: [], roundWords: [], maxRoundScores: [], maxRoundWords: [], seconds: BOGGLE_SECONDS,
  dictionary: new Set(), locked: true, timer: null, desktopPathDrawing: false, selectionComplete: false, selectionFeedback: null, ignoreNextMouseClick: false, longPressTimer: null, suppressNextTouchClick: false, scoreScreen: 'opening'
};
const el = {
  grid: document.getElementById('boggle-grid'),
  preview: document.getElementById('boggle-preview-tiles'),
  status: document.getElementById('boggle-status'),
  score: document.getElementById('boggle-score'),
  maxBar: document.querySelector('.boggle-max-bar'),
  maxBarFill: document.getElementById('boggle-max-bar-fill'),
  timer: document.getElementById('boggle-timer'),
  backspace: document.getElementById('boggle-backspace'),
  clear: document.getElementById('boggle-clear'),
  helpButton: document.getElementById('boggle-help-button'),
  found: document.getElementById('boggle-found-list'),
  summary: document.getElementById('boggle-summary'),
  help: document.getElementById('boggle-help-modal'),
  closeHelp: document.getElementById('boggle-close-help'),
  previewPanel: document.querySelector('.boggle-preview'),
  foundPanel: document.querySelector('.boggle-found')
};

if (window.self !== window.top) {
  document.body.classList.add('is-embedded');
}

function tileText(index) {
  return state.tiles[index] === 'Q' ? 'QU' : state.tiles[index];
}

function word() {
  return state.path.map(tileText).join('');
}

function points(length) {
  return length === 4 ? 1 : length === 5 ? 2 : length === 6 ? 3 : length === 7 ? 5 : length >= 8 ? 11 : 0;
}

/**
 * Determine whether a word can be traced through adjacent board cells without
 * reusing a cell. A Q cell represents QU, matching tileText().
 * @param {string[]} tiles
 * @param {string} candidate
 * @returns {boolean}
 */
function canTrace(tiles, candidate) {
  if (typeof candidate !== 'string' || !/^[A-Z]{4,25}$/.test(candidate)) return false;

  const used = new Uint8Array(BOGGLE_SIZE * BOGGLE_SIZE);

  const walk = (index, position) => {
    if (used[index] === 1) return false;

    const segment = tiles[index] === 'Q' ? 'QU' : tiles[index];
    if (!candidate.startsWith(segment, position)) return false;

    const nextPosition = position + segment.length;
    if (nextPosition === candidate.length) return true;

    used[index] = 1;
    const row = Math.floor(index / BOGGLE_SIZE);
    const column = index % BOGGLE_SIZE;
    for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
      for (let columnDelta = -1; columnDelta <= 1; columnDelta += 1) {
        if (rowDelta === 0 && columnDelta === 0) continue;
        const nextRow = row + rowDelta;
        const nextColumn = column + columnDelta;
        if (nextRow < 0 || nextRow >= BOGGLE_SIZE || nextColumn < 0 || nextColumn >= BOGGLE_SIZE) continue;

        const nextIndex = (nextRow * BOGGLE_SIZE) + nextColumn;
        if (walk(nextIndex, nextPosition)) {
          used[index] = 0;
          return true;
        }
      }
    }

    used[index] = 0;
    return false;
  };

  for (let start = 0; start < tiles.length; start += 1) {
    if (walk(start, 0)) return true;
  }
  return false;
}

/**
 * Calculate all distinct words and the theoretical maximum for one board.
 * Words are ordered longest-first, then alphabetically for equal lengths.
 * @param {string[]} tiles
 * @returns {{maximum: number, words: string[]}}
 */
function computeMaxRoundScore(tiles) {
  const expectedCells = BOGGLE_SIZE * BOGGLE_SIZE;
  if (!Array.isArray(tiles) || tiles.length !== expectedCells) {
    throw new Error(`Expected a ${BOGGLE_SIZE}x${BOGGLE_SIZE} board.`);
  }
  if (tiles.some(tile => typeof tile !== 'string' || !/^[A-Z]$/.test(tile))) {
    throw new Error('Board contains a non-letter cell.');
  }
  if (!(state.dictionary instanceof Set) || state.dictionary.size === 0) {
    throw new Error('Cannot compute board maximum without a loaded dictionary.');
  }

  const words = [];
  let maximum = 0;
  for (const candidate of state.dictionary) {
    if (!canTrace(tiles, candidate)) continue;
    words.push(candidate);
    maximum += points(candidate.length);
  }
  words.sort((left, right) => right.length - left.length || left.localeCompare(right));
  return { maximum, words };
}

/**
 * Sum maximums for all boards dealt so far, or null if any calculation failed.
 * @returns {number|null}
 */
function totalMaximum() {
  if (state.maxRoundScores.some(value => value === null)) return null;
  return state.maxRoundScores.reduce((sum, value) => sum + (Number.isInteger(value) ? value : 0), 0);
}

function hashSeed(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let value = seed;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function createRoundBoard(round) {
  const random = createSeededRandom(hashSeed(`${BOGGLE_DAILY_SEED}:round:${round}`));
  return Array.from(
    { length: BOGGLE_SIZE * BOGGLE_SIZE },
    () => BOGGLE_BAG[Math.floor(random() * BOGGLE_BAG.length)]
  );
}

function adjacent(a, b) {
  const ar = Math.floor(a / BOGGLE_SIZE);
  const ac = a % BOGGLE_SIZE;
  const br = Math.floor(b / BOGGLE_SIZE);
  const bc = b % BOGGLE_SIZE;
  return Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1 && a !== b;
}

function getDragTile(event) {
  const tile = document.elementFromPoint(event.clientX, event.clientY)?.closest('.boggle-tile');
  if (!tile || !el.grid.contains(tile)) return null;

  const rect = tile.getBoundingClientRect();
  const horizontalInset = rect.width * (1 - BOGGLE_DRAG_SAFE_ZONE_RATIO) / 2;
  const verticalInset = rect.height * (1 - BOGGLE_DRAG_SAFE_ZONE_RATIO) / 2;
  const isInsideSafeZone = event.clientX >= rect.left + horizontalInset
    && event.clientX <= rect.right - horizontalInset
    && event.clientY >= rect.top + verticalInset
    && event.clientY <= rect.bottom - verticalInset;
  return isInsideSafeZone ? tile : null;
}

function getDiagonalIntent(index, event) {
  const lastTile = el.grid.querySelector(`.boggle-tile[data-index="${index}"]`);
  if (!lastTile) return null;

  const rect = lastTile.getBoundingClientRect();
  const horizontalDistance = event.clientX - (rect.left + (rect.width / 2));
  const verticalDistance = event.clientY - (rect.top + (rect.height / 2));
  const horizontalMagnitude = Math.abs(horizontalDistance);
  const verticalMagnitude = Math.abs(verticalDistance);
  const largerMagnitude = Math.max(horizontalMagnitude, verticalMagnitude);
  const smallerMagnitude = Math.min(horizontalMagnitude, verticalMagnitude);

  if (largerMagnitude < rect.width * 0.25 || smallerMagnitude / largerMagnitude < BOGGLE_DIAGONAL_INTENT_RATIO) {
    return null;
  }

  const row = Math.floor(index / BOGGLE_SIZE) + Math.sign(verticalDistance);
  const column = (index % BOGGLE_SIZE) + Math.sign(horizontalDistance);
  if (row < 0 || row >= BOGGLE_SIZE || column < 0 || column >= BOGGLE_SIZE) return null;
  return (row * BOGGLE_SIZE) + column;
}

function isGameSafeWord(word) {
  if (typeof word !== 'string') return false;

  const upper = word.trim().toUpperCase();
  if (!/^[A-Z]{4,25}$/.test(upper)) return false;
  if (BOGGLE_PROPER_NOUN_DENYLIST.has(upper)) return false;
  if (BOGGLE_OFFENSIVE_DENYLIST.has(upper)) return false;
  return true;
}

function normaliseDictionaryWord(word) {
  if (typeof word !== 'string') return '';
  const upper = word.trim().toUpperCase();
  return BOGGLE_UK_SPELLING_MAP[upper] || upper;
}

function roundScore() {
  return [...state.words.values()].reduce((sum, value) => sum + value, 0);
}

function total() {
  return state.roundScores.reduce((sum, value) => sum + value, 0) + (state.locked ? 0 : roundScore());
}

function message(text, invalid = false) {
  el.status.textContent = text;
  el.status.style.color = invalid ? '#fecaca' : '#ffffff';
}

function render() {
  const tileButtons = state.tiles.map((letter, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'grid-cell boggle-tile';
    button.dataset.index = String(index);
    button.textContent = letter === 'Q' ? 'Qu' : letter;
    button.setAttribute('aria-label', letter === 'Q' ? 'Qu' : letter);
    button.classList.toggle('is-selected', state.path.includes(index));
    button.classList.toggle('is-first-selected', state.desktopPathDrawing && state.path[0] === index);
    button.classList.toggle('is-last-selected', state.selectionComplete && state.path.at(-1) === index);
    button.classList.toggle('is-invalid-selection', state.selectionFeedback === 'invalid' && state.path.includes(index));
    button.classList.toggle('is-duplicate-selection', state.selectionFeedback === 'duplicate' && state.path.includes(index));
    button.disabled = state.locked;
    button.addEventListener('pointerdown', event => {
      if (state.locked) return;
      if (event.pointerType === 'touch') {
        state.suppressNextTouchClick = false;
        cancelLongPress();
        state.longPressTimer = window.setTimeout(() => {
          state.longPressTimer = null;
          if (state.locked || state.path.length === 0) return;
          state.suppressNextTouchClick = true;
          clearCurrentSelection('Word selection cleared.');
        }, BOGGLE_LONG_PRESS_MS);
        return;
      }
      if (event.pointerType !== 'mouse') return;
      event.preventDefault();
      state.ignoreNextMouseClick = true;
      if (clearRejectedSelection()) return;
      if (state.desktopPathDrawing) {
        if (state.path.at(-1) !== index) select(index);
        completeSelection();
        return;
      }

      state.desktopPathDrawing = true;
      state.selectionComplete = false;
      select(index);
      message('Path started. Move across adjacent tiles, then click the final tile.');
    });
    button.addEventListener('pointerup', cancelLongPress);
    button.addEventListener('pointercancel', cancelLongPress);
    button.addEventListener('pointerleave', cancelLongPress);
    button.addEventListener('contextmenu', event => event.preventDefault());
    button.addEventListener('click', event => {
      if (state.suppressNextTouchClick) {
        state.suppressNextTouchClick = false;
        return;
      }
      if (event.detail !== 0 && state.ignoreNextMouseClick) {
        state.ignoreNextMouseClick = false;
        return;
      }
      if (clearRejectedSelection()) return;
      if (state.path.at(-1) === index && state.path.length > 0) {
        completeSelection();
        return;
      }
      select(index);
    });
    return button;
  });

  el.grid.querySelectorAll('.boggle-tile').forEach(tile => tile.remove());
  el.grid.prepend(...tileButtons);
  el.preview.replaceChildren(...state.path.map(index => {
    const tile = document.createElement('span');
    tile.className = 'boggle-preview-tile';
    tile.textContent = tileText(index);
    return tile;
  }));
  el.backspace.disabled = state.locked || state.path.length === 0;
  el.clear.disabled = state.locked || state.path.length === 0;
  
  // Render Score as mini-tiles
  const scoreStr = String(total());
  el.score.replaceChildren(...scoreStr.split('').map(char => {
    const span = document.createElement('span');
    span.className = 'mini-tile header-tile';
    span.textContent = char;
    return span;
  }));

  const maximum = totalMaximum();
  if (el.maxBar && el.maxBarFill) {
    const ratio = maximum !== null && maximum > 0 ? Math.min(total() / maximum, 1) : 0;
    el.maxBarFill.style.width = `${(ratio * 100).toFixed(1)}%`;
    el.maxBarFill.style.backgroundColor = `hsl(${Math.round(ratio * 120)} 68% 46%)`;
    el.maxBar.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    el.maxBar.classList.toggle('is-idle', maximum === null || maximum <= 0);
    const badge = document.getElementById('boggle-max-badge');
    if (badge) {
      if (maximum !== null && maximum > 0) {
        const pct = Math.round((total() / maximum) * 100);
        badge.textContent = `${total()} / ${maximum} (${pct}%)`;
      } else {
        badge.textContent = '';
      }
    }
  }

  // Update specific Round and Timer nodes directly to avoid thrashing
  const roundVal = document.getElementById('round-val');
  if (roundVal) roundVal.textContent = state.round;

  const tMin = document.getElementById('timer-min');
  const tSec1 = document.getElementById('timer-sec1');
  const tSec2 = document.getElementById('timer-sec2');
  if (tMin && tSec1 && tSec2) {
    const s = String(state.seconds % 60).padStart(2, '0');
    tMin.textContent = Math.floor(state.seconds / 60);
    tSec1.textContent = s[0];
    tSec2.textContent = s[1];
  }
}

function select(index) {
  if (state.locked) return;
  if (clearRejectedSelection()) return;

  const last = state.path.at(-1);
  if (state.path.includes(index)) {
    message('A tile can only be used once.', true);
    return;
  }
  if (last !== undefined && !adjacent(last, index)) {
    message('Next tile must touch the previous tile.', true);
    return;
  }

  state.path.push(index);
  state.selectionComplete = false;
  state.selectionFeedback = null;
  if (state.desktopPathDrawing) {
    message('Move across adjacent tiles, then click the final tile.');
  } else if (word().length >= 4) {
    message('Select more tiles, or tap the final tile again to enter the word.');
  } else {
    message('Select more adjacent tiles.');
  }
  render();
}

function completeSelection() {
  state.desktopPathDrawing = false;
  if (word().length < 4) {
    state.selectionComplete = false;
    render();
    message('Words need at least 4 letters.', true);
    return;
  }

  state.selectionComplete = true;
  render();
  message('Word selection complete.');
  window.setTimeout(() => {
    if (state.selectionComplete) submit();
  }, 120);
}

function cancelLongPress() {
  if (state.longPressTimer === null) return;
  window.clearTimeout(state.longPressTimer);
  state.longPressTimer = null;
}

function clearCurrentSelection(text) {
  state.desktopPathDrawing = false;
  state.selectionComplete = false;
  state.selectionFeedback = null;
  state.path = [];
  message(text);
  render();
}

function clearRejectedSelection() {
  if (!state.selectionFeedback) return false;

  clearCurrentSelection('Word selection cleared.');
  return true;
}

function submit() {
  state.desktopPathDrawing = false;
  state.selectionComplete = false;
  const candidate = word();
  if (candidate.length < 4) {
    state.selectionFeedback = 'invalid';
    render();
    message('Words need at least 4 letters.', true);
    return;
  }
  if (state.words.has(candidate)) {
    state.selectionFeedback = 'duplicate';
    render();
    message('Already found this round. Click any tile to clear it.', true);
    return;
  }
  if (!state.dictionary.has(candidate)) {
    state.selectionFeedback = 'invalid';
    render();
    message('Not in the British English dictionary. Click any tile to clear it.', true);
    return;
  }

  const earned = points(candidate.length);
  state.words.set(candidate, earned);
  state.path = [];
  state.selectionFeedback = null;
  message(`+${earned} ${earned === 1 ? 'point' : 'points'}: ${candidate}`);
  renderWords();
  render();
}

function renderWords() {
  const entries = [...state.words].sort(([a], [b]) => a.localeCompare(b));
  el.found.replaceChildren(...entries.map(([candidate, earned]) => {
    const item = document.createElement('li');
    item.className = 'found-word-row';
    
    // Cap at 10 to ensure the CSS class resolves safely
    const len = Math.min(candidate.length, 10);
    
    for (const letter of candidate) {
      const tile = document.createElement('span');
      tile.className = `mini-tile word-${len}`;
      tile.textContent = letter;
      item.append(tile);
    }

    const score = document.createElement('span');
    score.className = 'mini-tile points-tile';
    score.textContent = `+${earned}`;
    item.append(score);
    
    return item;
  }));
}

function renderWordTiles(container, words) {
  const sortedWords = [...words].sort((left, right) => right.length - left.length || left.localeCompare(right));
  container.replaceChildren(...sortedWords.map(candidate => {
    const item = document.createElement('li');
    item.className = 'found-word-row';
    const length = Math.min(candidate.length, 10);

    for (const letter of candidate) {
      const tile = document.createElement('span');
      tile.className = `mini-tile word-${length}`;
      tile.textContent = letter;
      item.append(tile);
    }

    const score = document.createElement('span');
    score.className = 'mini-tile points-tile';
    score.textContent = `+${points(candidate.length)}`;
    item.append(score);
    return item;
  }));
}

function createLeaderboardRow(entry, index, isInteractive = true) {
  const item = document.createElement('li');
  item.classList.add('boggle-score-entry');
  if (index === 0) item.classList.add('is-top-score');

  const initials = String(entry.initials || '---').padEnd(3, '-').slice(0, 3);
  const row = document.createElement('div');
  row.className = 'lb-row-container';

  const rank = document.createElement('div');
  rank.className = 'lb-rank';
  rank.textContent = `${index + 1}.`;

  const initialsGroup = document.createElement('div');
  initialsGroup.className = 'lb-initials-group';
  for (const initial of initials) {
    const tile = document.createElement('div');
    tile.className = 'lb-initial-tile';
    tile.textContent = initial;
    initialsGroup.append(tile);
  }

  const score = document.createElement('div');
  score.className = 'lb-score-tile';
  score.textContent = String(entry.score);
  row.append(rank, initialsGroup, score);
  item.append(row);
  if (!isInteractive) return item;

  item.tabIndex = 0;
  item.setAttribute('role', 'button');
  item.setAttribute('aria-label', `View words for ${entry.initials || 'unknown'} score ${entry.score}`);
  item.addEventListener('click', () => showLeaderboardWords(entry));
  item.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showLeaderboardWords(entry);
    }
  });
  return item;
}

function renderLeaderboard(scores, target, isInteractive = true) {
  if (scores.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'No scores today.';
    target.replaceChildren(item);
    return;
  }
  target.replaceChildren(...scores.map((entry, index) => createLeaderboardRow(entry, index, isInteractive)));
}

async function getLeaderboardScores() {
  const response = await fetch('validate.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_boggle_highscores' })
  });
  if (!response.ok) throw new Error('Unable to load Boggle scores.');

  const data = await response.json();
  return Array.isArray(data.highscores) ? data.highscores : [];
}

async function getYesterdaysDailyWinner() {
  const response = await fetch('validate.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_yesterdays_winner' })
  });
  if (!response.ok) throw new Error('Unable to load yesterday\'s winner.');

  const data = await response.json();
  if (!data || typeof data.winner_initials !== 'string' || data.winner_initials === '') {
    return null;
  }

  return {
    initials: data.winner_initials,
    mode: typeof data.mode === 'string' ? data.mode : 'classic',
    score: Number.isFinite(Number(data.score)) ? Number(data.score) : 0,
    date: typeof data.date === 'string' ? data.date : ''
  };
}

async function saveLeaderboardScore(score, initials) {
  const response = await fetch('validate.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'save_boggle_highscore', initials, score, words: state.roundWords.flat() })
  });
  if (!response.ok) throw new Error('Unable to save Boggle score.');

  return response.json();
}

function updateInitialTiles(input) {
  const initials = input.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  input.value = initials;
  for (let index = 0; index < 3; index += 1) {
    const tile = document.getElementById(`init-tile-${index + 1}`);
    if (!tile) continue;
    tile.textContent = initials[index] || '';
  }
}

function triggerHighScoreBurst() {
  const gridRect = el.grid.getBoundingClientRect();
  const centerX = gridRect.left + (gridRect.width / 2);
  const centerY = gridRect.top + (gridRect.height / 2);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const maxDimension = Math.max(window.innerWidth, window.innerHeight);
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 150; index += 1) {
    const particle = document.createElement('div');
    particle.className = `particle mega-burst${Math.random() > 0.5 ? ' alt' : ''}`;
    particle.textContent = alphabet[Math.floor(Math.random() * alphabet.length)];
    particle.style.left = `${centerX}px`;
    particle.style.top = `${centerY}px`;
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * (maxDimension * 0.6);
    particle.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
    particle.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
    particle.style.setProperty('--rot', `${(Math.random() - 0.5) * 720}deg`);
    fragment.append(particle);
    setTimeout(() => particle.remove(), 3000);
  }

  document.body.append(fragment);
}

async function showLeaderboard(isTopScore = false) {
  state.scoreScreen = 'postgame';
  el.previewPanel.hidden = true;
  el.foundPanel.hidden = true;
  el.help.hidden = true;
  el.summary.hidden = false;
  el.summary.classList.add('is-leaderboard');
  el.summary.classList.remove('is-word-list', 'is-score-entry', 'is-possible-words-expanded');
  el.summary.classList.toggle('is-celebration', isTopScore);
  el.summary.replaceChildren();

  const title = document.createElement('h2');
  title.textContent = isTopScore ? 'NEW DAILY HIGH SCORE!' : 'DETAILED HIGH SCORES';
  const scores = document.createElement('ul');
  scores.className = 'leaderboard-list';
  scores.textContent = 'Loading...';
  const playAgain = document.createElement('button');
  playAgain.className = 'arcade-btn';
  playAgain.type = 'button';
  playAgain.textContent = 'PLAY AGAIN';
  playAgain.addEventListener('click', startMatch);
  el.summary.append(title, scores, playAgain);

  if (isTopScore) triggerHighScoreBurst();

  try {
    renderLeaderboard(await getLeaderboardScores(), scores);
  } catch (error) {
    scores.textContent = 'Unable to load scores.';
  }
}

function showLeaderboardWords(entry) {
  const initials = String(entry.initials || '---').padEnd(3, '-').slice(0, 3);
  const words = Array.isArray(entry.words) ? entry.words.filter(word => typeof word === 'string') : [];

  el.summary.hidden = false;
  el.summary.classList.remove('is-celebration', 'is-score-entry', 'is-possible-words-expanded');
  el.summary.classList.add('is-leaderboard', 'is-word-list');
  el.summary.replaceChildren();

  const title = document.createElement('h2');
  title.textContent = `WORDS BY ${initials}`;
  const score = document.createElement('p');
  score.textContent = `Score: ${entry.score}`;
  const wordList = document.createElement('ul');
  wordList.className = 'boggle-score-words';

  if (words.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'Word details are unavailable for this earlier score.';
    wordList.append(item);
  } else {
    renderWordTiles(wordList, words);
  }

  const backButton = document.createElement('button');
  backButton.className = 'arcade-btn';
  backButton.type = 'button';
  backButton.textContent = state.scoreScreen === 'opening' ? 'TODAY\'S SCORES' : 'HIGH SCORES';
  backButton.addEventListener('click', () => {
    if (state.scoreScreen === 'opening') {
      showOpeningLeaderboard();
      return;
    }
    showLeaderboard();
  });
  const children = [title, score, wordList];

  const finalRoundPossibleWords = state.maxRoundWords[BOGGLE_ROUNDS - 1] ?? [];
  const allRoundsComplete = state.roundWords.length === BOGGLE_ROUNDS;
  if (allRoundsComplete && finalRoundPossibleWords.length > 0) {
    const toggleButton = document.createElement('button');
    toggleButton.className = 'arcade-btn mini-btn';
    toggleButton.type = 'button';
    toggleButton.textContent = `SHOW POSSIBLE WORDS (${finalRoundPossibleWords.length})`;
    toggleButton.setAttribute('aria-expanded', 'false');

    const possibleTitle = document.createElement('p');
    possibleTitle.textContent = `POSSIBLE WORDS (${finalRoundPossibleWords.length})`;
    possibleTitle.hidden = true;

    const possibleList = document.createElement('ul');
    possibleList.className = 'boggle-score-words boggle-possible-words';
    possibleList.hidden = true;
    renderWordTiles(possibleList, finalRoundPossibleWords);

    toggleButton.addEventListener('click', () => {
      const expanded = toggleButton.getAttribute('aria-expanded') === 'true';
      toggleButton.setAttribute('aria-expanded', String(!expanded));
      toggleButton.textContent = expanded
        ? `SHOW POSSIBLE WORDS (${finalRoundPossibleWords.length})`
        : 'HIDE POSSIBLE WORDS';
      possibleTitle.hidden = expanded;
      possibleList.hidden = expanded;
    });

    children.push(toggleButton, possibleTitle, possibleList);
  }

  children.push(backButton);
  el.summary.append(...children);
}

function openScoreEntry(score) {
  el.summary.hidden = false;
  el.summary.classList.remove('is-leaderboard', 'is-word-list', 'is-celebration', 'is-possible-words-expanded');
  el.summary.classList.add('is-score-entry');
  const gameMaximum = totalMaximum();
  const finalRoundPlayerWords = [...(state.roundWords[BOGGLE_ROUNDS - 1] ?? [])];
  const finalRoundPossibleWords = state.maxRoundWords[BOGGLE_ROUNDS - 1] ?? [];
  const roundResults = state.roundScores.map((roundScore, index) => {
    const roundMaximum = state.maxRoundScores[index];
    return `Round ${index + 1}: ${roundScore}${Number.isInteger(roundMaximum) ? `/${roundMaximum}` : ''}`;
  }).join(' | ');
  const maximumSummary = gameMaximum === null
    ? ''
    : `<p>Theoretical maximum: <strong>${gameMaximum}</strong></p>`;
  el.summary.innerHTML = `
    <h2 style="margin-top:0; color:var(--highlight);">GAME OVER</h2>
    <p>${roundResults}</p>
    ${maximumSummary}
    <div style="font-size:20px; margin-bottom:25px;">
      Final Score: <strong id="final-score-display" style="color:var(--highlight)">${score}</strong>
    </div>
    <div id="daily-save-section">
      <div class="initials-wrapper">
        <input type="text" id="hidden-initials" class="hidden-initials-input" maxlength="3" autocomplete="off">
        <div class="initial-tile" id="init-tile-1"></div>
        <div class="initial-tile" id="init-tile-2"></div>
        <div class="initial-tile" id="init-tile-3"></div>
      </div>
      <button class="arcade-btn" id="submit-score-btn" type="button">SAVE SCORE</button>
    </div>
  `;

  const saveSection = document.getElementById('daily-save-section');

  const yourWordsTitle = document.createElement('p');
  yourWordsTitle.textContent = finalRoundPlayerWords.length > 0
    ? `ROUND ${BOGGLE_ROUNDS} — YOUR WORDS (${finalRoundPlayerWords.length})`
    : `ROUND ${BOGGLE_ROUNDS} — NO WORDS FOUND`;
  const yourWordsList = document.createElement('ul');
  yourWordsList.className = 'boggle-score-words';
  renderWordTiles(yourWordsList, finalRoundPlayerWords);
  saveSection.before(yourWordsTitle, yourWordsList);

  if (finalRoundPossibleWords.length > 0) {
    const toggleButton = document.createElement('button');
    toggleButton.className = 'arcade-btn mini-btn';
    toggleButton.type = 'button';
    toggleButton.textContent = `SHOW POSSIBLE WORDS (${finalRoundPossibleWords.length})`;
    toggleButton.setAttribute('aria-expanded', 'false');

    const possibleTitle = document.createElement('p');
    possibleTitle.textContent = `POSSIBLE WORDS (${finalRoundPossibleWords.length})`;
    possibleTitle.hidden = true;

    const possibleList = document.createElement('ul');
    possibleList.className = 'boggle-score-words boggle-possible-words';
    possibleList.hidden = true;
    renderWordTiles(possibleList, finalRoundPossibleWords);

    toggleButton.addEventListener('click', () => {
      const expanded = toggleButton.getAttribute('aria-expanded') === 'true';
      toggleButton.setAttribute('aria-expanded', String(!expanded));
      toggleButton.textContent = expanded
        ? `SHOW POSSIBLE WORDS (${finalRoundPossibleWords.length})`
        : 'HIDE POSSIBLE WORDS';
      possibleTitle.hidden = expanded;
      possibleList.hidden = expanded;
    });

    saveSection.before(toggleButton, possibleTitle, possibleList);
  }

  const input = document.getElementById('hidden-initials');
  const wrapper = el.summary.querySelector('.initials-wrapper');
  const saveButton = document.getElementById('submit-score-btn');
  if (!input || !wrapper || !saveButton) return;

  const focusInput = () => {
    input.focus();
    window.setTimeout(() => input.focus(), 50);
  };
  input.addEventListener('input', () => updateInitialTiles(input));
  input.addEventListener('focus', () => wrapper.classList.add('focused'));
  input.addEventListener('blur', () => wrapper.classList.remove('focused'));
  input.addEventListener('paste', event => {
    event.preventDefault();
    input.value = (event.clipboardData || window.clipboardData).getData('text').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  input.addEventListener('keydown', event => {
    if (/^[a-zA-Z]$/.test(event.key)) {
      event.preventDefault();
      input.value = (input.value + event.key.toUpperCase()).slice(0, 3);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      focusInput();
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      input.value = input.value.slice(0, -1);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      focusInput();
    }
  });
  wrapper.setAttribute('tabindex', '0');
  wrapper.setAttribute('role', 'textbox');
  wrapper.setAttribute('aria-label', 'Enter your initials');
  wrapper.addEventListener('click', focusInput);
  wrapper.addEventListener('touchstart', focusInput);
  wrapper.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      focusInput();
    }
  });
  saveButton.addEventListener('click', async () => {
    saveButton.disabled = true;
    try {
      const result = await saveLeaderboardScore(score, input.value);
      await showLeaderboard(result.is_top_score === true);
    } catch (error) {
      message('Score could not be saved.', true);
      saveButton.disabled = false;
    }
  });
  focusInput();
}

function finishRound() {
  if (state.locked) return;

  cancelLongPress();
  state.locked = true;
  clearInterval(state.timer);
  state.path = [];
  state.roundScores.push(roundScore());
  state.roundWords.push([...state.words.keys()]);
  render();
  showSummary(state.round === BOGGLE_ROUNDS);
}

function showSummary(done) {
  const current = state.roundScores.at(-1);
  const totalScore = state.roundScores.reduce((sum, value) => sum + value, 0);
  if (done) {
    openScoreEntry(totalScore);
    return;
  }

  el.summary.hidden = false;
  el.summary.classList.remove('is-leaderboard', 'is-celebration', 'is-score-entry', 'is-possible-words-expanded');
  el.summary.classList.add('is-word-list');
  const nextRound = state.round + 1;
  const boardMaximum = state.maxRoundScores[state.round - 1];
  const boardWords = state.maxRoundWords[state.round - 1] ?? [];
  const playerWords = state.roundWords[state.round - 1] ?? [];

  const title = document.createElement('h2');
  title.textContent = `ROUND ${state.round} COMPLETE`;

  const roundScore = document.createElement('p');
  roundScore.textContent = Number.isInteger(boardMaximum)
    ? `Round ${state.round} score: ${current}/${boardMaximum}`
    : `Round ${state.round} score: ${current}`;

  const cumulative = document.createElement('p');
  const cumulativeStrong = document.createElement('strong');
  cumulativeStrong.textContent = `Cumulative score: ${totalScore}`;
  cumulative.appendChild(cumulativeStrong);

  const playerWordsTitle = document.createElement('p');
  playerWordsTitle.textContent = playerWords.length > 0
    ? `YOUR WORDS (${playerWords.length})`
    : 'NO WORDS FOUND';
  const playerWordsList = document.createElement('ul');
  playerWordsList.className = 'boggle-score-words';
  renderWordTiles(playerWordsList, playerWords);

  const startButton = document.createElement('button');
  startButton.className = 'arcade-btn';
  startButton.type = 'button';
  startButton.textContent = `START ROUND ${nextRound}`;
  startButton.addEventListener('click', () => startRound(nextRound));

  const children = [title, roundScore, cumulative, playerWordsTitle, playerWordsList];

  if (boardWords.length > 0) {
    const toggleButton = document.createElement('button');
    toggleButton.className = 'arcade-btn mini-btn';
    toggleButton.type = 'button';
    toggleButton.textContent = `SHOW POSSIBLE WORDS (${boardWords.length})`;
    toggleButton.setAttribute('aria-expanded', 'false');

    const possibleTitle = document.createElement('p');
    possibleTitle.textContent = `POSSIBLE WORDS (${boardWords.length})`;
    possibleTitle.hidden = true;

    const possibleList = document.createElement('ul');
    possibleList.className = 'boggle-score-words boggle-possible-words';
    possibleList.hidden = true;
    renderWordTiles(possibleList, boardWords);

    toggleButton.addEventListener('click', () => {
      const expanded = toggleButton.getAttribute('aria-expanded') === 'true';
      toggleButton.setAttribute('aria-expanded', String(!expanded));
      el.summary.classList.toggle('is-possible-words-expanded', !expanded);
      toggleButton.textContent = expanded
        ? `SHOW POSSIBLE WORDS (${boardWords.length})`
        : 'HIDE POSSIBLE WORDS';
      possibleTitle.hidden = expanded;
      possibleList.hidden = expanded;
    });

    children.push(toggleButton, possibleTitle, possibleList);
  }

  children.push(startButton);
  el.summary.replaceChildren(...children);
}

function startRound(round) {
  cancelLongPress();
  clearInterval(state.timer);
  state.round = round;
  state.seconds = BOGGLE_SECONDS;
  state.tiles = createRoundBoard(round);
  try {
    const result = computeMaxRoundScore(state.tiles);
    state.maxRoundScores[round - 1] = result.maximum;
    state.maxRoundWords[round - 1] = result.words;
  } catch (error) {
    console.error(`Boggle max-score solver failed for round ${round}:`, error);
    state.maxRoundScores[round - 1] = null;
    state.maxRoundWords[round - 1] = [];
  }
  state.path = [];
  state.words = new Map();
  state.locked = false;
  state.selectionComplete = false;
  state.selectionFeedback = null;
  state.suppressNextTouchClick = false;
  el.previewPanel.hidden = false;
  el.foundPanel.hidden = false;
  el.help.hidden = true;
  el.summary.hidden = true;
  el.summary.classList.remove('is-leaderboard', 'is-word-list', 'is-score-entry', 'is-possible-words-expanded');
  el.summary.classList.remove('is-celebration');
  el.summary.replaceChildren();
  renderWords();
  message(`Round ${round} has started.`);
  render();
  state.timer = setInterval(() => {
    state.seconds -= 1;
    if (state.seconds <= 0) {
      state.seconds = 0;
      finishRound();
      return;
    }
    render();
  }, 1000);
}

function startMatch() {
  state.roundScores = [];
  state.roundWords = [];
  state.maxRoundScores = [];
  state.maxRoundWords = [];
  startRound(1);
}

async function showOpeningLeaderboard(initialScores = null) {
  state.scoreScreen = 'opening';
  el.previewPanel.hidden = true;
  el.foundPanel.hidden = true;
  el.help.hidden = true;
  el.summary.hidden = false;
  el.summary.classList.add('is-leaderboard');
  el.summary.classList.remove('is-word-list', 'is-celebration', 'is-score-entry', 'is-possible-words-expanded');
  el.summary.replaceChildren();

  const title = document.createElement('h2');
  title.textContent = 'TODAY\'S HIGH SCORES';
  const scores = document.createElement('ul');
  scores.className = 'leaderboard-list';
  scores.textContent = 'Loading...';
  const rules = document.createElement('p');
  rules.className = 'boggle-opening-rules';
  rules.textContent = 'Three rounds. Two minutes each. Find words of four letters or more.';
  const startButton = document.createElement('button');
  startButton.className = 'arcade-btn';
  startButton.type = 'button';
  startButton.textContent = 'START GAME';
  startButton.addEventListener('click', startMatch);
  el.summary.append(title, scores, rules, startButton);

  if (Array.isArray(initialScores)) {
    renderLeaderboard(initialScores, scores, false);
    return;
  }

  try {
    renderLeaderboard(await getLeaderboardScores(), scores, false);
  } catch (error) {
    scores.textContent = 'Unable to load scores.';
  }
}

function showArrivalCelebration(winner) {
  const initials = String(winner.initials || '---').padEnd(3, '-').slice(0, 3);
  state.scoreScreen = 'opening';
  el.previewPanel.hidden = true;
  el.foundPanel.hidden = true;
  el.help.hidden = true;
  el.summary.hidden = false;
  el.summary.classList.remove('is-leaderboard', 'is-word-list', 'is-score-entry', 'is-possible-words-expanded');
  el.summary.classList.add('is-celebration');
  el.summary.replaceChildren();

  const title = document.createElement('h2');
  title.textContent = 'YESTERDAY\'S CHAMPION';
  const champion = document.createElement('p');
  champion.className = 'boggle-champion';
  champion.textContent = initials;
  const score = document.createElement('p');
  score.textContent = `Score: ${winner.score}`;
  const continueButton = document.createElement('button');
  continueButton.className = 'arcade-btn';
  continueButton.type = 'button';
  continueButton.textContent = 'VIEW TODAY\'S SCORES';
  continueButton.addEventListener('click', showOpeningLeaderboard);
  el.summary.append(title, champion, score, continueButton);
  triggerHighScoreBurst();
}

async function showStartScreen() {
  const [winner, scores] = await Promise.all([
    getYesterdaysDailyWinner().catch(() => null),
    getLeaderboardScores().catch(() => [])
  ]);
  if (winner) {
    showArrivalCelebration(winner);
    return;
  }

  await showOpeningLeaderboard(scores);
}

function viewHighScores() {
  if (!state.locked) {
    clearInterval(state.timer);
    state.locked = true;
    state.path = [];
    state.selectionComplete = false;
    state.selectionFeedback = null;
    render();
  }
  showLeaderboard();
}

async function loadDictionary() {
  try {
    // The dictionary is a versioned, immutable asset: the filename carries the
    // version, so a dictionary change ships as a new filename and force-cache
    // never serves a stale word list to a returning player.
    const response = await fetch('data/dict_en_v17.txt', { cache: 'force-cache' });
    if (!response.ok) throw new Error('Dictionary unavailable');
    const text = await response.text();

    const seen = new Set();
    for (const rawEntry of text.trim().split(/\r?\n/)) {
      const word = normaliseDictionaryWord(rawEntry);
      if (!isGameSafeWord(word)) continue;
      if (!seen.has(word)) {
        seen.add(word);
        state.dictionary.add(word);
      }
    }

    if (state.dictionary.size === 0) throw new Error('Dictionary empty');
    await showStartScreen();
  } catch (error) {
    console.error('Boggle dictionary load failed:', error);
    message('Dictionary failed to load. Refresh or contact the site owner.', true);
  }
}

el.backspace.addEventListener('click', () => {
  state.desktopPathDrawing = false;
  state.selectionComplete = false;
  state.selectionFeedback = null;
  state.path.pop();
  message('Last tile removed.');
  render();
});
el.clear.addEventListener('click', () => {
  clearCurrentSelection('Word cleared.');
});
el.timer.addEventListener('click', viewHighScores);
el.helpButton.addEventListener('click', () => {
  el.help.hidden = false;
});
el.closeHelp.addEventListener('click', () => {
  el.help.hidden = true;
});
el.grid.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || !state.desktopPathDrawing || state.locked) return;

  const tile = getDragTile(event);
  if (!tile) return;

  const index = Number.parseInt(tile.dataset.index ?? '', 10);
  const lastIndex = state.path.at(-1);
  if (!Number.isInteger(index) || lastIndex === index) return;

  const diagonalIntent = getDiagonalIntent(lastIndex, event);
  if (diagonalIntent !== null && diagonalIntent !== index) return;
  select(index);
});
window.addEventListener('blur', () => {
  cancelLongPress();
  state.desktopPathDrawing = false;
});
window.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || state.locked || state.path.length === 0 || !el.help.hidden) return;
  event.preventDefault();
  cancelLongPress();
  clearCurrentSelection('Word selection cleared.');
});
loadDictionary();
