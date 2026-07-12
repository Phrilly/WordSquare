'use strict';

/**
 * Centralized, encapsulated game state.
 * Exposes controlled mutators instead of raw globals to prevent
 * accidental cross-module corruption.
 */
const GameState = (() => {
  const GRID_SIZE = 5;
  const CELL_COUNT = GRID_SIZE * GRID_SIZE;

  let _cells = Array(CELL_COUNT).fill('');
  let _wildcardState = Array(CELL_COUNT).fill(false);
  let _placedCount = 0;
  let _currentDeckIndex = 0;
  let _pendingCellIndex = null;
  let _explodedWords = new Set();
  let _currentScore = 0;
  let _isCurrentGameDaily = true;
  let _usedWildcards = new Set();
  let _gameDictionary = new Set();
  let _gameDeck = [];
  let _bestDailyData = null;
  let _aiBestScore = 0;
  let _aiBestGrid = [];
  let _dailyOffset = 0;
  let _dailySeed = 0;
  let _sessionId = '';

  function safeLocalStorageRemove(key) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (err) {
      console.warn(`GameState: could not access localStorage for key "${key}".`, err);
    }
  }

  safeLocalStorageRemove('ws_daily_offset');

  return {
    GRID_SIZE,
    CELL_COUNT,

    getCells() { return _cells; },
    setCells(arr) {
      if (!Array.isArray(arr) || arr.length !== CELL_COUNT) {
        throw new TypeError(`GameState.setCells: expected array of length ${CELL_COUNT}.`);
      }
      _cells = arr;
    },
    resetCells() { _cells = Array(CELL_COUNT).fill(''); },

    getWildcardState() { return _wildcardState; },
    setWildcardState(arr) {
      if (!Array.isArray(arr) || arr.length !== CELL_COUNT) {
        throw new TypeError(`GameState.setWildcardState: expected array of length ${CELL_COUNT}.`);
      }
      _wildcardState = arr;
    },
    resetWildcardState() { _wildcardState = Array(CELL_COUNT).fill(false); },

    getPlacedCount() { return _placedCount; },
    incrementPlacedCount() { _placedCount++; return _placedCount; },
    decrementPlacedCount() {
      _placedCount = Math.max(0, _placedCount - 1);
      return _placedCount;
    },
    resetPlacedCount() { _placedCount = 0; },

    getCurrentDeckIndex() { return _currentDeckIndex; },
    incrementDeckIndex() { _currentDeckIndex++; return _currentDeckIndex; },
    decrementDeckIndex() {
      _currentDeckIndex = Math.max(0, _currentDeckIndex - 1);
      return _currentDeckIndex;
    },
    resetDeckIndex() { _currentDeckIndex = 0; },

    getPendingCellIndex() { return _pendingCellIndex; },
    setPendingCellIndex(idx) {
      if (idx !== null && (!Number.isInteger(idx) || idx < -1 || idx >= CELL_COUNT)) {
        throw new RangeError(`GameState.setPendingCellIndex: invalid index ${idx}.`);
      }
      _pendingCellIndex = idx;
    },

    getExplodedWords() { return _explodedWords; },
    clearExplodedWords() { _explodedWords.clear(); },

    getCurrentScore() { return _currentScore; },
    setCurrentScore(score) {
      if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
        throw new TypeError(`GameState.setCurrentScore: invalid score ${score}.`);
      }
      _currentScore = score;
    },
    resetCurrentScore() { _currentScore = 0; },

    isDaily() { return _isCurrentGameDaily; },
    setDaily(flag) { _isCurrentGameDaily = Boolean(flag); },

    getUsedWildcards() { return _usedWildcards; },
    clearUsedWildcards() { _usedWildcards.clear(); },

    getDictionary() { return _gameDictionary; },
    setDictionary(words) {
      if (!Array.isArray(words)) {
        throw new TypeError('GameState.setDictionary: expected an array of words.');
      }
      _gameDictionary = new Set(words.filter(w => typeof w === 'string' && w.length > 0));
    },

    getDeck() { return _gameDeck; },
    setDeck(deck) {
      if (!Array.isArray(deck)) {
        throw new TypeError('GameState.setDeck: expected an array.');
      }
      _gameDeck = deck;
    },

    getBestDailyData() { return _bestDailyData; },
    setBestDailyData(data) { _bestDailyData = data; },

    getAiBestScore() { return _aiBestScore; },
    setAiBestScore(score) {
      if (typeof score !== 'number' || !Number.isFinite(score)) {
        throw new TypeError(`GameState.setAiBestScore: invalid score ${score}.`);
      }
      _aiBestScore = score;
    },

    getAiBestGrid() { return _aiBestGrid; },
    setAiBestGrid(grid) {
      if (!Array.isArray(grid) || grid.length !== CELL_COUNT) {
        throw new TypeError(`GameState.setAiBestGrid: expected array of length ${CELL_COUNT}.`);
      }
      _aiBestGrid = grid;
    },

    getDailyOffset() { return _dailyOffset; },
    setDailyOffset(offset) {
      if (!Number.isInteger(offset)) {
        throw new TypeError(`GameState.setDailyOffset: invalid offset ${offset}.`);
      }
      _dailyOffset = offset;
    },

    getDailySeed() { return _dailySeed; },
    setDailySeed(seed) {
      if (typeof seed !== 'number' || !Number.isFinite(seed)) {
        throw new TypeError(`GameState.setDailySeed: invalid seed ${seed}.`);
      }
      _dailySeed = seed;
    },
    mutateDailySeed(delta) {
      _dailySeed += delta;
      return _dailySeed;
    },

    getSessionId() { return _sessionId; },
    setSessionId(id) {
      if (typeof id !== 'string' || id.length === 0) {
        throw new TypeError('GameState.setSessionId: expected a non-empty string.');
      }
      _sessionId = id;
    }
  };
})();

// Cached DOM references with defensive lookups. Each getter logs a warning
// (not a throw) if the element is missing, so a single missing element
// never crashes the entire game boot sequence.
const DomRefs = (() => {
  function get(id) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`DomRefs: element with id "${id}" was not found in the DOM.`);
    }
    return el;
  }
  function query(selector) {
    const el = document.querySelector(selector);
    if (!el) {
      console.warn(`DomRefs: element matching "${selector}" was not found in the DOM.`);
    }
    return el;
  }

  return {
    gridEl: get('grid'),
    headerLabelEl: get('header-label'),
    queueContainerEl: get('queue-container'),
    nextLetterEl: get('next-letter'),
    queue1El: get('queue-1'),
    queue2El: get('queue-2'),
    scoreEl: get('score'),
    alphabetModal: get('alphabet-modal'),
    leftHeaderEl: get('left-header'),
    highscoreEntryModal: get('highscore-entry-modal'),
    leaderboardModal: get('leaderboard-modal'),
    initialsInput: get('hidden-initials'),
    topBarEl: query('.top-bar'),
    boardViewerTitleEl: get('board-viewer-title'),
    boardViewerScoreLineEl: get('board-score-line'),
    boardViewerScoreEl: get('best-board-score')
  };
})();