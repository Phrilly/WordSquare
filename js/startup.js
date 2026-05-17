function triggerMiniWinnerBurst() {
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle' + (Math.random() > 0.5 ? ' alt' : '');
    p.innerText = alphabet[Math.floor(Math.random() * alphabet.length)];
    p.style.left = centerX + 'px';
    p.style.top = centerY + 'px';
    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 140;
    p.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
    p.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
    p.style.setProperty('--rot', (Math.random() - 0.5) * 360 + 'deg');
    
    // Adjusted particle animation to 1.5s to match the new 2-second window
    p.style.animation = 'explode 1.5s ease-out forwards';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1500);
  }
}

function checkYesterdaysWinner() {
  fetch('validate.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_yesterdays_winner' })
  })
    .then(res => res.json())
    .then(data => {
      if (!data.winner_initials) return;

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
      initialsBox.innerText = data.winner_initials;
      initialsBox.style.fontSize = '72px';
      initialsBox.style.fontWeight = 'bold';
      initialsBox.style.color = '#FFD700';
      initialsBox.style.textShadow = '0 0 16px #ffaa00';

      overlay.appendChild(title);
      overlay.appendChild(initialsBox);
      document.body.appendChild(overlay);

      triggerMiniWinnerBurst();

      // Exactly 2 seconds total: 1.5 seconds of display, 0.5 seconds of smooth fade out
      setTimeout(() => {
        overlay.style.transition = 'opacity 0.5s';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 500);
      }, 1500);
    })
    .catch(e => {
      console.error("Could not fetch yesterday's winner", e);
    });
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

  try {
    const res = await fetch('validate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_dict' })
    });
    const data = await res.json();
    if (data.words) gameDictionary = new Set(data.words);
  } catch (e) {
    console.error("Failed to load dictionary", e);
  }

  document.getElementById('loading-screen').style.display = 'none';
  checkYesterdaysWinner();
  initGame();
};
