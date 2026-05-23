function triggerMiniWinnerBurst() {
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const maxDim = Math.max(window.innerWidth, window.innerHeight);
  
  for (let i = 0; i < 150; i++) {
    const p = document.createElement('div');
    p.className = 'particle mega-burst' + (Math.random() > 0.5 ? ' alt' : '');
    p.innerText = alphabet[Math.floor(Math.random() * alphabet.length)];
    p.style.left = centerX + 'px';
    p.style.top = centerY + 'px';
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * (maxDim * 0.6);
    p.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
    p.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
    p.style.setProperty('--rot', (Math.random() - 0.5) * 720 + 'deg');
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 3000);
  }
}

function showWinnerOverlay(initials) {
  // REVIEW NOTE: The dynamic creation of this overlay with inline styles
  // makes it hard to maintain. A better approach would be to define the
  // overlay's structure in index.html, style it with CSS classes, and
  // use this JavaScript function simply to populate the data and make
  // the pre-existing element visible.

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
  title.style.marginBottom = '12px';
  title.style.fontSize = '36px';
  title.style.textAlign = 'center';
  title.style.lineHeight = '1.2';
  title.style.padding = '0 20px';

  const initialsBox = document.createElement('div');
  initialsBox.innerText = initials;
  initialsBox.style.fontSize = '72px';
  initialsBox.style.fontWeight = 'bold';
  initialsBox.style.color = '#FFD700';
  initialsBox.style.textShadow = '0 0 16px #ffaa00';
  initialsBox.style.textAlign = 'center';

  overlay.appendChild(title);
  overlay.appendChild(initialsBox);

  document.body.appendChild(overlay);

  triggerMiniWinnerBurst();

  // The particle explosion lasts 3000ms. This timeout starts fading the overlay at 2500ms.
  setTimeout(() => {
    overlay.style.transition = 'opacity 0.5s';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 500);
  }, 2500);
}

initialsInput.addEventListener('input', (e) => {
  const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
  e.target.value = val;
  document.getElementById('init-tile-1').innerText = val[0] || '';
  document.getElementById('init-tile-2').innerText = val[1] || '';
  document.getElementById('init-tile-3').innerText = val[2] || '';
});

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

window.onload = async function bootstrapGame() {
  setupAlphabetGrid();
  // Generate a unique ID for this browser session for auditing purposes.
  sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  const dictPromise = fetch('validate.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_dict' })
  }).then(res => res.json()).catch(e => {
    console.error("Failed to load dictionary", e);
    return { words: [] };
  });

  const winnerPromise = fetch('validate.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_yesterdays_winner' })
  }).then(res => res.json()).catch(e => {
    console.error("Could not fetch yesterday's winner", e);
    return { winner_initials: null };
  });

  const hsPromise = fetch('validate.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_highscores' })
  }).then(res => res.json()).catch(e => {
    console.error("Could not fetch highscores", e);
    return { highscores: [] };
  });

  const [dictData, winnerData, hsData] = await Promise.all([dictPromise, winnerPromise, hsPromise]);

  if (dictData.words) {
    gameDictionary = new Set(dictData.words);
  }

  // Pre-initialize game in background
  initGame();

  document.getElementById('loading-screen').style.display = 'none';

  if (winnerData.winner_initials) {
    showWinnerOverlay(winnerData.winner_initials);
  }

  // Setup and show Opening Screen
  const openingScreen = document.getElementById('opening-screen');
  const openingGrid = document.getElementById('opening-grid');
  openingGrid.innerHTML = '';
  
  const highscores = hsData.highscores || [];
  
  if (highscores.length === 0) {
    // No scores layout: Crossword "NO SCORES YET"
    // NO (horizontal): row 1, col 2-3
    // SCORES (vertical): row 1-6, col 3 (intersect 'O')
    // YET (horizontal): row 5, col 2-4 (intersect 'E' at col 3)
    // Map of cells: [row][col] -> 'LETTER'
    const noScoreMap = {
      1: { 2: 'N', 3: 'O' }, // O is shared
      2: { 3: 'S' },
      3: { 3: 'C' },
      4: { 3: 'O' },
      5: { 3: 'R' },
      6: { 2: 'Y', 3: 'E', 4: 'T' }, // E is shared
      7: { 3: 'S' }
    };
    // Wait, the user asked NO SCORES YET with SCORES vertical sharing O and E
    // 'N', 'O' -> 'O' is at index 1 of NO.
    // 'S', 'C', 'O', 'R', 'E', 'S' -> 'O' is index 2, 'E' is index 4.
    // So if 'O' is shared: row 2, col 3 = 'O'. 'N' is row 2, col 2.
    // 'S' = row 0, col 3. 'C' = row 1, col 3.
    // 'O' = row 2, col 3.
    // 'R' = row 3, col 3.
    // 'E' = row 4, col 3.
    // 'S' = row 5, col 3.
    // 'YET' shares 'E'. 'E' is row 4, col 3. So 'Y' = row 4, col 2. 'T' = row 4, col 4.
    
    const crosswordMap = {
      1: { 3: 'S' },
      2: { 3: 'C' },
      3: { 2: 'N', 3: 'O' }, 
      4: { 3: 'R' },
      5: { 2: 'Y', 3: 'E', 4: 'T' }, 
      6: { 3: 'S' }
    };

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        let cell = document.createElement('div');
        if (crosswordMap[r] && crosswordMap[r][c]) {
          cell.className = 'grid-cell filled';
          cell.innerText = crosswordMap[r][c];
          
          // Let's color the crossword tiles to make them pop (using WordSquare colors)
          if (r === 3 && c === 2) cell.classList.add('word-3'); // N
          else if (r === 5 && (c === 2 || c === 4)) cell.classList.add('word-3'); // Y, T
          else cell.classList.add('word-4'); // The vertical SCORES and shared O/E
        } else {
          cell.className = 'grid-cell';
        }
        openingGrid.appendChild(cell);
      }
    }
  } else {
    for (let r = 0; r < 8; r++) {
      const scoreData = highscores[r] || null;
      
      // Col 0: Rank
      let rankCell = document.createElement('div');
      rankCell.className = 'grid-cell' + (scoreData ? ' filled rank' : '');
      if (r === 0 && scoreData) rankCell.classList.add('top-rank');
      rankCell.innerText = scoreData ? (r + 1).toString() : '';
      openingGrid.appendChild(rankCell);
      
      // Cols 1,2,3: Initials
      let initials = scoreData ? (scoreData.initials || '---').padEnd(3, ' ') : '   ';
      for (let i = 0; i < 3; i++) {
        let c = document.createElement('div');
        c.className = 'grid-cell' + (scoreData && initials[i] !== ' ' ? ' filled' : '');
        c.innerText = initials[i] !== ' ' ? initials[i] : '';
        openingGrid.appendChild(c);
      }
      
      // Col 4: Spacer
      let sep = document.createElement('div');
      sep.className = 'grid-cell';
      openingGrid.appendChild(sep);
      
      // Cols 5,6,7: Score
      let scoreStr = scoreData ? scoreData.score.toString().padStart(3, ' ') : '   ';
      for (let i = 0; i < 3; i++) {
        let c = document.createElement('div');
        c.className = 'grid-cell' + (scoreData && scoreStr[i] !== ' ' ? ' filled' : '');
        c.innerText = scoreStr[i] !== ' ' ? scoreStr[i] : '';
        openingGrid.appendChild(c);
      }
    }
  }

  openingScreen.style.display = 'flex';

  const playBtn = document.getElementById('play-btn-tiles');
  playBtn.addEventListener('click', () => {
    const allCells = openingScreen.querySelectorAll('.grid-cell');
    allCells.forEach(cell => {
      cell.style.setProperty('--rot', (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 45) + 'deg');
      cell.style.animationDelay = (Math.random() * 0.2) + 's';
      cell.classList.add('falling-tile');
    });
    
    setTimeout(() => {
      openingScreen.style.opacity = '0';
      setTimeout(() => {
        openingScreen.style.display = 'none';
      }, 500);
    }, 900);
  });
};
