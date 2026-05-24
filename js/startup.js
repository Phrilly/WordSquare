// --- ON-SCREEN MOBILE DEBUGGER ---
let earlyLogs = [];
let debugDiv = null;

function mobileDebugLog(msg) {
    if (debugDiv) {
        debugDiv.innerHTML += msg + "<br><br>";
        debugDiv.scrollTop = debugDiv.scrollHeight;
    } else {
        earlyLogs.push(msg);
        // Fallback alert for immediate hard crashes before the DOM loads
        alert("CRASH LOG: " + msg); 
    }
}

window.onerror = function(msg, url, line, col, error) {
    mobileDebugLog(`💥 ERROR: ${msg}<br>LINE: ${line}<br>URL: ${url}`);
    return false;
};

window.addEventListener("unhandledrejection", function(e) {
    mobileDebugLog(`⚠️ PROMISE REJECTED: ${e.reason}`);
});

const originalConsoleError = console.error;
console.error = function(...args) {
    mobileDebugLog(`❌ CONSOLE ERROR: ${args.map(a => String(a)).join(' ')}`);
    originalConsoleError.apply(console, args);
};

document.addEventListener("DOMContentLoaded", () => {
    debugDiv = document.createElement("div");
    debugDiv.style.position = "fixed";
    debugDiv.style.bottom = "0";
    debugDiv.style.left = "0";
    debugDiv.style.width = "100%";
    debugDiv.style.height = "35%";
    debugDiv.style.backgroundColor = "rgba(0,0,0,0.9)";
    debugDiv.style.color = "#00ff00";
    debugDiv.style.zIndex = "999999";
    debugDiv.style.overflowY = "auto";
    debugDiv.style.fontSize = "12px";
    debugDiv.style.fontFamily = "monospace";
    debugDiv.style.padding = "10px";
    debugDiv.style.borderTop = "2px solid #00ff00";
    document.body.appendChild(debugDiv);

    earlyLogs.forEach(log => {
        debugDiv.innerHTML += log + "<br><br>";
    });
    mobileDebugLog("✅ Debug console initialized. Waiting for errors...");
});
// --- END DEBUGGER ---

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

initialsInput.addEventListener('input', (e) => {
  const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
  e.target.value = val;
  document.getElementById('init-tile-1').textContent = val[0] || '';
  document.getElementById('init-tile-2').textContent = val[1] || '';
  document.getElementById('init-tile-3').textContent = val[2] || '';
});

nextLetterEl.addEventListener('click', () => {
  if (nextLetterEl.textContent === '?') {
    pendingCellIndex = -1;
    updateWildcardModal();
    alphabetModal.classList.add('active');
  } else {
    const forcedLetter = prompt("Developer Cheat Mode: Enter a specific letter (A-Z)");
    if (forcedLetter && /^[a-zA-Z]$/.test(forcedLetter)) {
      nextLetterEl.textContent = forcedLetter.toUpperCase();
    }
  }
});

(async function bootstrapGame() {
  try {
    setupAlphabetGrid();
    sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const fetchOpts = (actionName) => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionName })
    });

    mobileDebugLog("Fetching data from validate.php...");

    const dictPromise = fetch('validate.php', fetchOpts('get_dict'))
      .then(res => {
          if (!res.ok) throw new Error("Dict fetch failed with status: " + res.status);
          return res.json();
      }).catch(e => {
          console.error("Dict error:", e);
          return { words: [] };
      });
    
    const winnerPromise = fetch('validate.php', fetchOpts('get_yesterdays_winner'))
      .then(res => res.json()).catch(e => {
          console.error("Winner error:", e);
          return { winner_initials: null };
      });
    
    const hsPromise = fetch('validate.php', fetchOpts('get_highscores'))
      .then(res => res.json()).catch(e => {
          console.error("Highscore error:", e);
          return { highscores: [] };
      });

    const [dictData, winnerData, hsData] = await Promise.all([dictPromise, winnerPromise, hsPromise]);

    mobileDebugLog(`Dictionary loaded: ${dictData.words ? dictData.words.length : 0} words`);

    if (dictData && dictData.words && dictData.words.length > 0) {
      gameDictionary = new Set(dictData.words);
    } else {
      console.error("Dictionary was empty after fetch.");
    }

    initGame();
    
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.style.display = 'none';

    if (winnerData && winnerData.winner_initials) {
      showWinnerOverlay(winnerData.winner_initials);
    }

    const openingScreen = document.getElementById('opening-screen');
    const openingGrid = document.getElementById('opening-grid');
    
    if (openingScreen && openingGrid) {
      openingGrid.innerHTML = '';
      
      let highscores = (hsData && Array.isArray(hsData.highscores)) ? hsData.highscores : (Array.isArray(hsData) ? hsData : []);
      mobileDebugLog(`Highscores parsed: ${highscores.length}`);
      
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

      openingScreen.style.display = 'flex';

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
    }
  } catch (err) {
    console.error("Bootstrap final error:", err);
  }
})();