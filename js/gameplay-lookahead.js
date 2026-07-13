// ================================
// LOOKAHEAD VARIANT
// ================================

function syncLookaheadQueue() {
  if (!window.GAME_CONFIG || !window.GAME_CONFIG.isLookaheadDay) return;

  const queueContainer = document.getElementById('queue-container');
  const nextLetterEl = document.getElementById('next-letter');
  const queue1El = document.getElementById('queue-1');
  const queue2El = document.getElementById('queue-2');

  if (nextLetterEl) nextLetterEl.style.display = 'inline-flex';
  if (queueContainer) queueContainer.classList.add('is-active');

  if (queue1El) {
    if ((queue1El.innerText || '').trim() !== '') {
      queue1El.classList.add('is-active');
    } else {
      queue1El.classList.remove('is-active');
    }
  }

  if (queue2El) {
    if ((queue2El.innerText || '').trim() !== '') {
      queue2El.classList.add('is-active');
    } else {
      queue2El.classList.remove('is-active');
    }
  }
}

document.addEventListener('ws:afterInit', () => {
  if (!window.GAME_CONFIG || !window.GAME_CONFIG.isLookaheadDay) return;
  syncLookaheadQueue();
});

document.addEventListener('ws:nextLetterUpdated', () => {
  if (!window.GAME_CONFIG || !window.GAME_CONFIG.isLookaheadDay) return;
  syncLookaheadQueue();
});

document.addEventListener('ws:tileUndone', () => {
  if (!window.GAME_CONFIG || !window.GAME_CONFIG.isLookaheadDay) return;
  syncLookaheadQueue();
});