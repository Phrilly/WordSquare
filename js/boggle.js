const BOGGLE_SIZE = 5;
const BOGGLE_SECONDS = 180;
const BOGGLE_BAG = 'AAAAAAAAAAAAAAEEEEEEEEEEEEEEEEEEEEIIIIIIIIIIIIOOOOOOOOOOUUUUUUUUUSSSSSSSSSSTTTTTTTTTTNNNNNNNNRRRRRRRRHHHHHHDDDDDDLLLLLLCCCCCCMMMMMMPPPPFFGGGGYYWWVVBBKKXJQZ';
const state = { tiles: [], path: [], words: new Map(), round: 1, roundScores: [], seconds: BOGGLE_SECONDS, dictionary: new Set(), locked: true, timer: null };
const el = {
  grid: document.getElementById('boggle-grid'), preview: document.getElementById('boggle-preview-tiles'),
  status: document.getElementById('boggle-status'), score: document.getElementById('boggle-score'),
  round: document.getElementById('boggle-round'), timer: document.getElementById('boggle-timer'),
  backspace: document.getElementById('boggle-backspace'), clear: document.getElementById('boggle-clear'),
  enter: document.getElementById('boggle-enter'), found: document.getElementById('boggle-found-list'),
  summary: document.getElementById('boggle-summary'), leaderboard: document.getElementById('boggle-leaderboard-list')
};
function tileText(index) { return state.tiles[index] === 'Q' ? 'QU' : state.tiles[index]; }
function word() { return state.path.map(tileText).join(''); }
function points(length) { return length === 4 ? 1 : length === 5 ? 2 : length === 6 ? 3 : length === 7 ? 5 : length >= 8 ? 11 : 0; }
function adjacent(a, b) { const ar = Math.floor(a / 5), ac = a % 5, br = Math.floor(b / 5), bc = b % 5; return Math.abs(ar-br) <= 1 && Math.abs(ac-bc) <= 1 && a !== b; }
function total() { return state.roundScores.reduce((sum, value) => sum + value, 0) + (state.locked ? 0 : roundScore()); }
function roundScore() { return [...state.words.values()].reduce((sum, value) => sum + value, 0); }
function message(text, invalid = false) { el.status.textContent = text; el.status.style.color = invalid ? '#fecaca' : '#ffffff'; }
function render() {
  const tileButtons = state.tiles.map((letter, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'grid-cell boggle-tile';
    button.textContent = letter === 'Q' ? 'Qu' : letter; button.setAttribute('aria-label', letter === 'Q' ? 'Qu' : letter);
    button.classList.toggle('is-selected', state.path.includes(index)); button.disabled = state.locked;
    button.addEventListener('click', () => select(index)); return button;
  });
  el.grid.replaceChildren(...tileButtons, el.summary);
  el.preview.replaceChildren(...state.path.map(index => { const tile = document.createElement('span'); tile.className = 'boggle-preview-tile'; tile.textContent = tileText(index); return tile; }));
  el.backspace.disabled = state.locked || state.path.length === 0; el.clear.disabled = state.locked || state.path.length === 0; el.enter.disabled = state.locked || state.path.length === 0;
  el.score.textContent = String(total()); el.round.textContent = `ROUND ${state.round} OF 2`; el.timer.textContent = `${Math.floor(state.seconds / 60)}:${String(state.seconds % 60).padStart(2, '0')}`;
}
function select(index) {
  if (state.locked) return;
  const last = state.path.at(-1);
  if (state.path.includes(index)) return message('A tile can only be used once.', true);
  if (last !== undefined && !adjacent(last, index)) return message('Next tile must touch the previous tile.', true);
  state.path.push(index); message('Select more tiles or enter the word.'); render();
}
function submit() {
  const candidate = word();
  if (candidate.length < 4) return message('Words need at least 4 letters.', true);
  if (state.words.has(candidate)) return message('Already found this round.', true);
  if (!state.dictionary.has(candidate)) return message('Not in the British English dictionary. Use Backspace to correct it.', true);
  const earned = points(candidate.length); state.words.set(candidate, earned); state.path = [];
  message(`+${earned} ${earned === 1 ? 'point' : 'points'}: ${candidate}`); renderWords(); render();
}
function renderWords() { el.found.replaceChildren(...[...state.words].sort(([a],[b]) => a.localeCompare(b)).map(([candidate, earned]) => { const item = document.createElement('li'); item.textContent = candidate; const score = document.createElement('strong'); score.textContent = `+${earned}`; item.append(score); return item; })); }
function renderLeaderboard(scores) {
  el.leaderboard.replaceChildren(...scores.map((entry, index) => {
    const item = document.createElement('li');
    if (index === 0) item.classList.add('is-top-score');
    const initials = String(entry.initials || '---').padEnd(3, '-').slice(0, 3);
    item.innerHTML = `<div class="lb-row-container"><div class="lb-rank">${index + 1}.</div><div class="lb-initials-group"><div class="lb-initial-tile">${initials[0]}</div><div class="lb-initial-tile">${initials[1]}</div><div class="lb-initial-tile">${initials[2]}</div></div><div class="lb-score-tile">${entry.score}</div></div>`;
    return item;
  }));
  if (scores.length === 0) el.leaderboard.innerHTML = '<li>No scores today.</li>';
}
async function loadLeaderboard() {
  try {
    const response = await fetch('validate.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_boggle_highscores' }) });
    const data = await response.json();
    renderLeaderboard(Array.isArray(data.highscores) ? data.highscores : []);
  } catch (error) { el.leaderboard.innerHTML = '<li>Unable to load scores.</li>'; }
}
async function saveLeaderboardScore(score) {
  const initials = (window.prompt('Enter three initials for the Big Boggle leaderboard:', '') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  if (!initials) return loadLeaderboard();
  try {
    const response = await fetch('validate.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_boggle_highscore', initials, score }) });
    if (!response.ok) throw new Error('Save failed');
    await loadLeaderboard();
  } catch (error) { message('Score could not be saved.', true); }
}
function finishRound() {
  if (state.locked) return; state.locked = true; clearInterval(state.timer); state.path = []; state.roundScores.push(roundScore()); render();
  if (state.round === 2) return showSummary(true);
  showSummary(false);
}
function showSummary(done) {
  const current = state.roundScores.at(-1); const totalScore = state.roundScores.reduce((sum, value) => sum + value, 0);
  el.summary.hidden = false; el.summary.innerHTML = done
    ? `<h2>MATCH COMPLETE</h2><p>Round 1: ${state.roundScores[0]} | Round 2: ${state.roundScores[1]}</p><p><strong>Cumulative total: ${totalScore}</strong></p><button class="arcade-btn" type="button">SAVE SCORE</button><button class="arcade-btn" type="button">PLAY AGAIN</button>`
    : `<h2>ROUND 1 COMPLETE</h2><p>Round 1 score: ${current}</p><p><strong>Cumulative score: ${totalScore}</strong></p><button class="arcade-btn" type="button">START ROUND 2</button>`;
  const buttons = el.summary.querySelectorAll('button');
  if (done) {
    buttons[0].addEventListener('click', () => saveLeaderboardScore(totalScore));
    buttons[1].addEventListener('click', startMatch);
  } else buttons[0].addEventListener('click', () => startRound(2));
}
function startRound(round) {
  clearInterval(state.timer); state.round = round; state.seconds = BOGGLE_SECONDS; state.tiles = Array.from({length:25}, () => BOGGLE_BAG[Math.floor(Math.random() * BOGGLE_BAG.length)]);
  state.path = []; state.words = new Map(); state.locked = false; el.summary.hidden = true; el.summary.replaceChildren(); renderWords(); message(`Round ${round} has started.`); render();
  state.timer = setInterval(() => { if (--state.seconds <= 0) { state.seconds = 0; finishRound(); } else render(); }, 1000);
}
function startMatch() { state.roundScores = []; startRound(1); }
async function loadDictionary() {
  try { const response = await fetch('data/boggle-uk-scowl-60.txt', { cache: 'force-cache' }); if (!response.ok) throw new Error('Dictionary unavailable'); const text = await response.text(); text.trim().split(/\r?\n/).forEach(entry => state.dictionary.add(entry)); if (state.dictionary.size === 0) throw new Error('Dictionary empty'); startMatch(); }
  catch (error) { message('Dictionary failed to load. Refresh or contact the site owner.', true); }
}
el.backspace.addEventListener('click', () => { state.path.pop(); message('Last tile removed.'); render(); });
el.clear.addEventListener('click', () => { state.path = []; message('Word cleared.'); render(); });
el.enter.addEventListener('click', submit);
loadLeaderboard();
loadDictionary();
