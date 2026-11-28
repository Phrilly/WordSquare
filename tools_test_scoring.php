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
    ['restored-three', 'PAR----------------------', [], [], false],
    ['restored-four', 'PART---------------------', [], [], false],
    ['restored-crossing', 'PARTS-R----T-------------', [], [], false],
    ['restored-dl-dw', 'PARTS--------------------', [0], [1], false],
    ['restored-wildcard', 'pARTS--------------------', [0], [1], false],
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
    'restored-three' => [],
    'restored-four' => [],
    'restored-crossing' => ['PARTS' => 7],
    'restored-dl-dw' => ['PARTS' => 20],
    'restored-wildcard' => ['PARTS' => 8],
];

$utc = new DateTimeZone('UTC');
if (scrabbleShortWordsEnabled(new DateTimeImmutable('2026-11-18 23:59:59', $utc))
    || !scrabbleShortWordsEnabled(new DateTimeImmutable('2026-11-19 00:00:00', $utc))
    || !scrabbleShortWordsEnabled(new DateTimeImmutable('2026-12-02 23:59:59', $utc))
    || scrabbleShortWordsEnabled(new DateTimeImmutable('2026-12-03 00:00:00', $utc))
    || scrabbleShortWordsEnabled(new DateTimeImmutable('2026-12-03 01:00:00+01:00'))) {
    throw new RuntimeException('Scrabble rollout boundary is incorrect.');
}
if (resolveScrabbleShortWordsEnabled(true, new DateTimeImmutable('2026-12-03 00:00:00', $utc))
    || !resolveScrabbleShortWordsEnabled(true, new DateTimeImmutable('2026-12-02 23:59:59', $utc))) {
    throw new RuntimeException('Scrabble debug override did not respect the restoration.');
}
if (scrabbleScoringChangeNoticeEnabled(new DateTimeImmutable('2026-12-02 23:59:59', $utc))
    || !scrabbleScoringChangeNoticeEnabled(new DateTimeImmutable('2026-12-03 00:00:00', $utc))
    || !scrabbleScoringChangeNoticeEnabled(new DateTimeImmutable('2026-12-03 23:59:59', $utc))
    || scrabbleScoringChangeNoticeEnabled(new DateTimeImmutable('2026-12-04 00:00:00', $utc))) {
    throw new RuntimeException('Scrabble notice dates are incorrect.');
}

$indexSource = file_get_contents(__DIR__ . '/index.php');
if ($indexSource === false) {
    throw new RuntimeException('Could not read the Scrabble opening notice.');
}
$noticeStart = strpos($indexSource, '<?php if ($isScrabbleDay && scrabbleScoringChangeNoticeEnabled($scrabbleDate)): ?>');
$noticeEnd = $noticeStart === false ? false : strpos($indexSource, '<?php endif; ?>', $noticeStart);
if ($noticeStart === false || $noticeEnd === false) {
    throw new RuntimeException('Could not locate the Scrabble opening notice.');
}
$noticeTemplate = substr($indexSource, $noticeStart, $noticeEnd - $noticeStart + strlen('<?php endif; ?>'));
$renderNotice = static function (DateTimeImmutable $scrabbleDate, bool $isScrabbleDay, bool $scrabbleDebugOverrideActive) use ($noticeTemplate): string {
    $scrabbleShortWordsEnabled = resolveScrabbleShortWordsEnabled($scrabbleDebugOverrideActive, $scrabbleDate);
    ob_start();
    eval('?>' . $noticeTemplate);
    $html = ob_get_clean();
    if ($html === false) {
        throw new RuntimeException('Could not render the Scrabble opening notice.');
    }
    return $html;
};
$firstDayNotice = $renderNotice(new DateTimeImmutable('2026-12-03 12:00:00', $utc), true, true);
if (!str_contains($firstDayNotice, 'SCRABBLE RULES REVISED')
    || !str_contains($firstDayNotice, 'Only 5-letter words score again')
    || str_contains($firstDayNotice, 'DEBUG PREVIEW')
    || trim($renderNotice(new DateTimeImmutable('2026-12-03 12:00:00', $utc), false, false)) !== ''
    || trim($renderNotice(new DateTimeImmutable('2026-12-04 00:00:00', $utc), true, true)) !== ''
    || trim($renderNotice(new DateTimeImmutable('2026-12-02 23:59:59', $utc), true, false)) !== '') {
    throw new RuntimeException('Scrabble opening notice is incorrect.');
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
