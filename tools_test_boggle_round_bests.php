<?php
declare(strict_types=1);

$source = (string)file_get_contents(__DIR__ . '/validate.php');
$marker = "if (!file_exists(__DIR__ . '/config.php')) {";
$cut = strpos($source, $marker);
if ($cut === false) {
    throw new RuntimeException('Could not locate validate.php bootstrap.');
}
$head = substr($source, 0, $cut);
$head = str_replace(['<?php', 'declare(strict_types=1);'], '', $head);
$head = preg_replace('/^\s*header\([^;]*\);\s*$/m', '', $head);
eval($head);

$pdo = new PDO('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->sqliteCreateFunction('CURDATE', static fn(): string => '2026-01-01');
foreach (['boggle_highscores', 'sloggle_highscores'] as $table) {
    $pdo->exec("CREATE TABLE {$table} (id INTEGER PRIMARY KEY, initials TEXT, score INTEGER, words_json TEXT, round_scores TEXT, created_at TEXT)");
}

$insert = $pdo->prepare('INSERT INTO boggle_highscores VALUES (?, ?, ?, ?, ?, ?)');
$insert->execute([1, 'AAA', 10, '["TEST","TESTING","SEARCH","WORD"]', '[1,8,1]', '2026-01-01 08:00:00']);
for ($id = 2; $id <= 9; $id++) {
    $insert->execute([$id, 'TIE', 10, '["TEST","TESTING","SEARCH","WORD"]', '[1,8,1]', '2026-01-01 09:00:00']);
}
$insert->execute([10, 'BBB', 8, '["TESTING","WORDS","TEST"]', '[5,2,1]', '2026-01-01 10:00:00']);
$insert->execute([11, 'CCC', 7, '["TEST","WORD","TESTING"]', '[1,1,5]', '2026-01-01 11:00:00']);
$insert->execute([12, 'OLD', 30, '[]', null, '2026-01-01 12:00:00']);
$insert->execute([13, 'YDY', 15, '["TESTING","TESTING","TESTING"]', '[5,5,5]', '2025-12-31 12:00:00']);

$expected = [
    ['initials' => 'BBB', 'score' => 5, 'word_count' => 1],
    ['initials' => 'AAA', 'score' => 8, 'word_count' => 2],
    ['initials' => 'CCC', 'score' => 5, 'word_count' => 1],
];
if (fetchBoggleRoundBests($pdo, 'boggle') !== $expected) {
    throw new RuntimeException('Round bests did not use all saved scores, correct rounds, or earliest tie.');
}
if (fetchBoggleRoundBests($pdo, 'sloggle') !== [null, null, null]) {
    throw new RuntimeException('Empty Sloggle scores should not use Boggle scores.');
}

$pdo->exec("INSERT INTO sloggle_highscores VALUES (1, 'BAD', 3, '[\"TESTING\"]', '[3,0,0]', '2026-01-01 08:00:00')");
$sloggle = fetchBoggleRoundBests($pdo, 'sloggle');
if ($sloggle[0] !== ['initials' => 'BAD', 'score' => 3, 'word_count' => null]) {
    throw new RuntimeException('Inconsistent saved words must not produce a guessed word count.');
}
if (boggleRoundWordCounts('["TEST","WORDS"]', [0, 1, 2]) !== [0, 1, 1]
    || boggleRoundWordCounts('["TEST","WORDS"]', [1, 1, 1]) !== null
    || boggleRoundWordCounts('{}', [0, 0, 0]) !== null) {
    throw new RuntimeException('Round word counts failed validation.');
}

echo "Boggle round best tests passed.\n";
