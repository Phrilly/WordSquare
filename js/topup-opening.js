// Top Up Opening Screen
// Shows a prominent rules modal before gameplay begins, similar to Boggle.

document.addEventListener('ws:openingClosed', () => {
  if (!window.GAME_CONFIG || !window.GAME_CONFIG.isTopUpDay) return;
  
  const modal = document.getElementById('topup-opening-modal');
  const startBtn = document.getElementById('topup-start-btn');
  
  if (!modal || !startBtn) return;
  
  // Show the modal and prevent game init
  modal.style.display = 'flex';
  
  // When player clicks START GAME, close modal and init game
  startBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    if (typeof initGame === 'function') {
      initGame();
    }
  });
});
