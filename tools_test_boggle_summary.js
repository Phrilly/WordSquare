// Run with: node tools_test_boggle_summary.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'js', 'boggle.js'), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('function totalWordCount() {');
const end = source.indexOf('\nasync function getYesterdaysDailyWinner()', start);
assert.ok(start !== -1 && end !== -1, 'Unable to find summary helpers');

async function run() {
  let response = { round_bests: [{ initials: 'AAA', score: 12, word_count: 7 }, null, { initials: 'BBB', score: 5, word_count: null }] };
  let request;
  const errors = [];
  const context = {
    state: { roundWords: [['TEST'], [], ['TEST', 'WORDS']] },
    BOGGLE_ROUNDS: 3,
    BOGGLE_VARIANT: { id: 'sloggle' },
    console: { error: (...args) => errors.push(args) },
    fetch: async (url, options) => {
      request = { url, body: JSON.parse(options.body) };
      return { ok: true, json: async () => response };
    }
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);

  assert.equal(context.totalWordCount(), 3, 'Count words in each round, including repeats across rounds');
  const target = {};
  await context.showRoundBest(1, target);
  assert.equal(target.textContent, 'Best round: AAA, 12 from 7 words');
  assert.equal(request.body.variant, 'sloggle');
  assert.equal(request.body.action, 'get_boggle_round_bests');

  await context.showRoundBest(2, target);
  assert.equal(target.textContent, 'Best round: no saved scores yet.');
  await context.showRoundBest(3, target);
  assert.equal(target.textContent, 'Best round: BBB, 5 (word count unavailable)');

  response = { round_bests: [{ initials: 'ONE', score: 1, word_count: 1 }, null, null] };
  await context.showRoundBest(1, target);
  assert.equal(target.textContent, 'Best round: ONE, 1 from 1 word');

  response = { round_bests: [] };
  await context.showRoundBest(1, target);
  assert.equal(target.textContent, 'Best round unavailable.');
  assert.equal(errors.length, 1, 'Invalid responses must be logged');
  console.log('Boggle summary tests passed.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
