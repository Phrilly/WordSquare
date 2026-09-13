const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/gameplay-topup.js', 'utf8');
const start = source.indexOf('function isTopUpDictionaryWord');
const end = source.indexOf('\nfunction applyTopUpShortWordColors', start);

if (start < 0 || end < 0) {
  throw new Error('Unable to locate Top Up scoring helpers.');
}

const context = {
  cells: Array(25).fill(''),
  currentScore: 0,
  gameDictionary: new Set(['CAT', 'PARTS']),
  gridSize: 5,
  topUpAwardedShortWordKeys: new Set(),
  topUpClearedWordKeys: new Set(),
  topUpScoreEvents: [],
  applyTopUpShortWordColors: () => {},
  getDictionaryWordOrientation: (word) => {
    const normalizedWord = String(word || '').trim().toUpperCase();
    const reversedWord = normalizedWord.split('').reverse().join('');
    return context.gameDictionary.has(normalizedWord)
      ? normalizedWord
      : (context.gameDictionary.has(reversedWord) ? reversedWord : normalizedWord);
  },
  Array,
  Set,
  String,
};

vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertScore(expectedScore, expectedEvents, message) {
  assert(context.currentScore === expectedScore, `${message}: expected score ${expectedScore}, got ${context.currentScore}`);
  assert(context.topUpScoreEvents.length === expectedEvents, `${message}: expected ${expectedEvents} events, got ${context.topUpScoreEvents.length}`);
}

context.cells.splice(0, 3, 'C', 'A', 'T');
context.awardTopUpScoringWords();
assertScore(1, 1, 'first short-word formation');

context.cells[1] = '';
context.awardTopUpScoringWords();
assertScore(1, 1, 'breaking a short word');

context.cells[1] = 'A';
context.awardTopUpScoringWords();
assertScore(1, 1, 'rebuilding the same short-word path');

context.cells.splice(5, 3, 'C', 'A', 'T');
context.awardTopUpScoringWords();
assertScore(2, 2, 'forming the same short word on a new path');

assert(context.awardTopUpClearedWord('PARTS') === true, 'first five-letter clear must award points');
assertScore(22, 3, 'first five-letter clear');

assert(context.awardTopUpClearedWord('PARTS') === false, 'repeated five-letter clear must not award points');
assertScore(22, 3, 'repeated five-letter clear');

assert(context.awardTopUpClearedWord('STRAP') === false, 'reverse five-letter clear must not award points');
assertScore(22, 3, 'reverse five-letter clear');

context.topUpAwardedShortWordKeys = new Set();
context.topUpClearedWordKeys = new Set();
context.topUpScoreEvents = [];
context.currentScore = 0;
context.awardTopUpScoringWords();
assertScore(2, 2, 'new-game reset short-word scoring');
assert(context.awardTopUpClearedWord('PARTS') === true, 'new-game reset five-letter scoring');
assertScore(22, 3, 'new-game reset five-letter scoring');

console.log('Top Up scoring tests passed.');