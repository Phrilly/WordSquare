<?php
declare(strict_types=1);

// Scoring harness: runs the shared Scrabble scorer over fixture grids and prints
// "label|score|word:points;..." so the JavaScript harness can be diffed against it.

require_once __DIR__ . '/scrabble.php';

$dictionary = [
    // 5-letter words that should score
    'HELLO', 'WORLD', 'QUIET', 'PANEL', 'START', 'PARTS', 'STRAP',
    // 3- and 4-letter words that must never score in Scrabble
    'HEL', 'ELL', 'HELL', 'WOR', 'WORD', 'ORLD', 'QUI', 'UIE',
    'PAN', 'PANE', 'ANEL', 'STA', 'TAR', 'ART', 'STAR', 'TART',
];

$dictionaryLookup = array_fill_keys($dictionary, true);

$resolve = static function (array $candidates) use ($dictionaryLookup): array {
    $valid = [];
    foreach ($candidates as $candidate) {
        if (isset($dictionaryLookup[$candidate])) {
            $valid[] = $candidate;
        }
    }
    return $valid;
};

$cases = [
    ['plain', 'HELLOWORLDQUIETPANELSTART', [], []],
    ['double-letter', 'HELLOWORLDQUIETPANELSTART', [0], []],
    ['double-word', 'HELLOWORLDQUIETPANELSTART', [], [1]],
    ['wildcard', 'hELLOWORLDQUIETPANELSTART', [], []],
    ['reverse-pair', 'PARTSZZZZZZZZZZZZZZZSTRAP', [], []],
    ['same-word-twice', 'STARTTZZZZAZZZZRZZZZTZZZZ', [], []],
    ['dl-and-dw', 'HELLOWORLDQUIETPANELSTART', [0, 1], [2]],
];

$lines = [];
foreach ($cases as [$label, $grid, $dl, $dw]) {
    $result = calculateScrabbleScoreWithResolver($grid, $resolve, $dl, $dw);

    $parts = [];
    foreach ($result['events'] as $event) {
        $parts[] = $event['word'] . ':' . $event['points'];
    }

    $lines[] = $label . '|' . $result['score'] . '|' . implode(';', $parts);
}

echo implode("\n", $lines) . "\n";
