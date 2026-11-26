// Run with: node tools_test_boggle_touch.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'js', 'boggle.js'), 'utf8').replace(/\r\n/g, '\n');
const functionsStart = source.indexOf('function createTileButton(index) {');
const functionsEnd = source.indexOf('\nfunction render() {', functionsStart);
const eventsStart = source.indexOf("el.grid.addEventListener('pointerdown', event => {");
const eventsEnd = source.indexOf("el.grid.addEventListener('pointermove', event => {", eventsStart);
assert.ok(functionsStart !== -1 && functionsEnd !== -1 && eventsStart !== -1 && eventsEnd !== -1);

function createHarness() {
  class Element {
    constructor(index) {
      this.dataset = { index: String(index) };
      this.classes = new Set();
      this.listeners = {};
      this.classList = {
        add: name => this.classes.add(name),
        remove: name => this.classes.delete(name)
      };
    }
    closest(selector) { return selector === '.boggle-tile' ? this : null; }
    getBoundingClientRect() {
      const left = Number(this.dataset.index) * 104;
      return { left, right: left + 100, top: 0, bottom: 100 };
    }
    addEventListener(type, handler) { this.listeners[type] = handler; }
  }
  const buttons = Array.from({ length: 5 }, (_, index) => new Element(index));
  const listeners = {};
  const grid = Object.assign(new Element(-1), {
    querySelectorAll: () => buttons,
    addEventListener(type, listener) { listeners[type] = listener; },
    setPointerCapture() {}
  });
  const state = { locked: false, path: [], selectionComplete: false, selectionFeedback: null };
  const context = {
    Element, state, document: { createElement: () => new Element(0) },
    el: { grid, help: { hidden: true }, summary: { hidden: true } },
    touchSelections: [],
    clearRejectedSelection() {
      if (!state.selectionFeedback) return false;
      state.path = [];
      state.selectionFeedback = null;
      return true;
    },
    select(index) { state.path.push(index); },
    completeSelection() { state.selectionComplete = true; },
    submit() { state.submitted = [...state.path]; state.path = []; state.selectionComplete = false; }
  };
  vm.createContext(context);
  vm.runInContext(source.slice(functionsStart, functionsEnd) + source.slice(eventsStart, eventsEnd), context);
  buttons[0] = context.createTileButton(0);

  function event(pointerId, x, target = grid) {
    return { pointerType: 'touch', pointerId, clientX: x, clientY: 50, target, preventDefault() {} };
  }
  return {
    state, buttons,
    down(id, x, target = grid) { listeners.pointerdown(event(id, x, target)); },
    up(id, x) { listeners.pointerup(event(id, x)); },
    cancel(id, x) { listeners.pointercancel(event(id, x)); },
    lost(id, x) { listeners.lostpointercapture(event(id, x)); }
  };
}

{
  const test = createHarness();
  test.down(1, 50, test.buttons[0]);
  test.down(2, 154, test.buttons[1]);
  assert.ok(test.buttons[0].classes.has('is-touch-pressed'));
  assert.ok(test.buttons[1].classes.has('is-touch-pressed'));
  test.up(2, 154);
  assert.deepEqual(test.state.path, [], 'Wait for earlier touches to resolve');
  test.up(1, 50);
  assert.deepEqual(test.state.path, [0, 1], 'Overlapping taps preserve press order');
  assert.equal(test.buttons[0].classes.size + test.buttons[1].classes.size, 0);
}

{
  const test = createHarness();
  test.down(1, 50);
  test.down(2, 154);
  test.up(2, 154);
  test.cancel(1, 50);
  assert.deepEqual(test.state.path, [1], 'Cancellation must unblock later touches');
  test.down(3, 258);
  test.lost(3, 258);
  test.up(3, 258);
  assert.deepEqual(test.state.path, [1], 'Lost capture must not select');
}

{
  const test = createHarness();
  test.down(1, 101);
  test.up(1, 101);
  assert.deepEqual(test.state.path, [0], 'Taps in a gap select the nearest tile');
  test.down(2, 154, test.buttons[1]);
  test.up(2, 258);
  assert.deepEqual(test.state.path, [0], 'Release on a different tile cancels the tap');
}

{
  const test = createHarness();
  test.state.path.push(0, 1, 2, 3);
  test.state.selectionFeedback = 'invalid';
  test.down(1, 466, test.buttons[4]);
  test.up(1, 466);
  assert.deepEqual(test.state.path, [4], 'First tap after rejection starts a new word');
}

{
  const test = createHarness();
  test.state.path.push(0, 1, 2, 3);
  test.state.selectionComplete = true;
  test.down(1, 466, test.buttons[4]);
  test.up(1, 466);
  assert.deepEqual(test.state.submitted, [0, 1, 2, 3]);
  assert.deepEqual(test.state.path, [4], 'Next tap does not interrupt pending submission');
}

{
  const test = createHarness();
  test.buttons[0].listeners.click({ pointerType: 'touch', detail: 1 });
  assert.deepEqual(test.state.path, [], 'A touch-generated click must not select again');
  test.buttons[0].listeners.click({ detail: 0 });
  assert.deepEqual(test.state.path, [0], 'Keyboard activation still selects');
}

console.log('Boggle touch selection tests passed.');
