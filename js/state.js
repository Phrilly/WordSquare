const gridSize = 5;
let cells = Array(gridSize * gridSize).fill('');
let wildcardState = Array(gridSize * gridSize).fill(false);

let placedCount = 0;
let currentDeckIndex = 0; // NEW: Decouples tiles drawn from tiles placed
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

function getCurrentGameMode() {
	if (window.GAME_CONFIG && window.GAME_CONFIG.isBombDay) return 'bomb';
	if (window.GAME_CONFIG && window.GAME_CONFIG.isScrabbleDay) return 'scrabble';
	if (window.GAME_CONFIG && window.GAME_CONFIG.isLookaheadDay) return 'lookahead';
	if (window.GAME_CONFIG && window.GAME_CONFIG.isTetrisDay) return 'tetris';
	if (window.GAME_CONFIG && window.GAME_CONFIG.isBoggleDay) return 'boggle';
	if (window.GAME_CONFIG && window.GAME_CONFIG.isCommonDay) return 'mfd';
	return 'classic';
}

function getLeaderboardTitleText() {
	const mode = getCurrentGameMode();
	if (mode === 'mfd') return "TODAY'S MFD HIGH SCORES";
	if (mode === 'tetris') return "TODAY'S TETRIS HIGH SCORES";
	if (mode === 'boggle') return "BIG BOGGLE";
	return "TODAY'S HIGH SCORES";
}

const gridEl = document.getElementById('grid');
const headerLabelEl = document.getElementById('header-label');
const queueContainerEl = document.getElementById('queue-container');
const nextLetterEl = document.getElementById('next-letter');
const queue1El = document.getElementById('queue-1');
const queue2El = document.getElementById('queue-2');
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