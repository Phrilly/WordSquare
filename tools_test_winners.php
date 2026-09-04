<?php
declare(strict_types=1);

// Integration test for the daily_scores winner helpers in validate.php.
// Uses SQLite tables + a UNION ALL view with the same common shape as the
// production MariaDB view.

$source = (string)file_get_contents(__DIR__ . '/validate.php');
$marker = "if (!file_exists(__DIR__ . '/config.php')) {";
$cut = strpos($source, $marker);

if ($cut === false) {
    fwrite(STDERR, 'Could not locate validate.php bootstrap.' . PHP_EOL);
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

$pdo->exec('CREATE TABLE highscores (id INTEGER PRIMARY KEY, initials TEXT, score INTEGER, mode TEXT, created_at TEXT)');
$pdo->exec('CREATE TABLE boggle_highscores (id INTEGER PRIMARY KEY, initials TEXT, score INTEGER, created_at TEXT)');
$pdo->exec("CREATE VIEW daily_scores AS
    SELECT id, initials, score, mode, created_at FROM highscores
    UNION ALL
    SELECT id, initials, score, 'boggle' AS mode, created_at FROM boggle_highscores");

$insertMain = $pdo->prepare('INSERT INTO highscores VALUES (?, ?, ?, ?, ?)');
$insertBoggle = $pdo->prepare('INSERT INTO boggle_highscores VALUES (?, ?, ?, ?)');

// A real Boggle day: earliest equal top score wins.
$insertBoggle->execute([1, 'TOM', 112, '2026-09-02 08:00:00']);
$insertBoggle->execute([2, 'PIP', 112, '2026-09-02 09:00:00']);

// A Bomb day polluted by a much larger direct-play Boggle score.
$insertMain->execute([10, 'NAO', 162, 'bomb', '2026-09-03 07:02:33']);
$insertMain->execute([11, 'PIP', 161, 'bomb', '2026-09-03 12:06:26']);
$insertBoggle->execute([3, 'BAD', 999, '2026-09-03 08:00:00']);

$failures = 0;

$assertWinner = static function (
    string $label,
    array $winner,
    ?string $initials,
    string $mode,
    ?int $score
) use (&$failures): void {
    $expected = ['initials' => $initials, 'mode' => $mode, 'score' => $score];
    if ($winner !== $expected) {
        $failures++;
        echo 'FAIL ' . $label . ': got ' . json_encode($winner) . ', expected ' . json_encode($expected) . PHP_EOL;
        return;
    }
    echo 'ok  ' . $label . ': ' . json_encode($winner) . PHP_EOL;
};

$assertWinner('Boggle source and tie-break', resolveDailyWinner($pdo, '2026-09-02', 'boggle'), 'TOM', 'boggle', 112);
$assertWinner('off-schedule Boggle excluded', resolveDailyWinner($pdo, '2026-09-03', 'bomb'), 'NAO', 'bomb', 162);
$assertWinner('no cross-mode fallback', resolveDailyWinner($pdo, '2026-09-03', 'classic'), null, 'classic', null);
$assertWinner('empty day', resolveDailyWinner($pdo, '2026-09-04', 'scrabble'), null, 'scrabble', null);

if ($failures > 0) {
    echo 'FAILED: ' . $failures . ' winner test(s).' . PHP_EOL;
    exit(1);
}

echo 'PASS: daily_scores winner resolution is mode-safe.' . PHP_EOL;
