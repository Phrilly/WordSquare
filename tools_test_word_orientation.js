const fs = require('fs');
const vm = require('vm');

const utilsSource = fs.readFileSync('js/utils.js', 'utf8');
const gameplaySource = fs.readFileSync('js/gameplay.js', 'utf8');
const tetrisSource = fs.readFileSync('js/gameplay-tetris.js', 'utf8');
const topUpSource = fs.readFileSync('js/gameplay-topup.js', 'utf8');
const helperStart = utilsSource.indexOf('function getDictionaryWordOrientation');
const helperEnd = utilsSource.indexOf('\nfunction buildGroupedWordData', helperStart);

if (helperStart < 0 || helperEnd < 0) {
  throw new Error('Unable to locate getDictionaryWordOrientation in js/utils.js.');
}

const context = {
  gameDictionary: new Set(['CAT', 'DOG', 'PARTS', 'STRAP', 'LEVEL'])
};
vm.createContext(context);
vm.runInContext(utilsSource.slice(helperStart, helperEnd), context);

const cases = [
  ['forward word remains forward', 'CAT', 'CAT'],
  ['reverse-only spelling is corrected', 'TAC', 'CAT'],
  ['another reverse-only spelling is corrected', 'GOD', 'DOG'],
  ['both valid orientations preserve detected word', 'PARTS', 'PARTS'],
  ['both valid orientations preserve reverse detection', 'STRAP', 'STRAP'],
  ['palindrome remains unchanged', 'LEVEL', 'LEVEL'],
  ['input is normalized', ' tac ', 'CAT'],
  ['unknown spelling is preserved', 'XYZ', 'XYZ']
];

for (const [label, input, expected] of cases) {
  const actual = context.getDictionaryWordOrientation(input);
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function extractFunctions(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    throw new Error(`Unable to extract source between ${startMarker} and ${endMarker}.`);
  }
  return source.slice(start, end);
}

const classicContext = {
  cells: [],
  findValidWordsLocalArray: () => ['STAR'],
  getDictionaryWordOrientation: context.getDictionaryWordOrientation,
  Map
};
vm.createContext(classicContext);
vm.runInContext(
  extractFunctions(gameplaySource, 'function getCurrentGridScoreEvents', '\nfunction renderScoreBreakdown'),
  classicContext
);
const classicEvents = classicContext.getCurrentGridScoreEvents();
if (classicEvents.length !== 1 || classicEvents[0].word !== 'STAR' || classicEvents[0].points !== 5) {
  throw new Error(`Classic event orientation failed: ${JSON.stringify(classicEvents)}`);
}

const reverseRow = ['R', 'A', 'T', 'S'];
const tetrisContext = {
  cells: reverseRow.concat(Array(21).fill('')),
  gridSize: 5,
  gameDictionary: new Set(['STAR']),
  getDictionaryWordOrientation: context.getDictionaryWordOrientation,
  Map,
  Array
};
context.gameDictionary = tetrisContext.gameDictionary;
vm.createContext(tetrisContext);
vm.runInContext(
  extractFunctions(tetrisSource, 'function getTetrisWordScore', '\nfunction collectMatchedWordIndices'),
  tetrisContext
);
const tetrisResult = tetrisContext.createMatchedWordResult();
if (tetrisResult.scoreGain !== 5 || tetrisResult.words.length !== 1 || tetrisResult.words[0] !== 'STAR') {
  throw new Error(`Tetris event orientation failed: ${JSON.stringify(tetrisResult)}`);
}

const topUpContext = {
  cells: ['S', 'T', 'R', 'A', 'P'].concat(Array(20).fill('')),
  gridSize: 5,
  gameDictionary: new Set(['PARTS']),
  getDictionaryWordOrientation: context.getDictionaryWordOrientation,
  Array
};
context.gameDictionary = topUpContext.gameDictionary;
vm.createContext(topUpContext);
vm.runInContext(
  extractFunctions(topUpSource, 'function isTopUpDictionaryWord', '\nfunction awardTopUpScoringWords'),
  topUpContext
);
const topUpMatches = topUpContext.computeTopUpMatches();
if (topUpMatches.length !== 1 || topUpMatches[0].word !== 'PARTS') {
  throw new Error(`Top Up event orientation failed: ${JSON.stringify(topUpMatches)}`);
}

console.log(`Word orientation tests passed (${cases.length + 3} cases).`);