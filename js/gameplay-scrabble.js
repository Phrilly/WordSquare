// ================================
// SCRABBLE VARIANT (5-LETTER ONLY)
// ================================

let scrabblePot = [];
let scrabbleTray = ['', '', '', '', ''];
let currentPotIndex = 0;
let selectedTrayIndex = -1;
let scrabbleLastMove = null;

const SCRABBLE_VALUES = {
    A:1, B:3, C:3, D:2, E:1, F:4, G:2, H:4, I:1, J:8, K:5, L:1, M:3, 
    N:1, O:1, P:3, Q:10, R:1, S:1, T:1, U:1, V:4, W:4, X:8, Y:4, Z:10
};

let DL_INDICES = [5, 9, 15, 19];

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

function getOption1WildcardCount(rnd) {
        const wcRoll = rnd() * 100;
        if (wcRoll < 5) return 0;
        if (wcRoll < 30) return 1;
        if (wcRoll < 70) return 2;
        if (wcRoll < 95) return 3;
        return 4;
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
    const wildcardCount = getOption1WildcardCount(rnd);
    const safeIndices = [];
    for (let i = 0; i < sequence.length; i++) {
        if (sequence[i] !== 'S' && sequence[i] !== 'Q') {
            safeIndices.push(i);
        }
    }

    for (let i = 0; i < wildcardCount && safeIndices.length > 0; i++) {
        const pick = Math.floor(rnd() * safeIndices.length);
        const idx = safeIndices.splice(pick, 1)[0];
        sequence[idx] = '?';
    }

    return sequence;
}

function generateRandomDLSquares() {
    const rnd = makeDailyRandom('scrabble-dl');
    const allIndices = Array.from({length: 25}, (_, i) => i);
    const dlIndices = [];
    
    // Helper function to check if a position is valid with existing DL squares
    function isValidPosition(idx, existing) {
        const row = Math.floor(idx / 5);
        const col = idx % 5;
        
        for (const existingIdx of existing) {
            const existingRow = Math.floor(existingIdx / 5);
            const existingCol = existingIdx % 5;
            
            // Check if squares are too close: both horizontal AND vertical separation < 2
            // This prevents squares from being adjacent or diagonally adjacent
            if (Math.abs(col - existingCol) < 2 && Math.abs(row - existingRow) < 2) {
                return false;
            }
        }
        return true;
    }
    
    // Try to find 4 valid positions
    let attempts = 0;
    const maxAttempts = 1000;
    
    while (dlIndices.length < 4 && attempts < maxAttempts) {
        // Shuffle available indices
        const shuffled = [...allIndices].sort(() => rnd() - 0.5);
        
        for (const idx of shuffled) {
            if (isValidPosition(idx, dlIndices)) {
                dlIndices.push(idx);
                if (dlIndices.length === 4) break;
            }
        }
        
        // If we didn't find 4, reset and try again
        if (dlIndices.length < 4) {
            dlIndices.length = 0;
            attempts++;
        }
    }
    
    // Fallback to default positions if we can't find valid ones
    if (dlIndices.length < 4) {
        console.warn('Could not find 4 valid DL positions, using defaults');
        return [5, 9, 15, 19];
    }
    
    return dlIndices.sort((a, b) => a - b);
}

function renderScrabbleTray() {
    const scrabbleTrayEl = document.getElementById('scrabble-tray');
    const trayCells = document.querySelectorAll('.scrabble-tray .tray-cell');
    if (!trayCells || trayCells.length === 0) return;

    const hasPlayableTile = scrabbleTray.some(letter => letter !== '');
    const needsSelection = hasPlayableTile && selectedTrayIndex === -1;

    if (scrabbleTrayEl) {
        scrabbleTrayEl.classList.toggle('needs-selection', needsSelection);
    }

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
    
    // Generate random DL squares for this game
    DL_INDICES = generateRandomDLSquares();
    
    for(let i=0; i<5; i++) {
        scrabbleTray[i] = scrabblePot[currentPotIndex];
        currentPotIndex++;
    }
    selectedTrayIndex = -1;
});

document.addEventListener('ws:afterInit', () => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isScrabbleDay) return;

    const queueContainer = document.getElementById('queue-container');
    if (queueContainer) queueContainer.classList.remove('is-active');

    const queue1El = document.getElementById('queue-1');
    const queue2El = document.getElementById('queue-2');
    if (queue1El) queue1El.classList.remove('is-active');
    if (queue2El) queue2El.classList.remove('is-active');

    const nextLetterEl = document.getElementById('next-letter');
    if (nextLetterEl) nextLetterEl.style.display = 'none';

    const scrabbleTrayEl = document.getElementById('scrabble-tray');
    if (scrabbleTrayEl) scrabbleTrayEl.style.display = 'flex';

    if (typeof topBarEl !== 'undefined' && topBarEl) {
        topBarEl.classList.add('scrabble-mode');
    }
    
    const headerLabelEl = document.getElementById('header-label');
    if (headerLabelEl) {
        headerLabelEl.innerText = '';
        headerLabelEl.style.display = 'none';
    }

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

document.addEventListener('ws:nextLetterUpdated', () => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isScrabbleDay) return;

    const queueContainer = document.getElementById('queue-container');
    const queue1El = document.getElementById('queue-1');
    const queue2El = document.getElementById('queue-2');

    if (queueContainer) queueContainer.classList.remove('is-active');
    if (queue1El) queue1El.classList.remove('is-active');
    if (queue2El) queue2El.classList.remove('is-active');

    const nextLetterEl = document.getElementById('next-letter');
    if (nextLetterEl) nextLetterEl.style.display = 'none';
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

    // Scrabble fully owns tile placement. Always suppress shared fallback placement.
    e.preventDefault();

    if (selectedTrayIndex < 0 || selectedTrayIndex >= scrabbleTray.length) {
        return;
    }

    const letterToPlace = scrabbleTray[selectedTrayIndex];
    if (!letterToPlace || letterToPlace === '') return;

    if (letterToPlace === '?') {
        pendingCellIndex = e.detail.index;
        if (typeof updateWildcardModal === 'function') updateWildcardModal();
        if (typeof alphabetModal !== 'undefined' && alphabetModal) {
            alphabetModal.classList.add('active');
        }
        return;
    }

    if (typeof placeLetter === 'function') {
        placeLetter(e.detail.index, letterToPlace, e.detail.cellEl, false);
    }
});

document.addEventListener('ws:tilePlaced', () => {
    if (!window.GAME_CONFIG || !window.GAME_CONFIG.isScrabbleDay) return;

    const placedTrayIndex = selectedTrayIndex;
    if (placedTrayIndex < 0 || placedTrayIndex >= scrabbleTray.length) {
        return;
    }

    // Record hand state before refill, so undo can restore exactly.
    scrabbleLastMove = {
        trayIndex: placedTrayIndex,
        potAdvanced: (currentPotIndex < scrabblePot.length)
    };

    if (currentPotIndex < scrabblePot.length) {
        scrabbleTray[placedTrayIndex] = scrabblePot[currentPotIndex];
        currentPotIndex++;
    } else {
        scrabbleTray[placedTrayIndex] = '';
    }

    // Require explicit tray click before every placement.
    selectedTrayIndex = -1;

    renderScrabbleTray();

    if (placedCount >= 25) {
        if (typeof triggerEndGame === 'function') triggerEndGame();
        return;
    }

    const hasRemainingTrayLetters = scrabbleTray.some(letter => letter !== '');
    if (!hasRemainingTrayLetters && typeof triggerEndGame === 'function') {
        triggerEndGame();
    }
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

    // Undo does not auto-select; player must click a tray tile before placing.
    selectedTrayIndex = -1;

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
            const isWildcardTile = (typeof wildcardState !== 'undefined' && wildcardState[idx]);
            let val = isWildcardTile ? 0 : (SCRABBLE_VALUES[letter] || 0);
            if (!isWildcardTile && DL_INDICES.includes(idx)) {
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