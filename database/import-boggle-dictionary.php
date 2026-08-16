<?php
declare(strict_types=1);

/**
 * Imports the vendored SCOWL British English Boggle corpus into dictionary.
 *
 * Usage: php database/import-boggle-dictionary.php
 * Requirements: config.php in the repository root and the migration already run.
 */

function fail(string $message): void
{
    fwrite(STDERR, $message . PHP_EOL);
    exit(1);
}

function normaliseBoggleWord(string $word): ?string
{
    $word = strtoupper(trim($word));
    if (!preg_match('/^[A-Z]{4,25}$/', $word)) {
        return null;
    }

    return $word;
}

$rootDirectory = dirname(__DIR__);
$configPath = $rootDirectory . '/config.php';
$wordListPath = $rootDirectory . '/data/boggle-uk-scowl-60.txt';

if (!is_file($configPath)) {
    fail('config.php is missing.');
}
if (!is_readable($wordListPath)) {
    fail('The British English Boggle word list is missing or unreadable.');
}

require $configPath;

if (!isset($host, $dbname, $user, $pass)) {
    fail('Database configuration is incomplete.');
}

try {
    $pdo = new PDO(
        "mysql:host={$host};dbname={$dbname};charset=utf8mb4",
        $user,
        $pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
    $wordList = new SplFileObject($wordListPath, 'r');
    $insertStatement = $pdo->prepare('INSERT IGNORE INTO dictionary (word) VALUES (:word)');
    $pdo->beginTransaction();
    $importedCount = 0;

    foreach ($wordList as $line) {
        if (!is_string($line)) {
            continue;
        }

        $word = normaliseBoggleWord($line);
        if ($word === null) {
            continue;
        }

        $insertStatement->execute([':word' => $word]);
        $importedCount += $insertStatement->rowCount();
    }

    $pdo->commit();
    fwrite(STDOUT, "Imported {$importedCount} British English Boggle words." . PHP_EOL);
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fail('Boggle dictionary import failed: ' . $exception->getMessage());
}
