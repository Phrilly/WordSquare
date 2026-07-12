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
  
  if (!overlay || !initialsBox) return;
  initialsBox.textContent = initials;
  overlay.style.display = 'flex';
  
  // Force a browser reflow to guarantee CSS transitions fire
  void overlay.offsetWidth; 
  overlay.classList.add('active');
  triggerMiniWinnerBurst();
  
  setTimeout(() => {
    overlay.classList.remove('active');
    setTimeout(() => { overlay.style.display = 'none'; }, 500); 
  }, BURST_DURATION - 500);
}

// Wrap the entire boot sequence to guarantee DOM and State are 100% loaded
document.addEventListener('DOMContentLoaded', async () => {
  
  // 1. Safely bind event listeners by fetching elements directly
  const localInitialsInput = document.getElementById('hidden-initials');
  if (localInitialsInput) {
    localInitialsInput.addEventListener('input', (e) => {
      const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
      e.target.value = val;
      const t1 = document.getElementById('init-tile-1');
      const t2 = document.getElementById('init-tile-2');
      const t3 = document.getElementById('init-tile-3');
      if (t1) t1.textContent = val[0] || '';
      if (t2) t2.textContent = val[1] || '';
      if (t3) t3.textContent = val[2] || '';
    });
  }

  const localNextBtn = document.getElementById('next-letter');
  if (localNextBtn) {
    localNextBtn.addEventListener('click', () => {
      if (localNextBtn.textContent === '?') {
        if (typeof pendingCellIndex !== 'undefined') pendingCellIndex = -1;
        if (typeof updateWildcardModal === 'function') updateWildcardModal();
        const alphaModal = document.getElementById('alphabet-modal');
        if (alphaModal) alphaModal.classList.add('active');
      } else {
        const forcedLetter = prompt("Developer Cheat Mode: Enter a specific letter (A-Z)");
        if (forcedLetter && /^[a-zA-Z]$/.test(forcedLetter)) {
          localNextBtn.textContent = forcedLetter.toUpperCase();
        }
      }
    });
  }

  // 2. Initialize secondary UI grids
  if (typeof setupAlphabetGrid === 'function') {
    setupAlphabetGrid();
  }
  
  // Unconditional assignment for session ID
  sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  
  // 3. Perform concurrent API fetches securely
  const fetchOpts = (actionName) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: actionName })
  });
  let dictData = { words: [] };
  let winnerData = { winner_initials: null };
  let hsData = { highscores: [] };

  try {
    const [dictRes, winnerRes, hsRes] = await Promise.all([
      fetch('validate.php', fetchOpts('get_dict')).then(r => r.json()).catch(() => ({ words: [] })),
      fetch('validate.php', fetchOpts('get_yesterdays_winner')).then(r => r.json()).catch(() => ({ winner_initials: null })),
      fetch('validate.php', fetchOpts('get_highscores')).then(r => r.json()).catch(() => ({ highscores: [] }))
    ]);
    dictData = dictRes;
    winnerData = winnerRes;
    hsData = hsRes;
  } catch (err) {
    console.error("Fetch phase failed:", err);
  }

  // 4. Safely populate the global dictionary for scoring logic
  if (dictData && dictData.words && dictData.words.length > 0) {
    if (typeof gameDictionary !== 'undefined') {
      gameDictionary.clear();
      dictData.words.forEach(w => gameDictionary.add(w));
    }
  } else {
    console.warn("Word Square Engine: Dictionary returned empty.");
  }

  // 5. Pre-fetch and render leaderboard values inside the UI before unveiling screens
  if (typeof loadLeaderboard === 'function') {
      await loadLeaderboard();
  }

  // 6. Initialize the main game state safely
  try {
    if (typeof initGame === 'function') initGame();
  } catch (e) {
    console.error("initGame failed:", e);
  }
  
  // SEQUENCE ENFORCEMENT: Only drop the loading mask here
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }

  if (winnerData && winnerData.winner_initials) {
    showWinnerOverlay(winnerData.winner_initials);
  }

  // 7. Build the Opening Screen safely
  const openingScreen = document.getElementById('opening-screen');
  const openingGrid = document.getElementById('opening-grid');
  if (openingScreen && openingGrid) {
    openingGrid.innerHTML = '';
    let highscores = (hsData && Array.isArray(hsData.highscores)) ? hsData.highscores : [];
    
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
      // 8. Render "NO SCORES YET" fallback grid
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
    
    openingScreen.style.display = 'flex';
    const playBtn = document.getElementById('play-btn-tiles');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        openingScreen.querySelectorAll('.grid-cell').forEach(cell => {
          cell.style.setProperty('--rot', (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 45) + 'deg');
          cell.style.animationDelay = (Math.random() * 0.2) + 's';
          cell.classList.add('falling-tile');
        });
        setTimeout(() => {
          openingScreen.style.opacity = '0';
          setTimeout(() => { openingScreen.style.display = 'none'; }, 500);
        }, 900);
      });
    }
  }
});