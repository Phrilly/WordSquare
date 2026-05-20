document.addEventListener('DOMContentLoaded', () => {
  // Highscore Entry Modal
  document.getElementById('submit-score-btn')?.addEventListener('click', submitHighscore);
  document.getElementById('skip-to-leaderboard-btn')?.addEventListener('click', skipToLeaderboard);

  // Leaderboard Modal
  document.getElementById('view-winning-btn')?.addEventListener('click', showBestBoard);
  document.getElementById('view-ai-btn')?.addEventListener('click', showAIBoard);
  document.getElementById('view-my-board-btn')?.addEventListener('click', hideModalsForBoardView);
  document.getElementById('play-again-btn')?.addEventListener('click', initGame);

  // Best Board Modal
  document.getElementById('back-to-leaderboard-btn')?.addEventListener('click', showLeaderboardFromBest);

  // Main UI
  document.getElementById('return-to-menu-btn')?.addEventListener('click', showLeaderboard);

  // Settings
  document.getElementById('daily-toggle')?.addEventListener('change', initGame);
  document.getElementById('cycle-daily-btn')?.addEventListener('click', cycleDailyBoard);
  document.getElementById('reset-daily-btn')?.addEventListener('click', resetDailyOffset);
});