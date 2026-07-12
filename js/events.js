'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const submitBtn = document.getElementById('submit-score-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', submitHighscore);
  } else {
    console.warn('events.js: #submit-score-btn not found.');
  }

  const skipBtn = document.getElementById('skip-to-leaderboard-btn');
  if (skipBtn) {
    skipBtn.addEventListener('click', skipToLeaderboard);
  } else {
    console.warn('events.js: #skip-to-leaderboard-btn not found.');
  }

  const playAgainBtn = document.getElementById('play-again-btn');
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', initGame);
  } else {
    console.warn('events.js: #play-again-btn not found.');
  }

  const backBtn = document.getElementById('back-to-leaderboard-btn');
  if (backBtn) {
    backBtn.addEventListener('click', showLeaderboardFromBest);
  } else {
    console.warn('events.js: #back-to-leaderboard-btn not found.');
  }
});