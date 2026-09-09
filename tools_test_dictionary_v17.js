// tools_test_dictionary_v17.js
//
// Verifies data/dict_en_v17.txt loads cleanly through the real Boggle loading
// pipeline. The two filter helpers (normaliseDictionaryWord and isGameSafeWord)
// and the three denylist / spelling constants are read straight out of
// js/boggle.js, so this test exercises the code the browser actually runs
// rather than a copy that can drift.
//
// Run with: node tools_test_dictionary_v17.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DICTIONARY_PATH = path.join(__dirname, 'data', 'dict_en_v17.txt');
const BOGGLE_SOURCE_PATH = path.join(__dirname, 'js', 'boggle.js');

// Words the game must accept once the dictionary is loaded.
const EXPECTED_PRESENT = ['COLOUR', 'ORGANISE', 'THEATRE', 'QUARTZ', 'ANTLER', 'ABANDONED'];

// Vulgar terms that the offensive denylist only blocks as exact stems, so
// inflections and compounds are reported rather than asserted.
const SENSITIVE_WATCHLIST = ['APESHIT', 'ANUS', 'ARSES', 'ASSES', 'FUCKS', 'SHITS'];

function extract(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) {
    throw new Error(`Unable to locate ${label} in js/boggle.js.`);
  }
  const end = source.indexOf(endMarker, start);
  if (end < 0) {
    throw new Error(`Unable to locate the end of ${label} in js/boggle.js.`);
  }
  return source.slice(start, end + endMarker.length);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// js/boggle.js is stored with CRLF line endings; normalise so the extraction
// markers below match on any checkout.
const boggleSource = fs.readFileSync(BOGGLE_SOURCE_PATH, 'utf8').replace(/\r\n/g, '\n');

// Guard against the loader and this test drifting apart.
assert(
  boggleSource.includes("'data/dict_en_v17.txt'"),
  'js/boggle.js no longer fetches data/dict_en_v17.txt; update this test with the new dictionary.'
);

// Top-level const declarations do not become context properties, so they are
// re-exported with var to make the denylists visible to the test.
const exportBlock = [
  'var __testProperNounDenylist = BOGGLE_PROPER_NOUN_DENYLIST;',
  'var __testOffensiveDenylist = BOGGLE_OFFENSIVE_DENYLIST;'
].join('\n');

const pipelineSource = [
  extract(boggleSource, 'const BOGGLE_PROPER_NOUN_DENYLIST', '\n]);', 'BOGGLE_PROPER_NOUN_DENYLIST'),
  extract(boggleSource, 'const BOGGLE_OFFENSIVE_DENYLIST', '\n]);', 'BOGGLE_OFFENSIVE_DENYLIST'),
  extract(boggleSource, 'const BOGGLE_UK_SPELLING_MAP', '\n};', 'BOGGLE_UK_SPELLING_MAP'),
  extract(boggleSource, 'function normaliseDictionaryWord', '\n}\n', 'normaliseDictionaryWord'),
  extract(boggleSource, 'function isGameSafeWord', '\n}\n', 'isGameSafeWord'),
  exportBlock
].join('\n\n');

const context = { Set };
vm.createContext(context);
vm.runInContext(pipelineSource, context);

const rawText = fs.readFileSync(DICTIONARY_PATH, 'utf8');
const rawEntries = rawText.trim().split(/\r?\n/);

const playable = new Set();
for (const rawEntry of rawEntries) {
  const word = context.normaliseDictionaryWord(rawEntry);
  if (!context.isGameSafeWord(word)) {
    continue;
  }
  playable.add(word);
}

assert(playable.size > 100000, `Playable word count too low: ${playable.size}`);

for (const word of EXPECTED_PRESENT) {
  assert(playable.has(word), `Expected dictionary word missing after filtering: ${word}`);
}

for (const noun of context.__testProperNounDenylist) {
  assert(!playable.has(noun), `Proper noun leaked into the playable dictionary: ${noun}`);
}

for (const offensive of context.__testOffensiveDenylist) {
  assert(!playable.has(offensive), `Offensive word leaked into the playable dictionary: ${offensive}`);
}

let shapeFailures = 0;
for (const word of playable) {
  if (!/^[A-Z]{4,25}$/.test(word)) {
    shapeFailures += 1;
  }
}
assert(shapeFailures === 0, `${shapeFailures} playable words are outside the 4-25 letter A-Z shape.`);

// The Boggle board renders a Q tile as "QU", so any word containing a Q that is
// not followed by a U can never be formed. Reported for awareness only.
const unplayableQWords = [...playable].filter(word => /Q(?!U)/.test(word));

const sensitive = SENSITIVE_WATCHLIST.filter(word => playable.has(word));

console.log(`Raw entries:        ${rawEntries.length}`);
console.log(`Playable words:     ${playable.size}`);
console.log(`Rejected/filtered:  ${rawEntries.length - playable.size}`);
console.log(`Unformable Q words: ${unplayableQWords.length}`);

if (sensitive.length > 0) {
  console.log(`WATCHLIST:          ${sensitive.join(', ')} (pass the current denylist)`);
} else {
  console.log('WATCHLIST:          none');
}

console.log('PASS: data/dict_en_v17.txt loads through the Boggle pipeline.');
