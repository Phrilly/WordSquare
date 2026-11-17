<?php
declare(strict_types=1);

// Scoring harness: runs the shared Scrabble scorer over fixture grids and prints
// "label|score|word:points;..." so the JavaScript harness can be diffed against it.

require_once __DIR__ . '/scrabble.php';

$dictionary = [
    'HELLO', 'WORLD', 'QUIET', 'PANEL', 'START', 'PARTS', 'STRAP',
    'PAR', 'PART',
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
];

$expected = [
    'overlap' => ['PARTS' => 7],
    'reverse-pair-dl' => ['PARTS' => 10],
    'overlap-dl' => ['PARTS' => 10],
    'overlap-dw' => ['PARTS' => 14],
    'overlap-wildcard' => ['PARTS' => 4],
    'short-three' => ['PAR' => 5],
    'short-four' => ['PART' => 6],
    'invalid-extension' => ['PART' => 6],
    'separate-path' => ['PARTS' => 7, 'PART' => 6],
    'crossing-path' => ['PARTS' => 7, 'ART' => 3],
    'legacy' => ['PARTS' => 7],
];

$utc = new DateTimeZone('UTC');
if (scrabbleShortWordsEnabled(new DateTimeImmutable('2026-11-18 23:59:59', $utc))
    || !scrabbleShortWordsEnabled(new DateTimeImmutable('2026-11-19 00:00:00', $utc))) {
    throw new RuntimeException('Scrabble rollout boundary is incorrect.');
}
if (scrabbleScoringChangeNoticeEnabled(new DateTimeImmutable('2026-11-18 23:59:59', $utc))
    || !scrabbleScoringChangeNoticeEnabled(new DateTimeImmutable('2026-11-19 00:00:00', $utc))
    || !scrabbleScoringChangeNoticeEnabled(new DateTimeImmutable('2026-11-19 23:59:59', $utc))
    || scrabbleScoringChangeNoticeEnabled(new DateTimeImmutable('2026-11-20 00:00:00', $utc))) {
    throw new RuntimeException('Scrabble notice dates are incorrect.');
}

$lines = [];
foreach ($cases as $case) {
    [$label, $grid, $dl, $dw] = $case;
    $result = calculateScrabbleScoreWithResolver($grid, $resolve, $dl, $dw, $case[4] ?? true);

    if (isset($expected[$label])) {
        $actual = [];
        foreach ($result['events'] as $event) {
            $actual[$event['word']] = $event['points'];
        }
        if ($actual !== $expected[$label] || $result['score'] !== array_sum($expected[$label])) {
            throw new RuntimeException('Unexpected scoring result for ' . $label . ': ' . json_encode($result));
        }
    }

    $parts = [];
    foreach ($result['events'] as $event) {
        $parts[] = $event['word'] . ':' . $event['points'];
    }

    $lines[] = $label . '|' . $result['score'] . '|' . implode(';', $parts);
}

echo implode("\n", $lines) . "\n";
