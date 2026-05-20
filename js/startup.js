function triggerMiniWinnerBurst() {
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  // TEST ANIMATION: If the code updates successfully, you will see emojis instead of letters.
  const emojis = ["🏆", "⭐", "✨", "💥", "🎉"];
  
  for (let i = 0; i < 80; i++) {
    const p = document.createElement('div');
    p.className = 'particle' + (Math.random() > 0.5 ? ' alt' : '');
    p.innerText = emojis[Math.floor(Math.random() * emojis.length)];
    p.style.left = centerX + 'px';
    p.style.top = centerY + 'px';
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * (window.innerWidth * 0.4);
    p.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
    p.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
    p.style.setProperty('--rot', (Math.random() - 0.5) * 720 + 'deg');
    p.style.animation = 'explode 2.8s ease-out forwards';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 2800);
  }
}

function showWinnerOverlay(initials, version) {
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

  const initialsBox = document.createElement('div');
  initialsBox.innerText = initials;
  initialsBox.style.fontSize = '72px';
  initialsBox.style.fontWeight = 'bold';
  initialsBox.style.color = '#FFD700';
  initialsBox.style.textShadow = '0 0 16px #ffaa00';

  overlay.appendChild(title);
  overlay.appendChild(initialsBox);

  if (version) {
    const versionEl = document.createElement('div');
    versionEl.innerText = `v${version}`;
    versionEl.style.position = 'absolute';
    versionEl.style.bottom = '10px';
    versionEl.style.right = '15px';
    versionEl.style.color = 'var(--text-secondary)';
    versionEl.style.fontSize = '14px';
    overlay.appendChild(versionEl);
  }

  document.body.appendChild(overlay);

  triggerMiniWinnerBurst();

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

  const [dictData, winnerData] = await Promise.all([dictPromise, winnerPromise]);

  if (dictData.words) {
    gameDictionary = new Set(dictData.words);
  }

  document.getElementById('loading-screen').style.display = 'none';

  if (winnerData.winner_initials) {
    showWinnerOverlay(winnerData.winner_initials, winnerData.app_version);
  }

  initGame();
};
