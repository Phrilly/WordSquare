function getDailySeed() {
  const today = new Date();
  const dateStr = today.getUTCFullYear() + "-" + (today.getUTCMonth() + 1) + "-" + today.getUTCDate();
  let s = 0;
  for (let i = 0; i < dateStr.length; i++) s += dateStr.charCodeAt(i) * (i + 1);
  return (s + dailyOffset) * 12345;
}

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
    const bagString = "EEEEEEEEEEEAAAAAAAAIIIIIIIOOOOOOOUUUSSSSSRRRRRTTTTTNNNNNLLLLDDDDGGCCMMBBPPHHFFWWYYVKXJQZ????????????";
    const initialBag = bagString.split('');
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
  let vowelCount = 0;
  let sCount = 0;

  while (!isValid) {
    sequence = [];
    let tempBag = [...initialBag];
    vowelCount = 0;
    sCount = 0;

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

  const activeRules = {
    enforceWildcardLimits: Date.now() >= Date.UTC(2026, 4, 22),
    minVowels: 6
  };

  for (let i = 0; i < wcCount && safeIndices.length > 0; i++) {
    const randSafeIdx = Math.floor(rng() * safeIndices.length);
    const replaceIdx = safeIndices.splice(randSafeIdx, 1)[0];
    const charToReplace = sequence[replaceIdx];

    if (activeRules.enforceWildcardLimits) {
      let isEssential = false;

      if (vowels.includes(charToReplace) && vowelCount <= activeRules.minVowels) {
        isEssential = true;
      }

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
  let grouped = {};
  let result = {
    rawScoringWords: [],
    display: {
      3: [],
      4: [],
      5: []
    }
  };

  validWords.forEach(w => {
    let rev = w.split('').reverse().join('');
    let key = w < rev ? w : rev;
    if (!grouped[key]) grouped[key] = new Set();
    grouped[key].add(w);
  });

  Object.keys(grouped).forEach(key => {
    let wArr = [...grouped[key]];
    wArr.sort();

    result.rawScoringWords.push(...wArr);

    let len = key.length;
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

          if (currentWord.length >= 3 && gameDictionary.has(currentWord)) {
            found.push(currentWord);
          }
        }
      }
    }
  }

  return [...new Set(found)];
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
