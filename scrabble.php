<?php
declare(strict_types=1);

// ============================================================================
// SCRABBLE SHARED RULES LIBRARY
// ============================================================================
// This file is intentionally free of side effects (no headers, no output, no
// database access) so it can be included by both index.php (to publish the
// daily board layout) and validate.php (to score submissions).
//
// The functions below are the server-side mirror of js/gameplay-scrabble.js.
// Both implementations consume the same seed and use the same algorithm so the
// layout rendered in the browser is always the layout the server scores with.
// ============================================================================

/**
 * Emulate JavaScript's Math.imul (signed 32-bit integer multiplication).
 *
 * The operands are split into 16-bit halves so the intermediate products stay
 * inside PHP's 64-bit integer range on every platform.
 */
function scrabbleImul(int $a, int $b): int
{
    $a = $a & 0xFFFFFFFF;
    $b = $b & 0xFFFFFFFF;

    $aLow = $a & 0xFFFF;
    $aHigh = $a >> 16;
    $bLow = $b & 0xFFFF;
    $bHigh = $b >> 16;

    $low = $aLow * $bLow;
    $high = ($aHigh * $bLow) + ($aLow * $bHigh);

    return ($low + (($high & 0xFFFF) << 16)) & 0xFFFFFFFF;
}

/**
 * Port of the seededHash() helper in js/gameplay-scrabble.js.
 */
function scrabbleSeededHash(string $value): int
{
    $length = strlen($value);
    $hash = 1779033703 ^ $length;

    for ($i = 0; $i < $length; $i++) {
        $hash = scrabbleImul($hash ^ ord($value[$i]), 3432918353);
        $hash = (($hash << 13) | (($hash >> 19) & 0x1FFF)) & 0xFFFFFFFF;
    }

    return $hash & 0xFFFFFFFF;
}

/**
 * Port of the mulberry32() PRNG in js/gameplay-scrabble.js.
 *
 * @return Closure(): float
 */
function scrabbleMulberry32(int $seed): Closure
{
    $state = $seed & 0xFFFFFFFF;

    return function () use (&$state): float {
        $state = ($state + 0x6D2B79F5) & 0xFFFFFFFF;

        $t = $state;
        $t = scrabbleImul($t ^ ($t >> 15), $t | 1);
        $t = $t ^ (($t + scrabbleImul($t ^ ($t >> 7), $t | 61)) & 0xFFFFFFFF);

        return (($t ^ ($t >> 14)) & 0xFFFFFFFF) / 4294967296;
    };
}

/**
 * Reproduce the UTC daily seed produced by getDailySeed() in js/utils.js.
 */
function scrabbleDailySeed(?DateTimeImmutable $date = null, int $dailyOffset = 0): int
{
    if ($date === null) {
        $date = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    }

    $utc = $date->setTimezone(new DateTimeZone('UTC'));
    $dateString = $utc->format('Y') . '-' . (string)(int)$utc->format('n') . '-' . (string)(int)$utc->format('j');

    $sum = 0;
    $length = strlen($dateString);

    for ($i = 0; $i < $length; $i++) {
        $sum += ord($dateString[$i]) * ($i + 1);
    }

    return ($sum + $dailyOffset) * 12345;
}

/**
 * Standard Scrabble letter values.
 *
 * @return array<string, int>
 */
function scrabbleLetterValues(): array
{
    return [
        'A' => 1, 'B' => 3, 'C' => 3, 'D' => 2, 'E' => 1, 'F' => 4, 'G' => 2,
        'H' => 4, 'I' => 1, 'J' => 8, 'K' => 5, 'L' => 1, 'M' => 3, 'N' => 1,
        'O' => 1, 'P' => 3, 'Q' => 10, 'R' => 1, 'S' => 1, 'T' => 1, 'U' => 1,
        'V' => 4, 'W' => 4, 'X' => 8, 'Y' => 4, 'Z' => 10,
    ];
}

/**
 * Fisher-Yates shuffle driven by an injectable RNG so that PHP and JavaScript
 * consume exactly the same number of random values in the same order.
 *
 * @param list<int> $items
 * @param Closure(): float $rnd
 * @return list<int>
 */
function scrabbleShuffleWithRng(array $items, Closure $rnd): array
{
    for ($i = count($items) - 1; $i > 0; $i--) {
        $swapIndex = (int) floor($rnd() * ($i + 1));
        if ($swapIndex > $i) {
            $swapIndex = $i;
        }
        if ($swapIndex < 0) {
            $swapIndex = 0;
        }

        $temporary = $items[$i];
        $items[$i] = $items[$swapIndex];
        $items[$swapIndex] = $temporary;
    }

    return $items;
}

/**
 * True when a candidate square is not adjacent (including diagonally) to any
 * square already placed.
 *
 * @param list<int> $existing
 */
function scrabbleIsValidSquarePosition(int $index, array $existing): bool
{
    $row = intdiv($index, 5);
    $col = $index % 5;

    foreach ($existing as $existingIndex) {
        $existingRow = intdiv((int)$existingIndex, 5);
        $existingCol = (int)$existingIndex % 5;

        if (abs($col - $existingCol) < 2 && abs($row - $existingRow) < 2) {
            return false;
        }
    }

    return true;
}

/**
 * Build the authoritative daily double-letter / double-word layout.
 *
 * The layout is derived from the UTC daily seed only. It is never taken from
 * the request, so a client cannot award itself extra multipliers.
 *
 * @return array{dl: list<int>, dw: list<int>}
 */
function generateScrabbleSpecialSquares(int $seed): array
{
    $defaultLayout = ['dl' => [5, 9, 15, 19], 'dw' => []];

    $rnd = scrabbleMulberry32(scrabbleSeededHash($seed . ':scrabble-dl'));
    $allIndices = range(0, 24);

    $useDoubleWord = $rnd() < 0.5;
    $targetDoubleLetterCount = $useDoubleWord ? 2 : 4;
    $maxAttempts = 1000;

    $doubleLetter = [];
    $doubleWord = [];
    $attempts = 0;

    while (count($doubleLetter) < $targetDoubleLetterCount && $attempts < $maxAttempts) {
        $shuffled = scrabbleShuffleWithRng($allIndices, $rnd);

        foreach ($shuffled as $index) {
            if (scrabbleIsValidSquarePosition((int)$index, $doubleLetter)) {
                $doubleLetter[] = (int)$index;
                if (count($doubleLetter) === $targetDoubleLetterCount) {
                    break;
                }
            }
        }

        if (count($doubleLetter) < $targetDoubleLetterCount) {
            $doubleLetter = [];
            $attempts++;
        }
    }

    if ($useDoubleWord && count($doubleLetter) === $targetDoubleLetterCount) {
        $combined = $doubleLetter;
        $doubleWordFound = false;
        $attempts = 0;

        while (!$doubleWordFound && $attempts < $maxAttempts) {
            $shuffled = scrabbleShuffleWithRng($allIndices, $rnd);

            foreach ($shuffled as $index) {
                if (scrabbleIsValidSquarePosition((int)$index, $combined)) {
                    $doubleWord[] = (int)$index;
                    $doubleWordFound = true;
                    break;
                }
            }

            if (!$doubleWordFound) {
                $attempts++;
            }
        }

        // No legal double-word position: fall back to four double-letter squares.
        if (!$doubleWordFound) {
            while (count($doubleLetter) < 4 && $attempts < $maxAttempts) {
                $shuffled = scrabbleShuffleWithRng($allIndices, $rnd);

                foreach ($shuffled as $index) {
                    if (scrabbleIsValidSquarePosition((int)$index, $doubleLetter)) {
                        $doubleLetter[] = (int)$index;
                        if (count($doubleLetter) === 4) {
                            break;
                        }
                    }
                }

                if (count($doubleLetter) < 4) {
                    $attempts++;
                }
            }
        }
    }

    if (count($doubleLetter) < $targetDoubleLetterCount) {
        return $defaultLayout;
    }

    if ($useDoubleWord && count($doubleWord) === 0) {
        return $defaultLayout;
    }

    sort($doubleLetter);
    sort($doubleWord);

    return [
        'dl' => array_values($doubleLetter),
        'dw' => array_values($doubleWord),
    ];
}

/**
 * Split a 25 character grid into letter + wildcard cells.
 *
 * An uppercase letter is a normal tile, a lowercase letter is a wildcard tile
 * that has been assigned a letter, and '-' is an empty square.
 *
 * @return list<array{letter: string, is_wildcard: bool}>
 */
function scrabbleParseGridWithWildcards(string $gridString): array
{
    $rawCells = str_split(trim($gridString));
    $cells = [];

    foreach ($rawCells as $cell) {
        if (preg_match('/^[A-Z]$/', $cell) === 1) {
            $cells[] = ['letter' => $cell, 'is_wildcard' => false];
            continue;
        }
        if (preg_match('/^[a-z]$/', $cell) === 1) {
            $cells[] = ['letter' => strtoupper($cell), 'is_wildcard' => true];
            continue;
        }
        $cells[] = ['letter' => '', 'is_wildcard' => false];
    }

    return $cells;
}

/**
 * Score a Scrabble grid against an injectable dictionary checker.
 *
 * This is the single, shared implementation of the Scrabble rules. It is pure
 * (no database, no globals) so validate.php can drive it from the dictionary
 * table and the test harness can drive it from an in-memory list.
 *
 * Rules enforced here:
 *   - only five-letter words score (3 and 4 letter words are ignored);
 *   - wildcard tiles contribute 0 points;
 *   - a double-letter square doubles that one letter;
 *   - a double-word square doubles the finished word;
 *   - a word and its reverse are one entry, scored once at their best path.
 *
 * @param Closure(list<string>): list<string> $resolveValidWords
 * @param list<int> $dlIndices
 * @param list<int> $dwIndices
 * @return array{score: int, events: list<array{word: string, points: int}>}
 */
function calculateScrabbleScoreWithResolver(string $gridString, Closure $resolveValidWords, array $dlIndices = [], array $dwIndices = []): array
{
    $cells = scrabbleParseGridWithWildcards($gridString);
    $emptyResult = ['score' => 0, 'events' => []];

    if (count($cells) !== 25) {
        return $emptyResult;
    }

    $gridSize = 5;
    $letterValues = scrabbleLetterValues();
    $directions = [
        [0, 1], [0, -1], [1, 0], [-1, 0],
        [1, 1], [-1, -1], [-1, 1], [1, -1],
    ];

    $foundPaths = [];
    $candidateWords = [];

    for ($row = 0; $row < $gridSize; $row++) {
        for ($col = 0; $col < $gridSize; $col++) {
            foreach ($directions as $direction) {
                $path = [];
                $word = '';

                for ($step = 0; $step < $gridSize; $step++) {
                    $nextRow = $row + ($direction[0] * $step);
                    $nextCol = $col + ($direction[1] * $step);

                    if ($nextRow < 0 || $nextRow >= $gridSize || $nextCol < 0 || $nextCol >= $gridSize) {
                        break;
                    }

                    $index = ($nextRow * $gridSize) + $nextCol;
                    $letter = (string)($cells[$index]['letter'] ?? '');

                    if ($letter === '') {
                        break;
                    }

                    $path[] = $index;
                    $word .= $letter;

                    // STRICT 5-LETTER QUALIFICATION
                    if (strlen($word) === 5) {
                        $candidateWords[] = $word;
                        $foundPaths[] = ['word' => $word, 'path' => $path];
                    }
                }
            }
        }
    }

    if ($candidateWords === []) {
        return $emptyResult;
    }

    $resolvedWords = $resolveValidWords(array_values(array_unique($candidateWords)));
    if (!is_array($resolvedWords)) {
        return $emptyResult;
    }

    $validWords = [];
    foreach ($resolvedWords as $resolvedWord) {
        if (is_string($resolvedWord) && $resolvedWord !== '') {
            $validWords[strtoupper($resolvedWord)] = true;
        }
    }

    if ($validWords === []) {
        return $emptyResult;
    }

    $bestScoreForWord = [];

    foreach ($foundPaths as $item) {
        if (!isset($validWords[$item['word']])) {
            continue;
        }

        $reversed = strrev($item['word']);
        $key = strcmp($item['word'], $reversed) < 0 ? $item['word'] : $reversed;

        $pathScore = 0;
        $hasDoubleWord = false;

        foreach ($item['path'] as $index) {
            $cell = $cells[$index] ?? ['letter' => '', 'is_wildcard' => false];
            $letter = (string)($cell['letter'] ?? '');
            $isWildcard = (bool)($cell['is_wildcard'] ?? false);

            $value = $isWildcard ? 0 : ($letterValues[$letter] ?? 0);
            if (!$isWildcard && in_array($index, $dlIndices, true)) {
                $value *= 2;
            }
            $pathScore += $value;

            if (in_array($index, $dwIndices, true)) {
                $hasDoubleWord = true;
            }
        }

        if ($hasDoubleWord) {
            $pathScore *= 2;
        }

        // The key only de-duplicates a word against its reverse; the word that
        // gets reported is the orientation that actually scored, so the
        // breakdown never shows a mirror spelling that is not a real word.
        if (!isset($bestScoreForWord[$key]) || $pathScore > $bestScoreForWord[$key]['score']) {
            $bestScoreForWord[$key] = ['score' => $pathScore, 'word' => $item['word']];
        }
    }

    $events = [];
    $total = 0;

    foreach ($bestScoreForWord as $entry) {
        $events[] = ['word' => (string)$entry['word'], 'points' => (int)$entry['score']];
        $total += (int) $entry['score'];
    }

    return [
        'score' => $total,
        'events' => $events,
    ];
}
