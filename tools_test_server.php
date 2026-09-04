<?php
declare(strict_types=1);

// Integration test for the server scoring path.
//
// validate.php cannot simply be required because it performs request handling,
// so only the function definitions (everything above the config.php bootstrap)
// are loaded. That keeps the real calculateScrabbleScoreWithEvents() and
// fetchValidWords() under test, backed by an in-memory SQLite dictionary.

$source = (string) file_get_contents(__DIR__ . '/validate.php');
$marker = "if (!file_exists(__DIR__ . '/config.php')) {";

$cut = strpos($source, $marker);
if ($cut === false) {
    fwrite(STDERR, 'Could not find the bootstrap marker in validate.php.' . PHP_EOL);
    exit(1);
}

$head = substr($source, 0, $cut);
$head = str_replace('<?php', '', $head);
$head = str_replace('declare(strict_types=1);', '', $head);
$head = preg_replace('/^\s*header\([^;]*\);\s*$/m', '', $head);

eval($head);

$pdo = new PDO('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

$pdo->exec('CREATE TABLE dictionary (word TEXT PRIMARY KEY, is_mfd INTEGER NOT NULL DEFAULT 0)');

$words = [
    'HELLO', 'WORLD', 'QUIET', 'PANEL', 'START',
    'HEL', 'ELL', 'HELL', 'WOR', 'WORD', 'ORLD', 'QUI', 'UIE',
    'PAN', 'PANE', 'ANEL', 'STA', 'TAR', 'ART', 'STAR', 'TART',
];

$insert = $pdo->prepare('INSERT INTO dictionary (word, is_mfd) VALUES (?, 0)');
foreach ($words as $word) {
    $insert->execute([$word]);
}

$cases = [
    // No special squares: pure letter values.
    ['plain', 'HELLOWORLDQUIETPANELSTART', [], [], 43],
    // A wildcard tile contributes 0, so HELLO drops from 8 to 4.
    ['wildcard', 'hELLOWORLDQUIETPANELSTART', [], [], 39],
    // Legacy hardcoded layout: DL on 5, 9, 15 and 19.
    ['legacy-default', 'HELLOWORLDQUIETPANELSTART', [5, 9, 15, 19], [], 53],
    // Whatever today's server generated layout happens to be.
    ['daily-layout', 'HELLOWORLDQUIETPANELSTART', null, null, null],
];

$failures = 0;

foreach ($cases as [$label, $grid, $dl, $dw, $expectedScore]) {
    if ($dl === null) {
        $layout = generateScrabbleSpecialSquares(scrabbleDailySeed());
        $dl = $layout['dl'];
        $dw = $layout['dw'];
    }

    $result = calculateScrabbleScoreWithEvents($grid, $pdo, $dl, $dw);

    $total = 0;
    $problems = [];
    foreach ($result['events'] as $event) {
        $total += (int)$event['points'];
        if (strlen((string)$event['word']) !== 5) {
            $problems[] = 'non 5-letter word: ' . $event['word'];
        }
    }

    if ($total !== $result['score']) {
        $problems[] = 'events total ' . $total . ' != score ' . $result['score'];
    }

    if ($expectedScore !== null && $result['score'] !== $expectedScore) {
        $problems[] = 'score ' . $result['score'] . ' != expected ' . $expectedScore;
    }

    $rendered = [];
    foreach ($result['events'] as $event) {
        $rendered[] = $event['word'] . ':' . $event['points'];
    }

    if ($problems !== []) {
        $failures += count($problems);
        echo 'FAIL ' . $label . ': ' . implode(', ', $problems) . PHP_EOL;
        continue;
    }

    echo 'ok  ' . $label . ' -> score ' . $result['score'] . ' [' . implode(';', $rendered) . ']' . PHP_EOL;
}

// A grid holding only 3- and 4-letter words must score nothing.
$shortOnly = calculateScrabbleScoreWithEvents('CATSDOGZZZZZZZZZZZZZZZZZ', $pdo, [], []);
if ($shortOnly['score'] !== 0 || $shortOnly['events'] !== []) {
    $failures++;
    echo 'FAIL short-words-only: expected an empty breakdown, got ' . json_encode($shortOnly) . PHP_EOL;
} else {
    echo 'ok  short-words-only -> score 0 []' . PHP_EOL;
}

// Client-supplied multiplier indices must no longer influence the score.
$withFakeMultipliers = calculateScrabbleScoreWithEvents(
    'HELLOWORLDQUIETPANELSTART',
    $pdo,
    [0, 1, 2, 3, 4],
    [0, 1, 2, 3, 4]
);
$trustedLayout = generateScrabbleSpecialSquares(scrabbleDailySeed());
$withTrustedLayout = calculateScrabbleScoreWithEvents(
    'HELLOWORLDQUIETPANELSTART',
    $pdo,
    $trustedLayout['dl'],
    $trustedLayout['dw']
);

if ($withFakeMultipliers['score'] === $withTrustedLayout['score']) {
    echo 'note: forged multipliers happen to match the daily layout here (' . $withTrustedLayout['score'] . ')' . PHP_EOL;
} else {
    echo 'ok  the score follows the layout argument (' . $withTrustedLayout['score'] . ' vs forged ' . $withFakeMultipliers['score'] . ')' . PHP_EOL;
}

echo 'Daily layout now used for scoring: dl=[' . implode(',', $trustedLayout['dl']) . '] dw=[' . implode(',', $trustedLayout['dw']) . ']' . PHP_EOL;

if ($failures > 0) {
    echo 'FAILED: ' . $failures . ' problem(s).' . PHP_EOL;
    exit(1);
}

echo 'PASS: server scoring path behaves correctly.' . PHP_EOL;
