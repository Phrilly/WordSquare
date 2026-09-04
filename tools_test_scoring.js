// Scoring harness: mirrors the live ws:calculateScore handler in
// js/gameplay-scrabble.js and prints "label|score|word:points;..." so it can be
// diffed against the shared PHP scorer.

const SCRABBLE_VALUES = {
    A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
    N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
};

const dictionary = new Set([
    // 5-letter words that should score
    'HELLO', 'WORLD', 'QUIET', 'PANEL', 'START', 'PARTS', 'STRAP',
    // 3- and 4-letter words that must never score in Scrabble
    'HEL', 'ELL', 'HELL', 'WOR', 'WORD', 'ORLD', 'QUI', 'UIE',
    'PAN', 'PANE', 'ANEL', 'STA', 'TAR', 'ART', 'STAR', 'TART',
]);

const cases = [
    ['plain', 'HELLOWORLDQUIETPANELSTART', [], []],
    ['double-letter', 'HELLOWORLDQUIETPANELSTART', [0], []],
    ['double-word', 'HELLOWORLDQUIETPANELSTART', [], [1]],
    ['wildcard', 'hELLOWORLDQUIETPANELSTART', [], []],
    ['reverse-pair', 'PARTSZZZZZZZZZZZZZZZSTRAP', [], []],
    ['same-word-twice', 'STARTTZZZZAZZZZRZZZZTZZZZ', [], []],
    ['dl-and-dw', 'HELLOWORLDQUIETPANELSTART', [0, 1], [2]]
];

const lines = [];

for (const [label, gridString, dl, dw] of cases) {
    const cells = [];
    const wildcardState = [];

    for (const rawChar of gridString) {
        if (/^[A-Z]$/.test(rawChar)) {
            cells.push(rawChar);
            wildcardState.push(false);
        } else if (/^[a-z]$/.test(rawChar)) {
            cells.push(rawChar.toUpperCase());
            wildcardState.push(true);
        } else {
            cells.push('');
            wildcardState.push(false);
        }
    }

    const SPECIAL_SQUARES = { dl: dl, dw: dw };
    let foundPaths = [];
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [-1, 1], [1, -1]];

    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            for (const [dr, dc] of dirs) {
                let path = [];
                let word = '';
                for (let step = 0; step < 5; step++) {
                    const nr = r + (dr * step);
                    const nc = c + (dc * step);
                    if (nr < 0 || nr >= 5 || nc < 0 || nc >= 5) break;

                    const idx = nr * 5 + nc;
                    const letter = cells[idx];
                    if (!letter) break;

                    path.push(idx);
                    word += letter;

                    // STRICT 5-LETTER QUALIFICATION
                    if (word.length === 5 && dictionary.has(word)) {
                        foundPaths.push({ word: word, path: [...path] });
                    }
                }
            }
        }
    }

    let bestScoreForWord = {};

    foundPaths.forEach(item => {
        const rev = item.word.split('').reverse().join('');
        const key = item.word < rev ? item.word : rev;

        let pathScore = 0;
        let hasDW = false;

        item.path.forEach(idx => {
            const letter = cells[idx].toUpperCase();
            const isWildcardTile = wildcardState[idx];
            let val = isWildcardTile ? 0 : (SCRABBLE_VALUES[letter] || 0);
            if (!isWildcardTile && SPECIAL_SQUARES.dl.includes(idx)) {
                val *= 2;
            }
            pathScore += val;

            if (SPECIAL_SQUARES.dw.includes(idx)) {
                hasDW = true;
            }
        });

        if (hasDW) {
            pathScore *= 2;
        }

        if (!bestScoreForWord[key] || pathScore > bestScoreForWord[key].score) {
            bestScoreForWord[key] = { score: pathScore, word: item.word };
        }
    });

    let currentScore = 0;
    Object.values(bestScoreForWord).forEach(entry => { currentScore += entry.score; });

    const events = Object.values(bestScoreForWord).map(entry => ({
        word: entry.word,
        points: entry.score
    }));

    lines.push(label + '|' + currentScore + '|' + events.map(e => e.word + ':' + e.points).join(';'));
}

console.log(lines.join('\n'));
