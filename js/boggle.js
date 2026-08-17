const BOGGLE_SIZE = 5;
const BOGGLE_ROUNDS = 3;
const BOGGLE_SECONDS = 120;
const BOGGLE_BAG = 'AAAAAAAAAAAAAAEEEEEEEEEEEEEEEEEEEEIIIIIIIIIIIIOOOOOOOOOOUUUUUUUUUSSSSSSSSSSTTTTTTTTTTNNNNNNNNRRRRRRRRHHHHHHDDDDDDLLLLLLCCCCCCMMMMMMPPPPFFGGGGYYWWVVBBKKXJQZ';
const state = {
  tiles: [], path: [], words: new Map(), round: 1, roundScores: [], seconds: BOGGLE_SECONDS,
  dictionary: new Set(), locked: true, timer: null, desktopPathDrawing: false, selectionComplete: false, ignoreNextMouseClick: false
};
const el = {
  grid: document.getElementById('boggle-grid'),
  preview: document.getElementById('boggle-preview-tiles'),
  status: document.getElementById('boggle-status'),
  score: document.getElementById('boggle-score'),
  round: document.getElementById('boggle-round'),
  timer: document.getElementById('boggle-timer'),
  backspace: document.getElementById('boggle-backspace'),
  clear: document.getElementById('boggle-clear'),
  found: document.getElementById('boggle-found-list'),
  summary: document.getElementById('boggle-summary'),
  leaderboard: document.getElementById('boggle-leaderboard-list')
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

function adjacent(a, b) {
  const ar = Math.floor(a / BOGGLE_SIZE);
  const ac = a % BOGGLE_SIZE;
  const br = Math.floor(b / BOGGLE_SIZE);
  const bc = b % BOGGLE_SIZE;
  return Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1 && a !== b;
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
    button.disabled = state.locked;
    button.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || state.locked) return;
      event.preventDefault();
      state.ignoreNextMouseClick = true;
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
      if (state.path.at(-1) === index && state.path.length > 0) {
        completeSelection();
        return;
      }
      select(index);
    });
    return button;
  });

  el.grid.replaceChildren(...tileButtons, el.summary);
  el.preview.replaceChildren(...state.path.map(index => {
    const tile = document.createElement('span');
    tile.className = 'boggle-preview-tile';
    tile.textContent = tileText(index);
    return tile;
  }));
  el.backspace.disabled = state.locked || state.path.length === 0;
  el.clear.disabled = state.locked || state.path.length === 0;
  el.score.textContent = String(total());
  el.round.textContent = `ROUND ${state.round} OF ${BOGGLE_ROUNDS}`;
  el.timer.textContent = `${Math.floor(state.seconds / 60)}:${String(state.seconds % 60).padStart(2, '0')}`;
}

function select(index) {
  if (state.locked) return;

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

function submit() {
  state.desktopPathDrawing = false;
  state.selectionComplete = false;
  const candidate = word();
  if (candidate.length < 4) {
    message('Words need at least 4 letters.', true);
    return;
  }
  if (state.words.has(candidate)) {
    message('Already found this round.', true);
    return;
  }
  if (!state.dictionary.has(candidate)) {
    message('Not in the British English dictionary. Use Backspace to correct it.', true);
    return;
  }

  const earned = points(candidate.length);
  state.words.set(candidate, earned);
  state.path = [];
  message(`+${earned} ${earned === 1 ? 'point' : 'points'}: ${candidate}`);
  renderWords();
  render();
}

function renderWords() {
  const entries = [...state.words].sort(([a], [b]) => a.localeCompare(b));
  el.found.replaceChildren(...entries.map(([candidate, earned]) => {
    const item = document.createElement('li');
    item.textContent = candidate;
    const score = document.createElement('strong');
    score.textContent = `+${earned}`;
    item.append(score);
    return item;
  }));
}

function createLeaderboardRow(entry, index) {
  const item = document.createElement('li');
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
  return item;
}

function renderLeaderboard(scores, target = el.leaderboard) {
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

async function loadLeaderboard() {
  try {
    renderLeaderboard(await getLeaderboardScores());
  } catch (error) {
    el.leaderboard.replaceChildren(Object.assign(document.createElement('li'), { textContent: 'Unable to load scores.' }));
  }
}

async function saveLeaderboardScore(score, initials) {
  const response = await fetch('validate.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'save_boggle_highscore', initials, score })
  });
  if (!response.ok) throw new Error('Unable to save Boggle score.');

  return response.json();
}

function updateInitialTiles(input) {
  const initials = input.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  input.value = initials;
  for (let index = 0; index < 3; index += 1) {
    const tile = document.getElementById(`boggle-initial-${index + 1}`);
    if (!tile) continue;
    tile.textContent = initials[index] || '';
    tile.classList.toggle('empty', !initials[index]);
    tile.classList.toggle('active', index === initials.length);
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
  el.summary.hidden = false;
  el.summary.classList.toggle('is-celebration', isTopScore);
  el.summary.replaceChildren();

  const title = document.createElement('h2');
  title.textContent = isTopScore ? 'NEW DAILY HIGH SCORE!' : 'BIG BOGGLE HIGH SCORES';
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
    await loadLeaderboard();
  } catch (error) {
    scores.textContent = 'Unable to load scores.';
  }
}

function openScoreEntry(score) {
  el.summary.hidden = false;
  el.summary.classList.remove('is-celebration');
  el.summary.innerHTML = `
    <h2>GAME OVER</h2>
    <p>${state.roundScores.map((roundScore, index) => `Round ${index + 1}: ${roundScore}`).join(' | ')}</p>
    <p>Final Score: <strong>${score}</strong></p>
    <div class="initials-wrapper">
      <input id="boggle-initials-input" class="hidden-initials-input" type="text" maxlength="3" autocomplete="off" aria-label="Enter your initials">
      <div class="initial-tile empty active" id="boggle-initial-1"></div>
      <div class="initial-tile empty" id="boggle-initial-2"></div>
      <div class="initial-tile empty" id="boggle-initial-3"></div>
    </div>
    <button id="boggle-save-score" class="arcade-btn" type="button">SAVE SCORE</button>
  `;

  const input = document.getElementById('boggle-initials-input');
  const wrapper = el.summary.querySelector('.initials-wrapper');
  const saveButton = document.getElementById('boggle-save-score');
  if (!input || !wrapper || !saveButton) return;

  const focusInput = () => input.focus();
  input.addEventListener('input', () => updateInitialTiles(input));
  input.addEventListener('focus', () => wrapper.classList.add('focused'));
  input.addEventListener('blur', () => wrapper.classList.remove('focused'));
  wrapper.addEventListener('click', focusInput);
  wrapper.addEventListener('touchstart', focusInput);
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
  input.focus();
}

function finishRound() {
  if (state.locked) return;

  state.locked = true;
  clearInterval(state.timer);
  state.path = [];
  state.roundScores.push(roundScore());
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
  el.summary.classList.remove('is-celebration');
  const nextRound = state.round + 1;
  el.summary.innerHTML = `<h2>ROUND ${state.round} COMPLETE</h2><p>Round ${state.round} score: ${current}</p><p><strong>Cumulative score: ${totalScore}</strong></p><button class="arcade-btn" type="button">START ROUND ${nextRound}</button>`;
  el.summary.querySelector('button').addEventListener('click', () => startRound(nextRound));
}

function startRound(round) {
  clearInterval(state.timer);
  state.round = round;
  state.seconds = BOGGLE_SECONDS;
  state.tiles = Array.from({ length: BOGGLE_SIZE * BOGGLE_SIZE }, () => BOGGLE_BAG[Math.floor(Math.random() * BOGGLE_BAG.length)]);
  state.path = [];
  state.words = new Map();
  state.locked = false;
  state.selectionComplete = false;
  el.summary.hidden = true;
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
  startRound(1);
}

async function loadDictionary() {
  try {
    const response = await fetch('data/boggle-uk-scowl-60.txt', { cache: 'force-cache' });
    if (!response.ok) throw new Error('Dictionary unavailable');
    const text = await response.text();
    text.trim().split(/\r?\n/).forEach(entry => state.dictionary.add(entry));
    if (state.dictionary.size === 0) throw new Error('Dictionary empty');
    startMatch();
  } catch (error) {
    message('Dictionary failed to load. Refresh or contact the site owner.', true);
  }
}

el.backspace.addEventListener('click', () => {
  state.desktopPathDrawing = false;
  state.selectionComplete = false;
  state.path.pop();
  message('Last tile removed.');
  render();
});
el.clear.addEventListener('click', () => {
  state.desktopPathDrawing = false;
  state.selectionComplete = false;
  state.path = [];
  message('Word cleared.');
  render();
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
loadLeaderboard();
loadDictionary();
