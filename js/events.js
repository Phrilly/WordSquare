document.addEventListener('DOMContentLoaded', () => {
  // Highscore Entry Modal
  document.getElementById('submit-score-btn')?.addEventListener('click', submitHighscore);
  document.getElementById('skip-to-leaderboard-btn')?.addEventListener('click', skipToLeaderboard);

  // Leaderboard Modal
  document.getElementById('play-again-btn')?.addEventListener('click', initGame);

  // Best Board Modal
  document.getElementById('back-to-leaderboard-btn')?.addEventListener('click', showLeaderboardFromBest);


  // Settings
  document.getElementById('daily-toggle')?.addEventListener('change', initGame);
  document.getElementById('cycle-daily-btn')?.addEventListener('click', cycleDailyBoard);
  document.getElementById('reset-daily-btn')?.addEventListener('click', resetDailyOffset);
});