'use strict';

const MAX_RNG_ITERATIONS = 10000;

function getDailySeed() {
  try {
    const today = new Date();
    const dateStr = `${today.getUTCFullYear()}-${today.getUTCMonth() + 1}-${today.getUTCDate()}`;
    let s = 0;
    for (let i = 0; i < dateStr.length; i++) {
      s += dateStr.charCodeAt(i) * (i + 1);
    }
    const offset = GameState.getDailyOffset();
    const seed = (s + offset) * 12345;
    if (!Number.isFinite(seed)) {
      throw new RangeError('Computed daily seed is not finite.');
    }
    return seed;
  } catch (err) {
    console.error('getDailySeed failed, falling back to Date.now() seed.', err);
    return Date.now();
  }
}

function getSeededRandom() {
  let t = GameState.mutateDailySeed(0x6D2B79F5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function generateBagSequence() {
  const rng = GameState.isDaily() ? getSeededRandom : Math.random;
  const masterBagString = "AAAAAAAEEEEEEEEEEIIIIIOOOOOUUUSSSSRRRRRRRRTTTTTTTTNNNNNNNLLLLLLDDDDDBBCCCCFFGGGHHHJKMMMMPPPQVVWWXYYZ";
  const initialBag = masterBagString.split('');
  const vowels = ['A', 'E', 'I', 'O', 'U'];

  let sequence = [];
  let isValid = false;
  let vowelCount = 0;
  let sCount = 0;
  let iterations = 0;

  while (!isValid) {
    iterations++;
    if (iterations > MAX_RNG_ITERATIONS) {
      console.error('generateBagSequence: exceeded max iterations, using best-effort sequence.');
      break;
    }

    sequence = [];
    let tempBag = [...initialBag];
    vowelCount = 0;
    sCount = 0;

    for (let i = 0; i < GameState.CELL_COUNT; i++) {
      if (tempBag.length === 0) {
        throw new Error('generateBagSequence: letter bag exhausted before filling grid.');
      }
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
  for (let i = 0; i < GameState.CELL_COUNT; i++) {
    if (sequence[i] !== 'S' && sequence[i] !== 'Q') {
      safeIndices.push(i);
    }
  }

  const activeRules = {
    enforceWildcardLimits: Date.now() >= Date.UTC(2026, 4, 22),
    minVowels: 6
  };

  let wcSafetyCounter = 0;
  for (let i = 0; i < wcCount && safeIndices.length > 0; i++) {
    wcSafetyCounter++;
    if (wcSafetyCounter > MAX_RNG_ITERATIONS) {
      console.warn('generateBagSequence: wildcard placement loop exceeded max iterations.');
      break;
    }

    const randSafeIdx = Math.floor(rng() * safeIndices.length);
    const replaceIdx = safeIndices.splice(randSafeIdx, 1)[0];
    const charToReplace = sequence[replaceIdx];

    if (activeRules.enforceWildcardLimits) {
      const isEssential = vowels.includes(charToReplace) && vowelCount <= activeRules.minVowels;
      if (isEssential) {
        i--;
        continue;
      }
      if (vowels.includes(charToReplace)) vowelCount--;
      if (charToReplace === 'S') sCount--;
    }

    sequence[replaceIdx] = '?';
  }

  return sequence;
}

function buildGroupedWordData(validWords) {
  if (!Array.isArray(validWords)) {
    throw new TypeError('buildGroupedWordData: validWords must be an array.');
  }

  const grouped = {};
  const result = {
    rawScoringWords: [],
    display: { 3: [], 4: [], 5: [] }
  };

  validWords.forEach(w => {
    if (typeof w !== 'string' || w.length < 3) return;
    const rev = w.split('').reverse().join('');
    const key = w < rev ? w : rev;
    if (!grouped[key]) grouped[key] = new Set();
    grouped[key].add(w);
  });

  Object.keys(grouped).forEach(key => {
    const wArr = [...grouped[key]].sort();
    result.rawScoringWords.push(...wArr);
    const len = key.length;
    if (result.display[len]) {
      result.display[len].push(wArr.join('/'));
    }
  });

  result.display[3].sort();
  result.display[4].sort();
  result.display[5].sort();

  return result;
}

function findValidWordsLocalArray(gridArray) {
  if (!Array.isArray(gridArray) || gridArray.length !== GameState.CELL_COUNT) {
    console.error('findValidWordsLocalArray: invalid gridArray, returning empty result.');
    return [];
  }

  const dictionary = GameState.getDictionary();
  if (!(dictionary instanceof Set) || dictionary.size === 0) {
    console.warn('findValidWordsLocalArray: dictionary is empty; no words can be found.');
    return [];
  }

  const found = [];
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [-1, 1], [1, -1]];
  const size = GameState.GRID_SIZE;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      for (const [dr, dc] of dirs) {
        let currentWord = "";
        for (let step = 0; step < size; step++) {
          const nr = r + (dr * step);
          const nc = c + (dc * step);
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;

          const letter = gridArray[nr * size + nc];
          if (!letter) break;

          currentWord += letter;
          if (currentWord.length >= 3 && dictionary.has(currentWord)) {
            found.push(currentWord);
          }
        }
      }
    }
  }

  return [...new Set(found)];
}

function getScoreForPureGrid(charArray) {
  if (!Array.isArray(charArray) || charArray.length !== GameState.CELL_COUNT) {
    console.error('getScoreForPureGrid: invalid charArray, returning score 0.');
    return 0;
  }

  const found = findValidWordsLocalArray(charArray);
  let score = 0;
  const grouped = {};

  for (const w of found) {
    const rev = w.split('').reverse().join('');
    const key = w < rev ? w : rev;
    if (!grouped[key]) {
      grouped[key] = true;
      const len = key.length;
      if (len === 3) score += 1;
      else if (len === 4) score += 5;
      else if (len === 5) score += 20;
    }
  }

  return score;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}