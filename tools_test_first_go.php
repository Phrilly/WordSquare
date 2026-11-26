<?php
declare(strict_types=1);

$source = (string)file_get_contents(__DIR__ . '/validate.php');
$cut = strpos($source, "if (!file_exists(__DIR__ . '/config.php')) {");
if ($cut === false) {
    throw new RuntimeException('Could not locate validate.php bootstrap.');
}
$head = substr($source, 0, $cut);
$head = str_replace(['<?php', 'declare(strict_types=1);'], '', $head);
$head = str_replace("ini_set('error_log', __DIR__ . '/php-error.log');", "ini_set('error_log', 'php://stderr');", $head);
$head = preg_replace('/^\s*header\([^;]*\);\s*$/m', '', $head);
eval($head);

$mysqlDsn = getenv('WS_TEST_MYSQL_DSN');
$pdo = new PDO($mysqlDsn !== false ? $mysqlDsn : 'sqlite::memory:', $mysqlDsn !== false ? 'root' : null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$idColumn = $mysqlDsn !== false ? 'INTEGER PRIMARY KEY AUTO_INCREMENT' : 'INTEGER PRIMARY KEY';
$pdo->exec("CREATE TABLE highscores (id {$idColumn}, initials VARCHAR(3), mode VARCHAR(20), score INTEGER, first_go INTEGER, created_at DATETIME)");
foreach (['boggle_highscores', 'sloggle_highscores'] as $table) {
    $pdo->exec("CREATE TABLE {$table} (id {$idColumn}, initials VARCHAR(3), score INTEGER, words_json TEXT, round_scores TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
}

$day = new DateTimeImmutable('2026-11-18', new DateTimeZone('UTC'));
$mainInsert = $pdo->prepare('INSERT INTO highscores VALUES (?, ?, ?, ?, ?, ?)');
foreach (['classic', 'bomb', 'lookahead', 'scrabble', 'mfd', 'tetris', 'topup'] as $mode) {
    $mainInsert->execute([null, 'AAA', $mode, 10, 0, '2026-11-18 00:00:00']);
    $mainInsert->execute([null, 'AAA', $mode, 100, 1, '2026-11-18 00:00:00']);
    $mainInsert->execute([null, 'BBB', $mode, 50, 0, '2026-11-18 12:00:00']);
    $mainInsert->execute([null, 'AAA', $mode, 200, 1, '2026-11-17 23:59:59']);
    $mainInsert->execute([null, 'AAA', $mode, 200, 1, '2026-11-19 00:00:00']);
    $rows = fetchFirstGoLeaderboard($pdo, 'highscores', $day, $mode, 's.initials, s.score');
    if ($rows !== [
        ['initials' => 'AAA', 'score' => 100, 'first_go' => false],
        ['initials' => 'BBB', 'score' => 50, 'first_go' => true],
        ['initials' => 'AAA', 'score' => 10, 'first_go' => true],
    ]) {
        throw new RuntimeException("First submissions incorrect for {$mode}: " . json_encode($rows));
    }
    $nextDay = fetchFirstGoLeaderboard($pdo, 'highscores', $day->modify('+1 day'), $mode, 's.initials, s.score');
    if (count($nextDay) !== 1 || $nextDay[0]['first_go'] !== true) {
        throw new RuntimeException("Day rollover incorrect for {$mode}.");
    }
}

foreach (['boggle_highscores', 'sloggle_highscores'] as $table) {
    $insert = $pdo->prepare("INSERT INTO {$table} (id, initials, score, created_at) VALUES (?, ?, ?, ?)");
    $insert->execute([1, 'AAA', 1, '2026-11-18 08:00:00']);
    $insert->execute([2, 'AAA', 100, '2026-11-18 09:00:00']);
    for ($id = 3; $id <= 10; $id++) {
        $insert->execute([$id, sprintf('P%02d', $id), 90 - $id, '2026-11-18 10:00:00']);
    }
    $rows = fetchFirstGoLeaderboard($pdo, $table, $day, null, 's.initials, s.score');
    if (count($rows) !== 8 || $rows[0]['initials'] !== 'AAA' || $rows[0]['first_go'] !== false
        || $rows[1]['first_go'] !== true) {
        throw new RuntimeException("First submissions outside the top eight incorrect for {$table}.");
    }
}

foreach (['boggle', 'sloggle'] as $variant) {
    insertBoggleHighscore($pdo, 'NOW', 0, '[]', [0, 0, 0], $variant);
    insertBoggleHighscore($pdo, 'NOW', 0, '[]', [0, 0, 0], $variant);
    $rows = fetchBoggleHighscoreRows($pdo, $variant);
    if (count($rows) !== 2 || $rows[0]['first_go'] !== true || $rows[1]['first_go'] !== false) {
        throw new RuntimeException("Saving or reading current {$variant} submissions failed.");
    }
}

if ($mysqlDsn !== false) {
    $pdo->exec('ALTER TABLE boggle_highscores DROP COLUMN round_scores');
    $rows = fetchBoggleHighscoreRows($pdo, 'boggle');
    if (count($rows) !== 2 || $rows[0]['first_go'] !== true || $rows[1]['first_go'] !== false) {
        throw new RuntimeException('Legacy Boggle leaderboard failed without round_scores or first_go.');
    }
    insertBoggleHighscore($pdo, 'OLD', 0, '[]', [0, 0, 0], 'boggle');
    if (count(fetchBoggleHighscoreRows($pdo, 'boggle')) !== 3) {
        throw new RuntimeException('Saving Boggle scores without round_scores failed.');
    }
}

echo "First submission leaderboard tests passed.\n";
