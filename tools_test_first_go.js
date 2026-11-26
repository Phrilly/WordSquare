'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const window = {
  get localStorage() {
    throw new Error('First-submission markers must not access browser storage.');
  }
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'js', 'first-go.js'), 'utf8'), { window });

const markers = window.WSFirstGo.markersFor([
  { first_go: false },
  { first_go: true },
  { first_go: true },
  { first_go: false }
]);
assert.deepEqual(Array.from(markers), ['', '\uD83C\uDFC6', '1\uFE0F\u20E3', '']);
console.log('First submission marker tests passed.');
