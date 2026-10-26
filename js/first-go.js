/**
 * First-go tracking.
 *
 * A player's first attempt of the day at a game is marked on the high score
 * table, because every later attempt benefits from already knowing the puzzle.
 * There are no accounts, so "first" means the first attempt started on this
 * browser for that game on that UTC day. It is an honour marker, not a security
 * control: clearing site data on the device resets it.
 */
(function () {
  'use strict';

  const STORAGE_PREFIX = 'ws_first_go_';
  let currentAttemptIsFirst = false;
  let attemptStarted = false;

  function utcDateString() {
    return new Date().toISOString().slice(0, 10);
  }

  function storageKey(gameKey) {
    return STORAGE_PREFIX + String(gameKey).toLowerCase().replace(/[^a-z0-9_-]/g, '') + '_' + utcDateString();
  }

  /**
   * Record that an attempt has started and report whether it is the first one
   * today for this game. Storage failures count as "not first" so a blocked
   * store can never award the marker.
   */
  function beginAttempt(gameKey) {
    attemptStarted = true;
    currentAttemptIsFirst = false;
    try {
      const key = storageKey(gameKey);
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, String(Date.now()));
        currentAttemptIsFirst = true;
      }
    } catch (error) {
      console.warn('First-go tracking unavailable:', error);
    }
    return currentAttemptIsFirst;
  }

  function isCurrentAttemptFirst() {
    return attemptStarted && currentAttemptIsFirst;
  }

  /**
   * Marker per row of a table already sorted best-first: the crown goes to the
   * best first-go score, a star to every other first-go score.
   */
  function markersFor(rows) {
    const list = Array.isArray(rows) ? rows : [];
    let crownGiven = false;
    return list.map((entry) => {
      if (!entry || entry.first_go !== true) return '';
      if (!crownGiven) {
        crownGiven = true;
        return '\uD83C\uDFC6';
      }
      return '1\uFE0F\u20E3';
    });
  }

  window.WSFirstGo = {
    beginAttempt: beginAttempt,
    isCurrentAttemptFirst: isCurrentAttemptFirst,
    markersFor: markersFor,
    legend: '\uD83C\uDFC6 best first go   1\uFE0F\u20E3 first go of the day'
  };

  // Main game: a new board resets the attempt, and the first placed tile starts it.
  document.addEventListener('ws:beforeInit', () => {
    attemptStarted = false;
    currentAttemptIsFirst = false;
  });

  document.addEventListener('ws:tilePlaced', () => {
    if (attemptStarted) return;
    const mode = typeof getCurrentGameMode === 'function' ? getCurrentGameMode() : 'classic';
    beginAttempt(mode);
  });
})();
