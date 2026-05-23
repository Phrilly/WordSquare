document.addEventListener('DOMContentLoaded', () => {
  // Highscore Entry Modal
  document.getElementById('submit-score-btn')?.addEventListener('click', submitHighscore);
  document.getElementById('skip-to-leaderboard-btn')?.addEventListener('click', skipToLeaderboard);

  // Leaderboard Modal
  document.getElementById('play-again-btn')?.addEventListener('click', initGame);

  // Best Board Modal
  document.getElementById('back-to-leaderboard-btn')?.addEventListener('click', showLeaderboardFromBest);
});