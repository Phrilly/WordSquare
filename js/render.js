'use strict';

function setupAlphabetGrid() {
  const alphabetModal = DomRefs.alphabetModal;
  if (!alphabetModal) {
    console.error('setupAlphabetGrid: alphabet modal element not found.');
    return;
  }

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
  const fragment = document.createDocumentFragment();

  letters.forEach(l => {
    const cell = document.createElement('div');
    cell.className = 'alpha-cell';
    cell.textContent = l;
    cell.addEventListener('click', () => selectWildcard(l));
    fragment.appendChild(cell);
  });

  for (let i = 0; i < 2; i++) {
    const empty = document.createElement('div');
    empty.className = 'alpha-cell empty-alpha';
    fragment.appendChild(empty);
  }

  const cancel = document.createElement('div');
  cancel.className = 'alpha-cell alpha-cancel';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => selectWildcard('Cancel'));
  fragment.appendChild(cancel);

  alphabetModal.innerHTML = '';
  alphabetModal.appendChild(fragment);
}

function updateWildcardModal() {
  const usedWildcards = GameState.getUsedWildcards();
  const alphaCells = document.querySelectorAll('.alpha-cell:not(.empty-alpha):not(.alpha-cancel)');
  alphaCells.forEach(cell => {
    if (usedWildcards.has(cell.textContent)) {
      cell.classList.add('used');
    } else {
      cell.classList.remove('used');
    }
  });
}

function setBoardViewerTheme(mode) {
  const { boardViewerTitleEl, boardViewerScoreLineEl, boardViewerScoreEl } = DomRefs;
  if (!boardViewerTitleEl || !boardViewerScoreLineEl || !boardViewerScoreEl) {
    console.warn('setBoardViewerTheme: one or more board viewer elements missing.');
    return;
  }

  boardViewerTitleEl.classList.remove('top-score-mode', 'ai-mode');
  boardViewerScoreLineEl.classList.remove('top-score-mode', 'ai-mode');
  boardViewerScoreEl.classList.remove('glow-gold', 'glow-blue');

  if (mode === 'top') {
    boardViewerTitleEl.classList.add('top-score-mode');
    boardViewerScoreLineEl.classList.add('top-score-mode');
    boardViewerScoreEl.classList.add('glow-gold');
  } else if (mode === 'ai') {
    boardViewerTitleEl.classList.add('ai-mode');
    boardViewerScoreLineEl.classList.add('ai-mode');
    boardViewerScoreEl.classList.add('glow-blue');
  }
}

function renderWordListsForBoard(groupedData) {
  // Word lists intentionally removed from UI. Kept as a no-op stub
  // so callers relying on typeof-checks continue to function safely.
  if (!groupedData) {
    console.warn('renderWordListsForBoard: called with no data.');
  }
}

function applyColorsToSpecificGrid(validWords, cellsArray, containerElement) {
  if (!containerElement || typeof containerElement.querySelectorAll !== 'function') {
    console.error('applyColorsToSpecificGrid: invalid containerElement.');
    return;
  }
  if (!Array.isArray(cellsArray)) {
    console.error('applyColorsToSpecificGrid: cellsArray must be an array.');
    return;
  }

  const cellEls = containerElement.querySelectorAll('.grid-cell:not(.alpha-cell)');
  cellEls.forEach(cell => cell.classList.remove('word-3', 'word-4', 'word-5'));

  if (!Array.isArray(validWords) || validWords.length === 0) return;

  const wordsByLength = { 3: [], 4: [], 5: [] };
  validWords.forEach(w => {
    if (typeof w === 'string' && wordsByLength[w.length]) {
      wordsByLength[w.length].push(w);
    }
  });

  const directions = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [-1, 1], [1, -1]];
  const gridSize = GameState.GRID_SIZE;

  function highlightWord(word, lengthClass) {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        for (const [dr, dc] of directions) {
          let match = true;
          const indices = [];

          for (let i = 0; i < word.length; i++) {
            const nextRow = r + (dr * i);
            const nextCol = c + (dc * i);

            if (nextRow < 0 || nextRow >= gridSize || nextCol < 0 || nextCol >= gridSize) {
              match = false;
              break;
            }

            const idx = nextRow * gridSize + nextCol;
            if (cellsArray[idx] !== word[i]) {
              match = false;
              break;
            }
            indices.push(idx);
          }

          if (match) {
            indices.forEach(idx => {
              if (cellEls[idx]) {
                cellEls[idx].classList.remove('word-3', 'word-4', 'word-5');
                cellEls[idx].classList.add(lengthClass);
              }
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

const _activeParticleTimeouts = new Set();

function triggerExplosion(isMega = false) {
  const gridEl = DomRefs.gridEl;
  if (!gridEl) {
    console.error('triggerExplosion: grid element not found.');
    return;
  }

  const gridRect = gridEl.getBoundingClientRect();
  const centerX = gridRect.left + (gridRect.width / 2);
  const centerY = gridRect.top + (gridRect.height / 2);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const particleCount = isMega ? 150 : 40;
  const durationMs = 3000;
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement('div');
    p.className = 'particle';

    if (isMega) p.classList.add('mega-burst');
    if (Math.random() > 0.5) p.classList.add('alt');

    p.textContent = alphabet[Math.floor(Math.random() * alphabet.length)];
    p.style.left = centerX + 'px';
    p.style.top = centerY + 'px';

    const angle = Math.random() * Math.PI * 2;
    const baseDist = isMega ? 250 : 120;
    const distMod = isMega ? 0.8 : 0.45;
    const distance = baseDist + Math.random() * (window.innerWidth * distMod);

    p.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
    p.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
    p.style.setProperty('--rot', (Math.random() - 0.5) * 720 + 'deg');

    fragment.appendChild(p);

    const timeoutId = setTimeout(() => {
      p.remove();
      _activeParticleTimeouts.delete(timeoutId);
    }, durationMs);
    _activeParticleTimeouts.add(timeoutId);
  }

  document.body.appendChild(fragment);
}

function clearAllParticleTimeouts() {
  _activeParticleTimeouts.forEach(id => clearTimeout(id));
  _activeParticleTimeouts.clear();
  document.querySelectorAll('.particle').forEach(p => p.remove());
}