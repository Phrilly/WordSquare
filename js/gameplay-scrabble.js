// ================================
// SCRABBLE VARIANT (5-LETTER ONLY)
// ================================

let scrabblePot = [];
let scrabbleTray = ['', '', '', '', ''];
let currentPotIndex = 0;
let selectedTrayIndex = 0;
let scrabbleLastMove = null;

const SCRABBLE_VALUES = {
    A:1, B:3, C:3, D:2, E:1, F:4, G:2, H:4, I:1, J:8, K:5, L:1, M:3, 
    N:1, O:1, P:3, Q:10, R:1, S:1, T:1, U:1, V:4, W:4, X:8, Y:4, Z:10
};

const DL_INDICES = [5, 9, 15, 19];

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

function buildScrabbleDeck() {
    const poolString = "AAAAAAAAABBCCODDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ";
    const pool = poolString.split('');
    const rnd = makeDailyRandom('scrabble-deck');
    
    let sequence = [];
    let isValid = false;
    const vowels = ['A','E','I','O','U'];

    while (!isValid) {
        let tempPool = [...pool];
        sequence = [];
        let vCount = 0;
        
        for (let i = 0; i < 30; i++) {
            const idx = Math.floor(rnd() * tempPool.length);
            const letter = tempPool.splice(idx, 1)[0];
            sequence.push(letter);
            if (vowels.includes(letter)) vCount++;
        }
        if (vCount >= 8 && vCount <= 12) {
            isValid = true;
        }
    }
    return sequence;
}

function renderScrabbleTray() {
    const trayCells = document.querySelectorAll('.scrabble-tray .tray-cell');
    if (!trayCells || trayCells.length === 0) return;

    trayCells.forEach((cell, i) => {
        const letter = scrabbleTray[i];
        cell.innerText = letter;
        
        if (letter !== '') {
            cell.dataset.letter = letter; 
            cell.classList.remove('is-empty');
        } else {
            delete cell.dataset.letter;
            cell.classList.add('is-empty');
        }

        if (i === selectedTrayIndex) {
            cell.classList.add('is-selected');
        } else {
            cell.classList.remove('is-selected');
        }
    });
}

// ---------------------------------------------------------
// EDA Hooks
// ---------------------------------------------------------

document.addEventListener('ws:beforeInit', () => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isScrabbleDay) return;
    scrabblePot = buildScrabbleDeck();
    currentPotIndex = 0;
    scrabbleLastMove = null;
    
    for(let i=0; i<5; i++) {
        scrabbleTray[i] = scrabblePot[currentPotIndex];
        currentPotIndex++;
    }
    selectedTrayIndex = 0;
});

document.addEventListener('ws:afterInit', () => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isScrabbleDay) return;
    
    const headerLabelEl = document.getElementById('header-label');
    if (headerLabelEl) headerLabelEl.innerText = 'Hand:';

    if (gridEl) {
        const gridCells = gridEl.querySelectorAll('.grid-cell:not(.alpha-cell)');
        DL_INDICES.forEach(i => {
            if (gridCells[i]) gridCells[i].classList.add('dl-square');
        });
    }

    const trayCells = document.querySelectorAll('.scrabble-tray .tray-cell');
    if (trayCells) {
        trayCells.forEach((cell, index) => {
            cell.addEventListener('click', () => {
                if (scrabbleTray[index] !== '') {
                    selectedTrayIndex = index;
                    renderScrabbleTray();
                }
            });
        });
    }

    renderScrabbleTray();
});

document.addEventListener('ws:getHoverLetter', (e) => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isScrabbleDay) return;
    e.detail.letter = scrabbleTray[selectedTrayIndex] || '';
});

// Suppress 3 and 4 letter hover previews on Scrabble Day
document.addEventListener('ws:applyHover', (e) => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isScrabbleDay) return;
    e.preventDefault(); 
    
    const maxLen = e.detail.maxLen;
    if (maxLen === 5) {
        e.detail.cellEl.classList.add('hover-5');
    }
});

document.addEventListener('ws:cellClick', (e) => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isScrabbleDay) return;

    const letterToPlace = scrabbleTray[selectedTrayIndex];
    if (!letterToPlace || letterToPlace === '') return;

    e.preventDefault();

    // Record the exact state BEFORE the tile is physically placed and refilled
    scrabbleLastMove = {
        trayIndex: selectedTrayIndex,
        potAdvanced: (currentPotIndex < scrabblePot.length)
    };

    if (typeof placeLetter === 'function') {
        placeLetter(e.detail.index, letterToPlace, e.detail.cellEl, false);
    }
});

document.addEventListener('ws:tilePlaced', () => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isScrabbleDay) return;

    if (currentPotIndex < scrabblePot.length) {
        scrabbleTray[selectedTrayIndex] = scrabblePot[currentPotIndex];
        currentPotIndex++;
    } else {
        scrabbleTray[selectedTrayIndex] = '';
    }

    if (scrabbleTray[selectedTrayIndex] === '') {
        const nextValid = scrabbleTray.findIndex(l => l !== '');
        if (nextValid !== -1) selectedTrayIndex = nextValid;
    }

    renderScrabbleTray();
});

// Rewind Scrabble Hand
document.addEventListener('ws:tileUndone', (e) => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isScrabbleDay) return;
    if (!scrabbleLastMove) return;

    const undoneLetter = e.detail.letter;

    // 1. Revert the draw from the pot
    if (scrabbleLastMove.potAdvanced) {
        currentPotIndex--;
    }

    // 2. Put the letter exactly back where it came from
    scrabbleTray[scrabbleLastMove.trayIndex] = undoneLetter;
    
    // 3. Re-select that slot for UX continuity
    selectedTrayIndex = scrabbleLastMove.trayIndex;

    // Clean up
    scrabbleLastMove = null;
    renderScrabbleTray();
});

document.addEventListener('ws:calculateScore', (e) => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isScrabbleDay) return;

    e.preventDefault();

    let foundPaths = [];
    const dirs = [[0,1], [0,-1], [1,0], [-1,0], [1,1], [-1,-1], [-1,1], [1,-1]];
    
    for (let r=0; r<5; r++) {
        for (let c=0; c<5; c++) {
            for (let [dr, dc] of dirs) {
                let path = [];
                let word = "";
                for(let step=0; step<5; step++) {
                    let nr = r + (dr * step);
                    let nc = c + (dc * step);
                    if (nr<0 || nr>=5 || nc<0 || nc>=5) break;
                    
                    let idx = nr * 5 + nc;
                    let letter = cells[idx];
                    if (!letter) break;
                    
                    path.push(idx);
                    word += letter;

                    // STRICT 5-LETTER QUALIFICATION
                    if (word.length === 5 && gameDictionary.has(word)) {
                        foundPaths.push({ word: word, path: [...path] });
                    }
                }
            }
        }
    }
    
    let bestScoreForWord = {};
    let validWordsList = [];
    
    foundPaths.forEach(item => {
        let rev = item.word.split('').reverse().join('');
        let key = item.word < rev ? item.word : rev;
        
        let pathScore = 0;
        item.path.forEach(idx => {
            let letter = cells[idx].toUpperCase();
            let val = SCRABBLE_VALUES[letter] || 0;
            if (DL_INDICES.includes(idx)) {
                val *= 2; 
            }
            pathScore += val;
        });
        
        if (!bestScoreForWord[key] || pathScore > bestScoreForWord[key]) {
            bestScoreForWord[key] = pathScore;
        }
        validWordsList.push(item.word);
    });
    
    currentScore = 0;
    Object.values(bestScoreForWord).forEach(s => { currentScore += s; });
    
    if (scoreEl) scoreEl.innerText = currentScore;

    const uniqueValidWords = [...new Set(validWordsList)];
    const groupedData = buildGroupedWordData(uniqueValidWords);
    
    groupedData.display[5].forEach(displayStr => {
      if (!explodedWords.has(displayStr)) {
        if (typeof triggerExplosion === 'function') triggerExplosion(false);
        explodedWords.add(displayStr);
      }
    });

    if (typeof renderWordListsForBoard === 'function') renderWordListsForBoard(groupedData);
    if (typeof applyColorsToSpecificGrid === 'function' && gridEl) {
        applyColorsToSpecificGrid(groupedData.rawScoringWords, cells, gridEl);
    }
});