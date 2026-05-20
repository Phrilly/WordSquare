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

function setBoardViewerTheme(mode) {
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

function renderWordListsForBoard(validWords) {
  const groupedData = buildGroupedWordData(validWords);

  document.getElementById('list-5').innerHTML = groupedData.display[5]
    .map(w => `<span class="word-badge word-5">${w}</span>`)
    .join('');

  document.getElementById('list-4').innerHTML = groupedData.display[4]
    .map(w => `<span class="word-badge word-4">${w}</span>`)
    .join('');

  document.getElementById('list-3').innerHTML = groupedData.display[3]
    .map(w => `<span class="word-badge word-3">${w}</span>`)
    .join('');
}

function applyColorsToSpecificGrid(validWords, cellsArray, containerElement) {
  const cellEls = containerElement.querySelectorAll('.grid-cell:not(.alpha-cell)');
  cellEls.forEach(cell => cell.classList.remove('word-3', 'word-4', 'word-5'));

  if (!validWords || validWords.length === 0) return;

  const wordsByLength = { 3: [], 4: [], 5: [] };
  validWords.forEach(w => {
    if (wordsByLength[w.length]) wordsByLength[w.length].push(w);
  });

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

function triggerExplosion(isMega = false) {
  const gridRect = gridEl.getBoundingClientRect();
  const centerX = gridRect.left + (gridRect.width / 2);
  const centerY = gridRect.top + (gridRect.height / 2);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const particleCount = isMega ? 150 : 40;
  const durationMs = 3000;

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
