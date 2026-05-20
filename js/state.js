const gridSize = 5;
let cells = Array(gridSize * gridSize).fill('');
let wildcardState = Array(gridSize * gridSize).fill(false);

let placedCount = 0;
let pendingCellIndex = null;
let explodedWords = new Set();
let currentScore = 0;
let isCurrentGameDaily = true;

let usedWildcards = new Set();
let gameDictionary = new Set();
let gameDeck = [];
let bestDailyData = null;

let aiBestScore = 0;
let aiBestGrid = [];
localStorage.removeItem('ws_daily_offset');
let dailyOffset = 0;
let dailySeed = 0;
let sessionId = '';

const gridEl = document.getElementById('grid');
const headerLabelEl = document.getElementById('header-label');
const nextLetterEl = document.getElementById('next-letter');
const scoreEl = document.getElementById('score');
const alphabetModal = document.getElementById('alphabet-modal');
const leftHeaderEl = document.getElementById('left-header');

const highscoreEntryModal = document.getElementById('highscore-entry-modal');
const leaderboardModal = document.getElementById('leaderboard-modal');
const initialsInput = document.getElementById('hidden-initials');
const topBarEl = document.querySelector('.top-bar');

const boardViewerTitleEl = document.getElementById('board-viewer-title');
const boardViewerScoreLineEl = document.getElementById('board-score-line');
const boardViewerScoreEl = document.getElementById('best-board-score');
