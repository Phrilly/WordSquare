// Cross-check harness: prints the layout produced by the browser algorithm for
// a range of daily seeds. The PHP harness prints the same list and the two
// outputs are compared byte for byte.

function seededHash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ (str.charCodeAt(i)), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fisherYatesShuffle(items, rnd) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const swapIndex = Math.floor(rnd() * (i + 1));
        const temporary = result[i];
        result[i] = result[swapIndex];
        result[swapIndex] = temporary;
    }
    return result;
}

function isValidScrabbleSquarePosition(idx, existing) {
    const row = Math.floor(idx / 5);
    const col = idx % 5;

    for (const existingIdx of existing) {
        const existingRow = Math.floor(existingIdx / 5);
        const existingCol = existingIdx % 5;
        if (Math.abs(col - existingCol) < 2 && Math.abs(row - existingRow) < 2) {
            return false;
        }
    }

    return true;
}

function makeDailyRandom(seed, suffix) {
  return mulberry32(seededHash(String(seed) + ':' + suffix));
}

function generateScrabbleSquaresFromSeed(seed) {
    const rnd = makeDailyRandom(seed, 'scrabble-dl');
    const allIndices = Array.from({length: 25}, (_, i) => i);
    const defaultLayout = { dl: [5, 9, 15, 19], dw: [] };

    const useDW = rnd() < 0.5;
    const targetDLCount = useDW ? 2 : 4;
    const maxAttempts = 1000;

    const dlIndices = [];
    const dwIndices = [];
    let attempts = 0;

    while (dlIndices.length < targetDLCount && attempts < maxAttempts) {
        const shuffled = fisherYatesShuffle(allIndices, rnd);
        for (const idx of shuffled) {
            if (isValidScrabbleSquarePosition(idx, dlIndices)) {
                dlIndices.push(idx);
                if (dlIndices.length === targetDLCount) break;
            }
        }
        if (dlIndices.length < targetDLCount) {
            dlIndices.length = 0;
            attempts++;
        }
    }

    if (useDW && dlIndices.length === targetDLCount) {
        const combinedSquares = [...dlIndices];
        let dwFound = false;
        attempts = 0;

        while (!dwFound && attempts < maxAttempts) {
            const shuffled = fisherYatesShuffle(allIndices, rnd);
            for (const idx of shuffled) {
                if (isValidScrabbleSquarePosition(idx, combinedSquares)) {
                    dwIndices.push(idx);
                    dwFound = true;
                    break;
                }
            }
            if (!dwFound) {
                attempts++;
            }
        }

        if (!dwFound) {
            while (dlIndices.length < 4 && attempts < maxAttempts) {
                const shuffled = fisherYatesShuffle(allIndices, rnd);
                for (const idx of shuffled) {
                    if (isValidScrabbleSquarePosition(idx, dlIndices)) {
                        dlIndices.push(idx);
                        if (dlIndices.length === 4) break;
                    }
                }
                if (dlIndices.length < 4) {
                    attempts++;
                }
            }
        }
    }

    if (dlIndices.length < targetDLCount || (useDW && dwIndices.length === 0)) {
        return defaultLayout;
    }

    return {
        dl: dlIndices.sort((a, b) => a - b),
        dw: dwIndices.sort((a, b) => a - b)
    };
}

const output = [];
for (let seed = 1; seed <= 200; seed++) {
    const layout = generateScrabbleSquaresFromSeed(seed);
    output.push(seed + '|' + layout.dl.join(',') + '|' + layout.dw.join(','));
}
console.log(output.join('\n'));
