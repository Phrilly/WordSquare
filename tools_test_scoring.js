// Exercise the live Scrabble scorer and compare its output with the PHP fixtures.
const fs = require('fs');
const vm = require('vm');

const dictionary = new Set([
    'HELLO', 'WORLD', 'QUIET', 'PANEL', 'START', 'PARTS', 'STRAP',
    'PAR', 'PART',
    'HEL', 'ELL', 'HELL', 'WOR', 'WORD', 'ORLD', 'QUI', 'UIE',
    'PAN', 'PANE', 'ANEL', 'STA', 'TAR', 'ART', 'STAR', 'TART',
]);

const cases = [
    ['plain', 'HELLOWORLDQUIETPANELSTART', [], []],
    ['double-letter', 'HELLOWORLDQUIETPANELSTART', [0], []],
    ['double-word', 'HELLOWORLDQUIETPANELSTART', [], [1]],
    ['wildcard', 'hELLOWORLDQUIETPANELSTART', [], []],
    ['reverse-pair', 'PARTSZZZZZZZZZZZZZZZSTRAP', [], []],
    ['reverse-pair-dl', 'PARTSZZZZZZZZZZZZZZZSTRAP', [0], []],
    ['same-word-twice', 'STARTTZZZZAZZZZRZZZZTZZZZ', [], []],
    ['dl-and-dw', 'HELLOWORLDQUIETPANELSTART', [0, 1], [2]],
    ['overlap', 'PARTS--------------------', [], []],
    ['overlap-dl', 'PARTS--------------------', [0], []],
    ['overlap-dw', 'PARTS--------------------', [], [1]],
    ['overlap-wildcard', 'pARTS--------------------', [], []],
    ['short-three', 'PAR----------------------', [], []],
    ['short-four', 'PART---------------------', [], []],
    ['invalid-extension', 'PARTZ--------------------', [], []],
    ['separate-path', 'PARTS-----PART-----------', [], []],
    ['crossing-path', 'PARTS-R----T-------------', [], []],
    ['legacy', 'PARTS--------------------', [], [], false],
    ['restored-three', 'PAR----------------------', [], [], false],
    ['restored-four', 'PART---------------------', [], [], false],
    ['restored-crossing', 'PARTS-R----T-------------', [], [], false],
    ['restored-dl-dw', 'PARTS--------------------', [0], [1], false],
    ['restored-wildcard', 'pARTS--------------------', [0], [1], false]
];

const handlers = {};
const context = {
    document: { addEventListener: (name, callback) => { handlers[name] = callback; } },
    window: { GAME_CONFIG: { isScrabbleDay: true, scrabbleShortWordsEnabled: true } },
    gameDictionary: dictionary,
    cells: [],
    wildcardState: [],
    currentScore: 0,
    scoreEl: null,
    gridEl: null,
    explodedWords: new Set(),
    buildGroupedWordData: words => ({ display: { 3: [], 4: [], 5: [] }, rawScoringWords: words }),
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/gameplay-scrabble.js', 'utf8'), context);

for (const [label, grid, dl, dw, includeShortWords = true] of cases) {
    context.window.GAME_CONFIG.scrabbleShortWordsEnabled = includeShortWords;
    context.cells = Array.from(grid, char => /^[a-z]$/i.test(char) ? char.toUpperCase() : '');
    context.wildcardState = Array.from(grid, char => /^[a-z]$/.test(char));
    context.dl = dl;
    context.dw = dw;
    vm.runInContext('SPECIAL_SQUARES = { dl, dw };', context);
    let prevented = false;
    handlers['ws:calculateScore']({ preventDefault: () => { prevented = true; } });
    if (!prevented) throw new Error('Scrabble scorer did not handle ' + label);
    const events = vm.runInContext('scrabbleScoreEvents', context);
    console.log(label + '|' + context.currentScore + '|' + events.map(event => event.word + ':' + event.points).join(';'));
}

for (const enabled of [false, true]) {
    context.window.GAME_CONFIG.scrabbleShortWordsEnabled = enabled;
    let prevented = false;
    const classes = [];
    handlers['ws:applyHover']({
        preventDefault: () => { prevented = true; },
        detail: {
            index: 2,
            previewCells: Array.from('PAR----------------------', char => char === '-' ? '' : char),
            cellEl: { classList: { add: name => classes.push(name) } }
        }
    });
    if (!prevented || classes.join(',') !== (enabled ? 'hover-3' : '')) {
        throw new Error('Incorrect short-word hover behavior for enabled=' + enabled);
    }
}

context.window.GAME_CONFIG.scrabbleShortWordsEnabled = true;
const classes = Array.from({ length: 25 }, () => new Set());
context.previewClasses = classes;
context.testContainer = {
    querySelectorAll: () => classes.map(set => ({
        classList: {
            add: name => set.add(name),
            remove: (...names) => names.forEach(name => set.delete(name))
        }
    }))
};
context.testCells = Array.from('PARTS-R----T-------------', char => char === '-' ? '' : char);
vm.runInContext('applyColorsToScrabblePaths(findScrabbleScoringPaths(testCells, true), testContainer)', context);
if (![0, 1, 2, 3, 4].every(index => classes[index].has('word-5'))
    || ![6, 11].every(index => classes[index].has('word-3'))
    || classes[5].size !== 0) {
    throw new Error('Scrabble highlighting did not preserve the crossing scoring path.');
}

const hoverClasses = [];
handlers['ws:applyHover']({
    preventDefault: () => {},
    detail: {
        index: 4,
        previewCells: Array.from('PARTS--------------------', char => char === '-' ? '' : char),
        cellEl: { classList: { add: name => hoverClasses.push(name) } }
    }
});
if (hoverClasses.join(',') !== 'hover-5') {
    throw new Error('Scrabble hover did not preview the longer scoring word.');
}
