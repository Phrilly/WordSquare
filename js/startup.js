const BURST_DURATION = 3000;

function triggerMiniWinnerBurst() {
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const maxDim = Math.max(window.innerWidth, window.innerHeight);
  
  const fragment = document.createDocumentFragment();
  
  for (let i = 0; i < 150; i++) {
    const p = document.createElement('div');
    p.className = 'particle mega-burst' + (Math.random() > 0.5 ? ' alt' : '');
    p.textContent = alphabet[Math.floor(Math.random() * alphabet.length)];
    p.style.left = centerX + 'px';
    p.style.top = centerY + 'px';
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * (maxDim * 0.6);
    p.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
    p.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
    p.style.setProperty('--rot', (Math.random() - 0.5) * 720 + 'deg');
    
    fragment.appendChild(p);
    setTimeout(() => p.remove(), BURST_DURATION);
  }
  
  document.body.appendChild(fragment);
}

function showWinnerOverlay(initials) {
  const overlay = document.getElementById('winner-overlay');
  const initialsBox = document.getElementById('winner-initials');

  if (!overlay || !initialsBox) {
    console.warn("Winner overlay elements missing from DOM.");
    return;
  }

  initialsBox.textContent = initials;
  overlay.style.display = 'flex';
  
  void overlay.offsetWidth; 
  overlay.classList.add('active');

  triggerMiniWinnerBurst();

  setTimeout(() => {
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 500); 
  }, BURST_DURATION - 500);
}

window.addEventListener('load', async function bootstrapGame() {
  try {
    if (typeof initialsInput !== 'undefined' && initialsInput) {
      initialsInput.addEventListener('input', (e) => {
        const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
        e.target.value = val;
        const tile1 = document.getElementById('init-tile-1');
        const tile2 = document.getElementById('init-tile-2');
        const tile3 = document.getElementById('init-tile-3');
        if (tile1) tile1.textContent = val[0] || '';
        if (tile2) tile2.textContent = val[1] || '';
        if (tile3) tile3.textContent = val[2] || '';
      });
    }

    if (typeof nextLetterEl !== 'undefined' && nextLetterEl) {
      nextLetterEl.addEventListener('click', () => {
        if (nextLetterEl.textContent === '?') {
          if (typeof pendingCellIndex !== 'undefined') pendingCellIndex = -1;
          if (typeof updateWildcardModal === 'function') updateWildcardModal();
          if (typeof alphabetModal !== 'undefined' && alphabetModal) alphabetModal.classList.add('active');
        } else {
          const forcedLetter = prompt("Developer Cheat Mode: Enter a specific letter (A-Z)");
          if (forcedLetter && /^[a-zA-Z]$/.test(forcedLetter)) {
            nextLetterEl.textContent = forcedLetter.toUpperCase();
          }
        }
      });
    }

    if (typeof setupAlphabetGrid === 'function') {
      setupAlphabetGrid();
    }
    
    // Correctly targeting the state.js variable without "window."
    sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    let dictData = { words: [] }, winnerData = { winner_initials: null }, hsData = { highscores: [] };

    try {
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

      const results = await Promise.all([dictPromise, winnerPromise, hsPromise]);
      dictData = results[0] || { words: [] };
      winnerData = results[1] || { winner_initials: null };
      hsData = results[2] || { highscores: [] };
    } catch (fetchErr) {
      console.error("Fetch block failed completely", fetchErr);
    }

    if (dictData && dictData.words) {
      // Correctly targeting the state.js variable without "window."
      gameDictionary = new Set(dictData.words);
    }

    try {
      if (typeof initGame === 'function') initGame();
    } catch (error) {
      console.error("Error during initGame:", error);
      alert("Game Load Error: " + error.message);
    }

    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }

    if (winnerData && winnerData.winner_initials) {
      showWinnerOverlay(winnerData.winner_initials);
    }

    const openingScreen = document.getElementById('opening-screen');
    const openingGrid = document.getElementById('opening-grid');
    
    if (openingScreen && openingGrid) {
      try {
        openingGrid.innerHTML = '';
        
        let highscores = [];
        if (hsData && Array.isArray(hsData.highscores)) {
          highscores = hsData.highscores;
        } else if (Array.isArray(hsData)) {
          highscores = hsData;
        }
        
        if (highscores.length > 0) {
          for (let r = 0; r < 8; r++) {
            const scoreData = highscores[r] || null;
            
            let rankCell = document.createElement('div');
            rankCell.className = 'grid-cell' + (scoreData ? ' filled rank' : '');
            if (r === 0 && scoreData) rankCell.classList.add('top-rank');
            rankCell.textContent = scoreData ? (r + 1).toString() : '';
            openingGrid.appendChild(rankCell);
            
            let initials = scoreData ? String(scoreData.initials || '---').substring(0,3).padEnd(3, ' ') : '   ';
            for (let i = 0; i < 3; i++) {
              let c = document.createElement('div');
              c.className = 'grid-cell' + (scoreData && initials[i] !== ' ' ? ' filled' : '');
              c.textContent = initials[i] !== ' ' ? initials[i] : '';
              openingGrid.appendChild(c);
            }
            
            let sep = document.createElement('div');
            sep.className = 'grid-cell';
            openingGrid.appendChild(sep);
            
            let scoreStr = scoreData && scoreData.score != null ? String(scoreData.score).padStart(3, ' ') : '   ';
            for (let i = 0; i < 3; i++) {
              let c = document.createElement('div');
              c.className = 'grid-cell' + (scoreData && scoreStr[i] !== ' ' ? ' filled' : '');
              c.textContent = scoreStr[i] !== ' ' ? scoreStr[i] : '';
              openingGrid.appendChild(c);
            }
          }
        } else {
          const noScoresGrid = [
            " ", " ", " ", " ", " ", " ", " ", " ",
            " ", " ", " ", " ", "S", " ", " ", " ",
            " ", " ", " ", " ", "C", " ", " ", " ",
            " ", " ", " ", "N", "O", " ", " ", " ",
            " ", " ", " ", " ", "R", " ", " ", " ",
            " ", " ", " ", "Y", "E", "T", " ", " ",
            " ", " ", " ", " ", "S", " ", " ", " ",
            " ", " ", " ", " ", " ", " ", " ", " "
          ];
          for (let i = 0; i < 64; i++) {
            let c = document.createElement('div');
            c.className = 'grid-cell' + (noScoresGrid[i] !== " " ? ' filled' : '');
            c.textContent = noScoresGrid[i] !== " " ? noScoresGrid[i] : '';
            openingGrid.appendChild(c);
          }
        }

        const playBtn = document.getElementById('play-btn-tiles');
        if (playBtn) {
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
        }
      } catch (e) {
        console.error("Failed to build opening screen grid cleanly", e);
        alert("Opening screen error: " + e.message);
      } finally {
        openingScreen.style.display = 'flex';
      }
    } else {
      console.warn("Opening screen elements not found in DOM");
    }
  } catch (globalErr) {
    console.error("Global bootstrap error:", globalErr);
    alert("Fatal Error: " + globalErr.message);
  }
});