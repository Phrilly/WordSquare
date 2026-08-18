const BOGGLE_SIZE = 5;
const BOGGLE_ROUNDS = 3;
const BOGGLE_SECONDS = 120;
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
  tiles: [], path: [], words: new Map(), round: 1, roundScores: [], roundWords: [], seconds: BOGGLE_SECONDS,
  dictionary: new Set(), locked: true, timer: null, desktopPathDrawing: false, selectionComplete: false, selectionFeedback: null, ignoreNextMouseClick: false, lastTileClickIndex: null, lastTileClickTime: 0
};
const el = {
  grid: document.getElementById('boggle-grid'),
  preview: document.getElementById('boggle-preview-tiles'),
  status: document.getElementById('boggle-status'),
  score: document.getElementById('boggle-score'),
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

function tileText(index) {
  return state.tiles[index] === 'Q' ? 'QU' : state.tiles[index];
}

function word() {
  return state.path.map(tileText).join('');
}

function points(length) {
  return length === 4 ? 1 : length === 5 ? 2 : length === 6 ? 3 : length === 7 ? 5 : length >= 8 ? 11 : 0;
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
      if (event.pointerType !== 'mouse' || state.locked) return;
      event.preventDefault();
      state.ignoreNextMouseClick = true;
      if (isAbandonDoubleClick(index)) return;
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
    button.addEventListener('click', event => {
      if (event.detail !== 0 && state.ignoreNextMouseClick) {
        state.ignoreNextMouseClick = false;
        return;
      }
      if (isAbandonDoubleClick(index)) return;
      if (clearRejectedSelection()) return;
      if (state.path.at(-1) === index && state.path.length > 0) {
        completeSelection();
        return;
      }
      select(index);
    });
    return button;
  });

  el.grid.replaceChildren(...tileButtons, el.summary, el.help);
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

function isAbandonDoubleClick(index) {
  const now = Date.now();
  const isSecondClick = state.path.length > 0
    && state.lastTileClickIndex === index
    && now - state.lastTileClickTime <= 400;

  state.lastTileClickIndex = index;
  state.lastTileClickTime = now;
  if (!isSecondClick) return false;

  state.desktopPathDrawing = false;
  state.selectionComplete = false;
  state.selectionFeedback = null;
  state.path = [];
  state.lastTileClickIndex = null;
  state.lastTileClickTime = 0;
  message('Word selection cleared.');
  render();
  return true;
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

function clearRejectedSelection() {
  if (!state.selectionFeedback) return false;

  state.desktopPathDrawing = false;
  state.selectionComplete = false;
  state.selectionFeedback = null;
  state.path = [];
  message('Word selection cleared.');
  render();
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

function createLeaderboardRow(entry, index) {
  const item = document.createElement('li');
  item.classList.add('boggle-score-entry');
  if (index === 0) item.classList.add('is-top-score');
  item.tabIndex = 0;
  item.setAttribute('role', 'button');
  item.setAttribute('aria-label', `View words for ${entry.initials || 'unknown'} score ${entry.score}`);

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
  item.addEventListener('click', () => showLeaderboardWords(entry));
  item.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showLeaderboardWords(entry);
    }
  });
  return item;
}

function renderLeaderboard(scores, target) {
  if (scores.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'No scores today.';
    target.replaceChildren(item);
    return;
  }
  target.replaceChildren(...scores.map(createLeaderboardRow));
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
  el.previewPanel.hidden = true;
  el.foundPanel.hidden = true;
  el.help.hidden = true;
  el.summary.hidden = false;
  el.summary.classList.add('is-leaderboard');
  el.summary.classList.remove('is-word-list');
  el.summary.classList.toggle('is-celebration', isTopScore);
  el.summary.replaceChildren();

  const title = document.createElement('h2');
  title.textContent = isTopScore ? 'NEW DAILY HIGH SCORE!' : 'HIGH SCORES';
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
  el.summary.classList.remove('is-celebration');
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
  backButton.textContent = 'HIGH SCORES';
  backButton.addEventListener('click', () => showLeaderboard());
  el.summary.append(title, score, wordList, backButton);
}

function openScoreEntry(score) {
  el.summary.hidden = false;
  el.summary.classList.remove('is-leaderboard', 'is-word-list');
  el.summary.classList.remove('is-celebration');
  el.summary.innerHTML = `
    <h2 style="margin-top:0; color:var(--highlight);">GAME OVER</h2>
    <p>${state.roundScores.map((roundScore, index) => `Round ${index + 1}: ${roundScore}`).join(' | ')}</p>
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
  el.summary.classList.remove('is-leaderboard', 'is-word-list');
  el.summary.classList.remove('is-celebration');
  const nextRound = state.round + 1;
  el.summary.innerHTML = `<h2>ROUND ${state.round} COMPLETE</h2><p>Round ${state.round} score: ${current}</p><p><strong>Cumulative score: ${totalScore}</strong></p><button class="arcade-btn" type="button">START ROUND ${nextRound}</button>`;
  el.summary.querySelector('button').addEventListener('click', () => startRound(nextRound));
}

function startRound(round) {
  clearInterval(state.timer);
  state.round = round;
  state.seconds = BOGGLE_SECONDS;
  state.tiles = createRoundBoard(round);
  state.path = [];
  state.words = new Map();
  state.locked = false;
  state.selectionComplete = false;
  state.selectionFeedback = null;
  el.previewPanel.hidden = false;
  el.foundPanel.hidden = false;
  el.help.hidden = true;
  el.summary.hidden = true;
  el.summary.classList.remove('is-leaderboard', 'is-word-list');
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
  startRound(1);
}

function showStartScreen() {
  el.previewPanel.hidden = true;
  el.foundPanel.hidden = true;
  el.help.hidden = true;
  el.summary.hidden = false;
  el.summary.classList.remove('is-leaderboard', 'is-celebration');
  el.summary.innerHTML = '<h2>BOGGLE</h2><p>Three rounds. Two minutes each.</p><p>Find words of four letters or more.</p><button class="arcade-btn" type="button">START GAME</button>';
  el.summary.querySelector('button').addEventListener('click', startMatch);
  render();
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
    const response = await fetch('data/boggle-uk-game.txt', { cache: 'force-cache' });
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
    showStartScreen();
  } catch (error) {
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
  state.desktopPathDrawing = false;
  state.selectionComplete = false;
  state.selectionFeedback = null;
  state.path = [];
  message('Word cleared.');
  render();
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

  const tile = document.elementFromPoint(event.clientX, event.clientY)?.closest('.boggle-tile');
  if (!tile || !el.grid.contains(tile)) return;

  const index = Number.parseInt(tile.dataset.index ?? '', 10);
  if (Number.isInteger(index) && state.path.at(-1) !== index) select(index);
});
window.addEventListener('blur', () => {
  state.desktopPathDrawing = false;
});
loadDictionary();
