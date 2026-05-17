const gridSize = 5;
let cells = Array(gridSize * gridSize).fill('');
let wildcardState = Array(gridSize * gridSize).fill(false);

let placedCount = 0;
let pendingCellIndex = null;
let explodedWords = new Set();
let currentScore = 0;
let isCurrentGameDaily = true;

let usedWildcards = new Set();
let gameDictionary = new Set();
let gameDeck = [];
let bestDailyData = null;

let aiBestScore = 0;
let aiBestGrid = [];

const gridEl = document.getElementById('grid');
const headerLabelEl = document.getElementById('header-label');
const nextLetterEl = document.getElementById('next-letter');
const scoreEl = document.getElementById('score');
const alphabetModal = document.getElementById('alphabet-modal');
const leftHeaderEl = document.getElementById('left-header');

const highscoreEntryModal = document.getElementById('highscore-entry-modal');
const leaderboardModal = document.getElementById('leaderboard-modal');
const initialsInput = document.getElementById('hidden-initials');
const topBarEl = document.querySelector('.top-bar');

initialsInput.addEventListener('input', (e) => {
  const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
  e.target.value = val;
  document.getElementById('init-tile-1').innerText = val[0] || '';
  document.getElementById('init-tile-2').innerText = val[1] || '';
  document.getElementById('init-tile-3').innerText = val[2] || '';
});

let dailyOffset = parseInt(localStorage.getItem('ws_daily_offset')) || 0;

function getDailySeed() {
  const today = new Date();
  const dateStr = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
  let s = 0;
  for (let i = 0; i < dateStr.length; i++) s += dateStr.charCodeAt(i) * (i + 1);
  return (s + dailyOffset) * 12345;
}

function cycleDailyBoard() {
  dailyOffset++;
  localStorage.setItem('ws_daily_offset', dailyOffset);
  initGame();
}

function resetDailyOffset() {
  dailyOffset = 0;
  localStorage.removeItem('ws_daily_offset');
  initGame();
}

let dailySeed = 0;
function getSeededRandom() {
  let t = dailySeed += 0x6D2B79F5;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

function generateBagSequence() {
  const rng = isCurrentGameDaily ? getSeededRandom : Math.random;

  const isNewLogicActive = true;

  if (!isNewLogicActive) {
    const bagString = "EEEEEEEEEEEAAAAAAAAIIIIIIIOOOOOOOUUUSSSSSRRRRRTTTTTNNNNNLLLLDDDDGGCCMMBBPP HHFFWWYYVKXJQZ????????????";
    const initialBag = bagString.replace(/ /g, '').split('');
    let sequence = [];
    for (let i = 0; i < 25; i++) {
      const index = Math.floor(rng() * initialBag.length);
      sequence.push(initialBag.splice(index, 1)[0]);
    }
    return sequence;
  }

  const masterBagString = "AAAAAAAEEEEEEEEEEIIIIIOOOOOUUUSSSSRRRRRRRRTTTTTTTTNNNNNNNLLLLLLDDDDDBBCCCCFFGGGHHHJKMMMMPPPQVVWWXYYZ";
  const initialBag = masterBagString.split('');
  const vowels = ['A', 'E', 'I', 'O', 'U'];
  let sequence = [];
  let isValid = false;

  while (!isValid) {
    sequence = [];
    let tempBag = [...initialBag];
    let vowelCount = 0;
    let sCount = 0;

    for (let i = 0; i < 25; i++) {
      const index = Math.floor(rng() * tempBag.length);
      const selected = tempBag.splice(index, 1)[0];
      sequence.push(selected);

      if (vowels.includes(selected)) vowelCount++;
      if (selected === 'S') sCount++;
    }

    if (vowelCount >= 6 && vowelCount <= 9 && sCount <= 2) {
      isValid = true;
    }
  }

  const wcRoll = rng() * 100;
  let wcCount = 0;

  if (wcRoll < 5) wcCount = 0;
  else if (wcRoll < 30) wcCount = 1;
  else if (wcRoll < 70) wcCount = 2;
  else if (wcRoll < 95) wcCount = 3;
  else wcCount = 4;

  let safeIndices = [];
  for (let i = 0; i < 25; i++) {
    if (sequence[i] !== 'S' && sequence[i] !== 'Q') {
      safeIndices.push(i);
    }
  }

  for (let i = 0; i < wcCount && safeIndices.length > 0; i++) {
    const randSafeIdx = Math.floor(rng() * safeIndices.length);
    const replaceIdx = safeIndices.splice(randSafeIdx, 1)[0];
    sequence[replaceIdx] = '?';
  }

  return sequence;
}

async function checkYesterdaysWinner() {
  try {
    const res = await fetch('validate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_yesterdays_winner' })
    });
    const data = await res.json();

    if (data.winner_initials) {
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.backgroundColor = 'rgba(15, 35, 60, 0.9)';
      overlay.style.zIndex = '9998';
      overlay.style.display = 'flex';
      overlay.style.flexDirection = 'column';
      overlay.style.justifyContent = 'center';
      overlay.style.alignItems = 'center';

      const title = document.createElement('h1');
      title.innerText = "YESTERDAY'S CHAMPION";
      title.style.color = 'var(--highlight)';
      title.style.marginBottom = '20px';

      const initialsBox = document.createElement('div');
      initialsBox.innerText = data.winner_initials;
      initialsBox.style.fontSize = '80px';
      initialsBox.style.fontWeight = 'bold';
      initialsBox.style.color = '#FFD700';
      initialsBox.style.textShadow = '0 0 20px #ffaa00';

      overlay.appendChild(title);
      overlay.appendChild(initialsBox);
      document.body.appendChild(overlay);

      triggerExplosion(true);

      setTimeout(() => {
        overlay.style.transition = 'opacity 1s';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 1000);
      }, 4000);
    }
  } catch (e) {
    console.error("Could not fetch yesterday's winner", e);
  }
}

function setupAlphabetGrid() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
  let html = '';
  letters.forEach(l => html += `<div class="alpha-cell" onclick="selectWildcard('${l}')">${l}</div>`);
  html += `<div class="alpha-cell empty-alpha"></div><div class="alpha-cell empty-alpha"></div>`;
  html += `<div class="alpha-cell alpha-cancel" onclick="selectWildcard('Cancel')">Cancel</div>`;
  alphabetModal.innerHTML = html;
}

function updateWildcardModal() {
  const alphaCells = document.querySelectorAll('.alpha-cell:not(.empty-alpha):not(.alpha-cancel)');
  alphaCells.forEach(cell => {
    if (usedWildcards.has(cell.innerText)) {
      cell.classList.add('used');
    } else {
      cell.classList.remove('used');
    }
  });
}

window.onload = async function bootstrapGame() {
  setupAlphabetGrid();
  try {
    const res = await fetch('validate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_dict' })
    });
    const data = await res.json();
    if (data.words) gameDictionary = new Set(data.words);
  } catch (e) {
    console.error("Failed to load dictionary", e);
  }

  document.getElementById('loading-screen').style.display = 'none';
  checkYesterdaysWinner();
  initGame();
};

nextLetterEl.addEventListener('click', () => {
  if (nextLetterEl.innerText === '?') {
    pendingCellIndex = -1;
    updateWildcardModal();
    alphabetModal.classList.add('active');
  } else {
    const forcedLetter = prompt("Developer Cheat Mode: Enter a specific letter (A-Z)");
    if (forcedLetter && /^[a-zA-Z]$/.test(forcedLetter)) {
      nextLetterEl.innerText = forcedLetter.toUpperCase();
    }
  }
});

function hideModalsForBoardView() {
  leaderboardModal.classList.remove('active');
  document.getElementById('return-to-menu-btn').style.display = 'block';
  topBarEl.style.opacity = '1';
}

function showLeaderboard() {
  document.getElementById('return-to-menu-btn').style.display = 'none';
  leaderboardModal.classList.add('active');
  topBarEl.style.opacity = '0';
}

function showLeaderboardFromBest() {
  document.getElementById('best-board-modal').classList.remove('active');
  document.getElementById('leaderboard-modal').classList.add('active');
  topBarEl.style.opacity = '0';
}

function showBestBoard() {
  if (!bestDailyData || !bestDailyData.grid || bestDailyData.grid.length !== 25) return;

  document.getElementById('leaderboard-modal').classList.remove('active');
  document.getElementById('return-to-menu-btn').style.display = 'none';
  topBarEl.style.opacity = '0';

  document.getElementById('board-viewer-title').innerText = "🏆 #1 BOARD 🏆";
  document.getElementById('board-viewer-title').style.color = "#FFD700";

  document.getElementById('best-board-score').innerText = bestDailyData.score;
  document.getElementById('best-board-initials').innerText = bestDailyData.initials;

  const bg = document.getElementById('best-grid');
  bg.innerHTML = '';

  let chars = bestDailyData.grid.split('');
  let normalizedChars = chars.map(c => c.toUpperCase());

  for (let i = 0; i < 25; i++) {
    let c = document.createElement('div');
    c.className = 'grid-cell';
    if (chars[i] && chars[i] !== chars[i].toUpperCase()) {
      c.classList.add('is-wildcard');
    }
    c.innerText = normalizedChars[i];
    bg.appendChild(c);
  }

  const bValid = findValidWordsLocalArray(normalizedChars);
  let rawScoringWords = [];
  let grouped = {};
  bValid.forEach(w => {
    let rev = w.split('').reverse().join('');
    let key = w < rev ? w : rev;
    if (!grouped[key]) grouped[key] = new Set();
    grouped[key].add(w);
  });
  Object.keys(grouped).forEach(key => {
    rawScoringWords.push(...[...grouped[key]]);
  });

  applyColorsToSpecificGrid(rawScoringWords, normalizedChars, bg);
  document.getElementById('best-board-modal').classList.add('active');
}

function showAIBoard() {
  if (!aiBestGrid || aiBestGrid.length !== 25) return;

  document.getElementById('leaderboard-modal').classList.remove('active');
  document.getElementById('return-to-menu-btn').style.display = 'none';
  topBarEl.style.opacity = '0';

  document.getElementById('board-viewer-title').innerText = "🤖 AI OPTIMAL 🤖";
  document.getElementById('board-viewer-title').style.color = "var(--highlight)";

  document.getElementById('best-board-score').innerText = aiBestScore;
  document.getElementById('best-board-initials').innerText = "THE AI";

  const bg = document.getElementById('best-grid');
  bg.innerHTML = '';

  let chars = aiBestGrid.map(t => t.char);

  for (let i = 0; i < 25; i++) {
    let c = document.createElement('div');
    c.className = 'grid-cell';
    if (aiBestGrid[i].isWild) c.classList.add('is-wildcard');
    c.innerText = chars[i];
    bg.appendChild(c);
  }

  const bValid = findValidWordsLocalArray(chars);
  let rawScoringWords = [];
  let grouped = {};
  bValid.forEach(w => {
    let rev = w.split('').reverse().join('');
    let key = w < rev ? w : rev;
    if (!grouped[key]) grouped[key] = new Set();
    grouped[key].add(w);
  });
  Object.keys(grouped).forEach(key => {
    rawScoringWords.push(...[...grouped[key]]);
  });

  applyColorsToSpecificGrid(rawScoringWords, chars, bg);
  document.getElementById('best-board-modal').classList.add('active');
}

function initGame() {
  const existingCells = document.querySelectorAll('.grid-cell:not(.alpha-cell)');
  existingCells.forEach(cell => cell.remove());

  cells = Array(gridSize * gridSize).fill('');
  wildcardState = Array(gridSize * gridSize).fill(false);

  placedCount = 0;
  pendingCellIndex = null;
  explodedWords.clear();
  currentScore = 0;
  usedWildcards.clear();

  isCurrentGameDaily = document.getElementById('daily-toggle').checked;
  if (isCurrentGameDaily) dailySeed = getDailySeed();

  gameDeck = generateBagSequence();

  scoreEl.innerText = '0';
  headerLabelEl.innerText = 'Next:';

  alphabetModal.classList.remove('active');
  highscoreEntryModal.classList.remove('active');
  leaderboardModal.classList.remove('active');
  document.getElementById('best-board-modal').classList.remove('active');
  document.getElementById('return-to-menu-btn').style.display = 'none';

  topBarEl.style.opacity = '1';

  document.getElementById('list-5').innerHTML = '';
  document.getElementById('list-4').innerHTML = '';
  document.getElementById('list-3').innerHTML = '';

  for (let i = 0; i < 25; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.dataset.index = i;
    cell.addEventListener('click', () => handleCellClick(i, cell));
    cell.addEventListener('mouseenter', () => handleHoverEnter(i, cell));
    cell.addEventListener('mouseleave', () => handleHoverLeave(cell));
    gridEl.appendChild(cell);
  }

  nextLetterEl.style.display = 'inline-flex';
  leftHeaderEl.title = 'Click to open wildcard picker';
  setNextLetter();
}

function setNextLetter() {
  if (placedCount >= 25) return;
  nextLetterEl.innerText = gameDeck[placedCount];
}

function handleHoverEnter(index, cellEl) {
  if (!document.getElementById('hover-toggle').checked) return;
  if (cells[index] !== '' || placedCount >= 25) return;
  const letter = nextLetterEl.innerText;
  if (letter === '?' || letter === '-') return;

  const currentWords = findValidWordsLocalArray(cells);
  const tempCells = [...cells];
  tempCells[index] = letter;
  const newWords = findValidWordsLocalArray(tempCells).filter(w => !currentWords.includes(w));

  let maxLen = 0;
  newWords.forEach(w => { if (w.length > maxLen) maxLen = w.length; });

  if (maxLen === 3) cellEl.classList.add('hover-3');
  else if (maxLen === 4) cellEl.classList.add('hover-4');
  else if (maxLen === 5) cellEl.classList.add('hover-5');
}

function handleHoverLeave(cellEl) {
  cellEl.classList.remove('hover-3', 'hover-4', 'hover-5');
}

function handleCellClick(index, cellEl) {
  if (cells[index] !== '' || placedCount >= 25) return;
  const letter = nextLetterEl.innerText;
  if (letter === '?') {
    pendingCellIndex = index;
    updateWildcardModal();
    alphabetModal.classList.add('active');
    return;
  }
  placeLetter(index, letter, cellEl, false);
}

function placeLetter(index, letter, cellEl, isWildcard) {
  cellEl.classList.remove('hover-3', 'hover-4', 'hover-5');
  cells[index] = letter;
  wildcardState[index] = isWildcard;

  cellEl.innerText = letter;
  placedCount++;

  if (isWildcard) {
    cellEl.classList.add('is-wildcard');
  }

  cellEl.classList.add('tile-pop');
  setTimeout(() => { cellEl.classList.remove('tile-pop'); }, 300);

  calculateRealTimeScoreLocal();

  if (placedCount === 25) {
    headerLabelEl.innerText = 'Score:';
    nextLetterEl.style.display = 'none';
    leftHeaderEl.title = '';

    topBarEl.style.opacity = '0';
    document.getElementById('final-score-display').innerText = currentScore;

    if (isCurrentGameDaily) {
      document.getElementById('daily-save-section').style.display = 'block';
      document.getElementById('non-daily-section').style.display = 'none';

      initialsInput.value = '';
      document.getElementById('init-tile-1').innerText = '';
      document.getElementById('init-tile-2').innerText = '';
      document.getElementById('init-tile-3').innerText = '';

      highscoreEntryModal.classList.add('active');
      initialsInput.focus();
    } else {
      document.getElementById('daily-save-section').style.display = 'none';
      document.getElementById('non-daily-section').style.display = 'block';
      highscoreEntryModal.classList.add('active');
    }
  } else {
    setNextLetter();
  }
}

function selectWildcard(letter) {
  if (usedWildcards.has(letter) && letter !== 'Cancel') return;
  alphabetModal.classList.remove('active');
  if (letter === 'Cancel') {
    pendingCellIndex = null;
    return;
  }

  usedWildcards.add(letter);

  if (pendingCellIndex === -1) {
    nextLetterEl.innerText = letter;
  } else {
    const cellEl = document.querySelector(`.grid-cell[data-index='${pendingCellIndex}']`);
    placeLetter(pendingCellIndex, letter, cellEl, true);
  }
  pendingCellIndex = null;
}

function triggerExplosion(isMega = false) {
  const gridRect = gridEl.getBoundingClientRect();
  const centerX = gridRect.left + (gridRect.width / 2);
  const centerY = gridRect.top + (gridRect.height / 2);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const particleCount = isMega ? 150 : 40;
  const durationMs = isMega ? 6000 : 2800;

  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    if (isMega) p.classList.add('mega-burst');
    if (Math.random() > 0.5) p.classList.add('alt');

    p.innerText = alphabet[Math.floor(Math.random() * alphabet.length)];
    p.style.left = centerX + 'px';
    p.style.top = centerY + 'px';

    const angle = Math.random() * Math.PI * 2;
    const baseDist = isMega ? 250 : 120;
    const distMod = isMega ? 0.8 : 0.45;
    const distance = baseDist + Math.random() * (window.innerWidth * distMod);

    p.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
    p.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
    p.style.setProperty('--rot', (Math.random() - 0.5) * 720 + 'deg');

    document.body.appendChild(p);
    setTimeout(() => p.remove(), durationMs);
  }
}

function findValidWordsLocalArray(gridArray) {
  let found = [];
  const dirs = [[0,1], [0,-1], [1,0], [-1,0], [1,1], [-1,-1], [-1,1], [1,-1]];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      for (let [dr, dc] of dirs) {
        let currentWord = "";
        for (let step = 0; step < 5; step++) {
          let nr = r + (dr * step);
          let nc = c + (dc * step);
          if (nr < 0 || nr >= 5 || nc < 0 || nc >= 5) break;
          let letter = gridArray[nr * 5 + nc];
          if (!letter) break;
          currentWord += letter;
          if (currentWord.length >= 3 && gameDictionary.has(currentWord)) found.push(currentWord);
        }
      }
    }
  }
  return [...new Set(found)];
}

function calculateRealTimeScoreLocal() {
  const validWords = findValidWordsLocalArray(cells);
  currentScore = 0;
  let words3 = [], words4 = [], words5 = [];

  let grouped = {};
  validWords.forEach(w => {
    let rev = w.split('').reverse().join('');
    let key = w < rev ? w : rev;
    if (!grouped[key]) grouped[key] = new Set();
    grouped[key].add(w);
  });

  let rawScoringWords = [];

  Object.keys(grouped).forEach(key => {
    let wArr = [...grouped[key]];
    wArr.sort();
    let displayStr = wArr.join('/');
    let len = key.length;

    rawScoringWords.push(...wArr);

    if (len === 3) {
      currentScore += 1;
      words3.push(displayStr);
    } else if (len === 4) {
      currentScore += 5;
      words4.push(displayStr);
    } else if (len === 5) {
      currentScore += 20;
      words5.push(displayStr);
      if (!explodedWords.has(key)) {
        triggerExplosion(false);
        explodedWords.add(key);
      }
    }
  });

  words3.sort();
  words4.sort();
  words5.sort();

  scoreEl.innerText = currentScore;

  document.getElementById('list-5').innerHTML = words5.map(w => `<span class="word-badge word-5">${w}</span>`).join('');
  document.getElementById('list-4').innerHTML = words4.map(w => `<span class="word-badge word-4">${w}</span>`).join('');
  document.getElementById('list-3').innerHTML = words3.map(w => `<span class="word-badge word-3">${w}</span>`).join('');

  applyColorsToSpecificGrid(rawScoringWords, cells, gridEl);
}

function getScoreForPureGrid(charArray) {
  let found = findValidWordsLocalArray(charArray);
  let score = 0;
  let grouped = {};
  for (let i = 0; i < found.length; i++) {
    let w = found[i];
    let rev = w.split('').reverse().join('');
    let key = w < rev ? w : rev;
    if (!grouped[key]) {
      grouped[key] = true;
      let len = key.length;
      if (len === 3) score += 1;
      else if (len === 4) score += 5;
      else if (len === 5) score += 20;
    }
  }
  return score;
}

function runAIOptimizerOnBestGrid(bestGridString) {
  let rawChars = bestGridString.split('');
  let upperChars = rawChars.map(c => c.toUpperCase());

  let bestIndices = Array.from({ length: 25 }, (_, i) => i);
  let bestScore = getScoreForPureGrid(upperChars);
  let currentTestIndices = [...bestIndices];
  let currentTestScore = bestScore;

  const endTime = performance.now() + 1500;

  function computeChunk() {
    const chunkEnd = performance.now() + 12;
    while (performance.now() < chunkEnd) {
      let candidateIndices = [...currentTestIndices];
      let swaps = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < swaps; i++) {
        let a = Math.floor(Math.random() * 25);
        let b = Math.floor(Math.random() * 25);
        let temp = candidateIndices[a];
        candidateIndices[a] = candidateIndices[b];
        candidateIndices[b] = temp;
      }

      let mappedChars = candidateIndices.map(idx => upperChars[idx]);
      let score = getScoreForPureGrid(mappedChars);

      if (score >= currentTestScore) {
        currentTestIndices = candidateIndices;
        currentTestScore = score;
        if (score > bestScore) {
          bestScore = score;
          bestIndices = [...candidateIndices];
        }
      } else if (Math.random() < 0.05) {
        currentTestIndices = candidateIndices;
        currentTestScore = score;
      }
    }

    if (performance.now() < endTime) {
      requestAnimationFrame(computeChunk);
    } else {
      aiBestScore = bestScore;
      aiBestGrid = bestIndices.map(idx => {
        let char = rawChars[idx];
        let isWild = char !== char.toUpperCase();
        return { char: char.toUpperCase(), isWild: isWild };
      });

      document.getElementById('view-ai-btn').style.display = 'block';
    }
  }
  requestAnimationFrame(computeChunk);
}

function applyColorsToSpecificGrid(validWords, cellsArray, containerElement) {
  const cellEls = containerElement.querySelectorAll('.grid-cell:not(.alpha-cell)');
  cellEls.forEach(cell => cell.classList.remove('word-3', 'word-4', 'word-5'));
  if (!validWords || validWords.length === 0) return;

  const wordsByLength = { 3: [], 4: [], 5: [] };
  validWords.forEach(w => wordsByLength[w.length].push(w));
  const directions = [[0,1], [0,-1], [1,0], [-1,0], [1,1], [-1,-1], [-1,1], [1,-1]];

  function highlightWord(word, lengthClass) {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        for (let [dr, dc] of directions) {
          let match = true;
          let indices = [];
          for (let i = 0; i < word.length; i++) {
            let nextRow = r + (dr * i);
            let nextCol = c + (dc * i);
            if (nextRow < 0 || nextRow >= gridSize || nextCol < 0 || nextCol >= gridSize) {
              match = false;
              break;
            }
            let idx = nextRow * gridSize + nextCol;
            if (cellsArray[idx] !== word[i]) {
              match = false;
              break;
            }
            indices.push(idx);
          }
          if (match) {
            indices.forEach(idx => {
              cellEls[idx].classList.remove('word-3', 'word-4', 'word-5');
              cellEls[idx].classList.add(lengthClass);
            });
          }
        }
      }
    }
  }

  wordsByLength[3].forEach(w => highlightWord(w, 'word-3'));
  wordsByLength[4].forEach(w => highlightWord(w, 'word-4'));
  wordsByLength[5].forEach(w => highlightWord(w, 'word-5'));
}

async function submitHighscore() {
  let initials = initialsInput.value.trim().toUpperCase();
  if (initials.length === 0) initials = "---";

  let isNewTopScore = false;
  let gridString = "";
  for (let i = 0; i < 25; i++) {
    let char = cells[i];
    if (wildcardState[i]) gridString += char.toLowerCase();
    else gridString += char;
  }

  try {
    const res = await fetch('validate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_score', initials: initials, score: currentScore, grid: gridString })
    });
    const data = await res.json();
    isNewTopScore = data.is_top_score;
  } catch (e) {
    console.error("Error saving score", e);
  }

  highscoreEntryModal.classList.remove('active');

  const lbTitle = document.getElementById('leaderboard-title');
  if (isNewTopScore) {
    lbTitle.innerText = "🏆 NEW DAILY HIGH SCORE! 🏆";
    lbTitle.style.color = "#FFD700";
    triggerExplosion(true);
  } else {
    lbTitle.innerText = "TODAY'S HIGH SCORES";
    lbTitle.style.color = "var(--highlight)";
  }

  loadLeaderboard();
}

function skipToLeaderboard() {
  highscoreEntryModal.classList.remove('active');
  const lbTitle = document.getElementById('leaderboard-title');
  lbTitle.innerText = "TODAY'S HIGH SCORES";
  lbTitle.style.color = "var(--highlight)";
  loadLeaderboard();
}

async function loadLeaderboard() {
  const listEl = document.getElementById('leaderboard-list');
  listEl.innerHTML = '<li style="border:none; justify-content:center;">Loading...</li>';
  leaderboardModal.classList.add('active');
  topBarEl.style.opacity = '0';

  try {
    const res = await fetch('validate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_highscores' })
    });
    const data = await res.json();

    listEl.innerHTML = '';
    document.getElementById('view-ai-btn').style.display = 'none';

    if (data.highscores && data.highscores.length > 0) {
      bestDailyData = data.highscores[0];

      const viewWinningBtn = document.getElementById('view-winning-btn');
      if (bestDailyData && bestDailyData.grid && bestDailyData.grid.length === 25) {
        viewWinningBtn.style.display = 'block';
        runAIOptimizerOnBestGrid(bestDailyData.grid);
      } else {
        viewWinningBtn.style.display = 'none';
      }

      data.highscores.forEach((entry, index) => {
        let initials = (entry.initials || '---').padEnd(3, '-').substring(0, 3);
        let initialsHtml = '';
        for (let i = 0; i < 3; i++) {
          initialsHtml += `<div class="lb-initial-tile">${initials[i]}</div>`;
        }

        listEl.innerHTML += `
          <li style="border-bottom:none; padding:0;">
            <div class="lb-row-container">
              <div style="display:flex; align-items:center;">
                <div class="lb-rank">${index + 1}.</div>
                <div class="lb-initials-group">${initialsHtml}</div>
              </div>
              <div class="lb-score-tile">${entry.score}</div>
            </div>
          </li>
        `;
      });
    } else {
      document.getElementById('view-winning-btn').style.display = 'none';
      listEl.innerHTML = '<li style="border:none; justify-content:center;">No scores today!</li>';
    }
  } catch (e) {
    console.error("Error loading scores", e);
    listEl.innerHTML = '<li style="border:none; justify-content:center;">Error loading leaderboard.</li>';
  }
}
