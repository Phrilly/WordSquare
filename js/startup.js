'use strict';

const BURST_DURATION = 3000;
let _winnerBurstTimeouts = new Set();

function triggerMiniWinnerBurst() {
  try {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
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

      const timeoutId = setTimeout(() => {
        p.remove();
        _winnerBurstTimeouts.delete(timeoutId);
      }, BURST_DURATION);
      _winnerBurstTimeouts.add(timeoutId);
    }

    document.body.appendChild(fragment);
  } catch (err) {
    console.error('triggerMiniWinnerBurst: failed to render burst.', err);
  }
}

function showWinnerOverlay(initials) {
  try {
    const overlay = document.getElementById('winner-overlay');
    const initialsBox = document.getElementById('winner-initials');

    if (!overlay || !initialsBox) {
      console.warn('showWinnerOverlay: overlay elements not found, skipping.');
      return;
    }

    initialsBox.textContent = typeof initials === 'string' ? initials.slice(0, 3) : '---';
    overlay.style.display = 'flex';

    void overlay.offsetWidth;
    overlay.classList.add('active');
    triggerMiniWinnerBurst();

    setTimeout(() => {
      overlay.classList.remove('active');
      setTimeout(() => { overlay.style.display = 'none'; }, 500);
    }, BURST_DURATION - 500);
  } catch (err) {
    console.error('showWinnerOverlay: failed to display overlay.', err);
  }
}

function showToast(message, isError = true) {
  try {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.position = 'fixed';
      toastContainer.style.bottom = '16px';
      toastContainer.style.left = '50%';
      toastContainer.style.transform = 'translateX(-50%)';
      toastContainer.style.zIndex = '10001';
      toastContainer.style.display = 'flex';
      toastContainer.style.flexDirection = 'column';
      toastContainer.style.gap = '8px';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.background = isError ? '#7f1d1d' : '#14532d';
    toast.style.color = '#ffffff';
    toast.style.padding = '10px 16px';
    toast.style.borderRadius = '8px';
    toast.style.fontFamily = 'Arial, sans-serif';
    toast.style.fontSize = '13px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
    toast.style.maxWidth = '90vw';

    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  } catch (err) {
    console.error('showToast: failed to render toast, falling back to console.', message, err);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const localInitialsInput = document.getElementById('hidden-initials');
    if (localInitialsInput) {
      localInitialsInput.addEventListener('input', (e) => {
        const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
        e.target.value = val;
        ['init-tile-1', 'init-tile-2', 'init-tile-3'].forEach((id, i) => {
          const el = document.getElementById(id);
          if (el) el.textContent = val[i] || '';
        });
      });
    } else {
      console.warn('startup.js: #hidden-initials not found.');
    }

    const localNextBtn = document.getElementById('next-letter');
    if (localNextBtn) {
      localNextBtn.addEventListener('click', () => {
        if (localNextBtn.textContent === '?') {
          GameState.setPendingCellIndex(-1);
          if (typeof updateWildcardModal === 'function') updateWildcardModal();
          const alphaModal = document.getElementById('alphabet-modal');
          if (alphaModal) alphaModal.classList.add('active');
          return;
        }

        const debugModeEnabled = Boolean(window.GAME_CONFIG && window.GAME_CONFIG.debugMode);
        if (!debugModeEnabled) return;

        try {
          const forcedLetter = prompt('Developer Cheat Mode: Enter a specific letter (A-Z)');
          if (forcedLetter && /^[a-zA-Z]$/.test(forcedLetter)) {
            localNextBtn.textContent = forcedLetter.toUpperCase();
          }
        } catch (err) {
          console.error('Dev cheat mode prompt failed.', err);
        }
      });
    } else {
      console.warn('startup.js: #next-letter not found.');
    }

    if (typeof setupAlphabetGrid === 'function') {
      setupAlphabetGrid();
    } else {
      console.error('startup.js: setupAlphabetGrid is not defined.');
    }

    try {
      const generatedId = (crypto && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      GameState.setSessionId(generatedId);
    } catch (err) {
      console.error('startup.js: failed to generate session ID, using fallback.', err);
      GameState.setSessionId(`fallback-${Date.now()}`);
    }

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
        fetchWithTimeout('validate.php', fetchOpts('get_dict'), 10000),
        fetchWithTimeout('validate.php', fetchOpts('get_yesterdays_winner'), 10000),
        fetchWithTimeout('validate.php', fetchOpts('get_highscores'), 10000)
      ]);

      if (!dictRes.ok) {
        const txt = await dictRes.text().catch(() => '<unreadable response>');
        console.error(`get_dict failed with status ${dictRes.status}:`, txt);
        showToast('Failed to load dictionary. Some words may not score correctly.');
      } else {
        dictData = await dictRes.json();
      }

      if (!winnerRes.ok) {
        const txt = await winnerRes.text().catch(() => '<unreadable response>');
        console.error(`get_yesterdays_winner failed with status ${winnerRes.status}:`, txt);
      } else {
        winnerData = await winnerRes.json();
      }

      if (!hsRes.ok) {
        const txt = await hsRes.text().catch(() => '<unreadable response>');
        console.error(`get_highscores failed with status ${hsRes.status}:`, txt);
        showToast('Failed to load leaderboard data.');
      } else {
        hsData = await hsRes.json();
      }
    } catch (err) {
      console.error('startup.js: fetch phase failed.', err);
      showToast('Network error during startup. Some features may be unavailable.');
    }

    try {
      if (dictData && Array.isArray(dictData.words) && dictData.words.length > 0) {
        GameState.setDictionary(dictData.words);
      } else {
        console.warn('startup.js: dictionary returned empty, scoring will find no words.');
        GameState.setDictionary([]);
      }
    } catch (err) {
      console.error('startup.js: failed to set dictionary.', err);
    }

    if (typeof loadLeaderboard === 'function') {
      try {
        await loadLeaderboard();
      } catch (err) {
        console.error('startup.js: initial loadLeaderboard failed.', err);
      }
    } else {
      console.error('startup.js: loadLeaderboard is not defined.');
    }

    try {
      if (typeof initGame === 'function') initGame();
      else console.error('startup.js: initGame is not defined.');
    } catch (err) {
      console.error('startup.js: initGame failed.', err);
    }

    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.style.display = 'none';
    else console.warn('startup.js: #loading-screen not found.');

    if (winnerData && winnerData.winner_initials) {
      showWinnerOverlay(winnerData.winner_initials);
    }

    const openingScreen = document.getElementById('opening-screen');
    const openingGrid = document.getElementById('opening-grid');

    if (openingScreen && openingGrid) {
      try {
        openingGrid.innerHTML = '';
        const highscores = Array.isArray(hsData && hsData.highscores) ? hsData.highscores : [];
        const fragment = document.createDocumentFragment();

        if (highscores.length > 0) {
          for (let r = 0; r < 8; r++) {
            const scoreData = highscores[r] || null;

            const rankCell = document.createElement('div');
            rankCell.className = 'grid-cell' + (scoreData ? ' filled rank' : '');
            if (r === 0 && scoreData) rankCell.classList.add('top-rank');
            rankCell.textContent = scoreData ? String(r + 1) : '';
            fragment.appendChild(rankCell);

            const initials = scoreData
              ? String(scoreData.initials || '---').substring(0, 3).padEnd(3, ' ')
              : '   ';
            for (let i = 0; i < 3; i++) {
              const c = document.createElement('div');
              c.className = 'grid-cell' + (scoreData && initials[i] !== ' ' ? ' filled' : '');
              c.textContent = initials[i] !== ' ' ? initials[i] : '';
              fragment.appendChild(c);
            }

            const sep = document.createElement('div');
            sep.className = 'grid-cell';
            fragment.appendChild(sep);

            const scoreStr = scoreData && Number.isFinite(scoreData.score)
              ? String(scoreData.score).padStart(3, ' ')
              : '   ';
            for (let i = 0; i < 3; i++) {
              const c = document.createElement('div');
              c.className = 'grid-cell' + (scoreData && scoreStr[i] !== ' ' ? ' filled' : '');
              c.textContent = scoreStr[i] !== ' ' ? scoreStr[i] : '';
              fragment.appendChild(c);
            }
          }
        } else {
          const noScoresGrid = [
            ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',
            ' ', ' ', ' ', ' ', 'S', ' ', ' ', ' ',
            ' ', ' ', ' ', ' ', 'C', ' ', ' ', ' ',
            ' ', ' ', ' ', 'N', 'O', ' ', ' ', ' ',
            ' ', ' ', ' ', ' ', 'R', ' ', ' ', ' ',
            ' ', ' ', ' ', 'Y', 'E', 'T', ' ', ' ',
            ' ', ' ', ' ', ' ', 'S', ' ', ' ', ' ',
            ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '
          ];
          for (let i = 0; i < 64; i++) {
            const c = document.createElement('div');
            c.className = 'grid-cell' + (noScoresGrid[i] !== ' ' ? ' filled' : '');
            c.textContent = noScoresGrid[i] !== ' ' ? noScoresGrid[i] : '';
            fragment.appendChild(c);
          }
        }

        openingGrid.appendChild(fragment);
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
        } else {
          console.warn('startup.js: #play-btn-tiles not found.');
        }
      } catch (err) {
        console.error('startup.js: failed to render opening screen.', err);
      }
    } else {
      console.warn('startup.js: opening screen elements not found, skipping intro.');
    }
  } catch (err) {
    console.error('startup.js: fatal error during boot sequence.', err);
    showToast('The game failed to start. Please refresh the page.');
  }
});