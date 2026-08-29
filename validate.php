<?php
declare(strict_types=1);

// validate.php
header('Content-Type: application/json; charset=utf-8');
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/php-error.log');

function jsonResponse(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload);
    exit;
}

function normaliseInitials(?string $initials): string
{
    $initials = strtoupper(trim((string)$initials));
    $initials = preg_replace('/[^A-Z]/', '', $initials) ?? '';
    $initials = substr($initials, 0, 3);
    return str_pad($initials, 3, '-');
}

/**
 * @param mixed $words
 * @return list<string>
 */
function normaliseBoggleWords(mixed $words): array
{
    if (!is_array($words) || count($words) > 750) {
        throw new InvalidArgumentException('Invalid Boggle word list.');
    }

    $normalisedWords = [];
    foreach ($words as $word) {
        if (!is_string($word)) {
            throw new InvalidArgumentException('Invalid Boggle word.');
        }

        $normalisedWord = strtoupper(trim($word));
        if (!preg_match('/^[A-Z]{4,25}$/', $normalisedWord) || isset($normalisedWords[$normalisedWord])) {
            throw new InvalidArgumentException('Invalid Boggle word.');
        }

        $normalisedWords[$normalisedWord] = true;
    }

    return array_keys($normalisedWords);
}

function getBoggleWordPoints(string $word): int
{
    $length = strlen($word);
    if ($length === 4) {
        return 1;
    }
    if ($length === 5) {
        return 2;
    }
    if ($length === 6) {
        return 3;
    }
    if ($length === 7) {
        return 5;
    }
    return $length >= 8 ? 11 : 0;
}

function normaliseGridString(?string $grid): string
{
    $grid = trim((string)$grid);
    $grid = preg_replace('/[^A-Za-z\-]/', '', $grid) ?? '';
    return substr($grid, 0, 25);
}

function normaliseMode(?string $mode): string
{
    $mode = strtolower(trim((string)$mode));
    if ($mode === 'common') {
        $mode = 'mfd';
    }
    $allowedModes = ['classic', 'bomb', 'lookahead', 'scrabble', 'mfd', 'tetris', 'topup'];
    return in_array($mode, $allowedModes, true) ? $mode : 'classic';
}

function getLetterAt(int $r, int $c, array $cells, int $gridSize): ?string
{
    if ($r >= 0 && $r < $gridSize && $c >= 0 && $c < $gridSize) {
        $idx = ($r * $gridSize) + $c;
        return isset($cells[$idx]) ? (string)$cells[$idx] : null;
    }
    return null;
}

function buildGridCells(string $gridString): array
{
    $cells = str_split(strtoupper(trim($gridString)));
    $cells = array_map(function ($cell) {
        return preg_match('/^[A-Z]$/', $cell) ? $cell : '';
    }, $cells);

    return $cells;
}

function buildGridCellsWithWildcardInfo(string $gridString): array
{
    $rawCells = str_split(trim($gridString));
    $cells = array_map(function ($cell) {
        if (preg_match('/^[A-Z]$/', $cell)) {
            return ['letter' => $cell, 'is_wildcard' => false];
        }
        if (preg_match('/^[a-z]$/', $cell)) {
            return ['letter' => strtoupper($cell), 'is_wildcard' => true];
        }
        return ['letter' => '', 'is_wildcard' => false];
    }, $rawCells);

    return $cells;
}

function getScrabbleCellAt(int $r, int $c, array $cells, int $gridSize): ?array
{
    if ($r >= 0 && $r < $gridSize && $c >= 0 && $c < $gridSize) {
        $idx = ($r * $gridSize) + $c;
        return isset($cells[$idx]) && is_array($cells[$idx]) ? $cells[$idx] : null;
    }
    return null;
}

function fetchValidWords(array $candidateWords, PDO $pdo, string $mode = 'classic'): array
{
    if (empty($candidateWords)) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($candidateWords), '?'));
    $mode = normaliseMode($mode);
    $sql = "SELECT word FROM dictionary WHERE word IN ($placeholders)";
    if ($mode === 'mfd') {
        $sql .= ' AND is_mfd = 1';
    }

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($candidateWords);
        $validWords = $stmt->fetchAll(PDO::FETCH_COLUMN);
        return array_map('strtoupper', array_filter($validWords, 'is_string'));
    } catch (PDOException $e) {
        error_log('validate.php scoring dictionary lookup failed: ' . $e->getMessage());
        return [];
    }
}

function calculateClassicGridScore(string $gridString, PDO $pdo, string $mode = 'classic'): int
{
    $cells = buildGridCells($gridString);

    if (count($cells) !== 25) return 0;

    $gridSize = 5;
    $directions = [
        [0, 1], [0, -1], [1, 0], [-1, 0],
        [1, 1], [-1, -1], [-1, 1], [1, -1]
    ];

    $potentialWords = [];

    for ($r = 0; $r < $gridSize; $r++) {
        for ($c = 0; $c < $gridSize; $c++) {
            foreach ($directions as $dir) {
                $currentWord = '';
                for ($step = 0; $step < 5; $step++) {
                    $nextRow = $r + ($dir[0] * $step);
                    $nextCol = $c + ($dir[1] * $step);
                    $letter = getLetterAt($nextRow, $nextCol, $cells, $gridSize);

                    if (!$letter) {
                        break;
                    }

                    $currentWord .= $letter;

                    if (strlen($currentWord) >= 3) {
                        $potentialWords[] = $currentWord;
                    }
                }
            }
        }
    }

    $uniquePotentialWords = array_values(array_unique($potentialWords));

    if (empty($uniquePotentialWords)) {
        return 0;
    }

    $validWords = fetchValidWords($uniquePotentialWords, $pdo, $mode);
    if (empty($validWords)) {
        return 0;
    }

    $grouped = [];

    foreach ($validWords as $w) {
        $rev = strrev($w);
        $key = strcmp($w, $rev) < 0 ? $w : $rev;

        if (!isset($grouped[$key])) {
            $grouped[$key] = [];
        }

        if (!in_array($w, $grouped[$key], true)) {
            $grouped[$key][] = $w;
        }
    }

    $score = 0;

    foreach ($grouped as $key => $group) {
        $len = strlen($key);

        if ($len === 5) {
            $score += 20;
        } elseif ($len === 4) {
            $score += 5;
        } elseif ($len === 3) {
            $score += 1;
        }
    }
    
    return $score;
}

function calculateScrabbleGridScore(string $gridString, PDO $pdo, array $dlIndices = [], array $dwIndices = []): int
{
    $cells = buildGridCellsWithWildcardInfo($gridString);

    if (count($cells) !== 25) {
        return 0;
    }

    $gridSize = 5;
    $directions = [
        [0, 1], [0, -1], [1, 0], [-1, 0],
        [1, 1], [-1, -1], [-1, 1], [1, -1]
    ];
    $scrabbleValues = [
        'A' => 1, 'B' => 3, 'C' => 3, 'D' => 2, 'E' => 1, 'F' => 4, 'G' => 2,
        'H' => 4, 'I' => 1, 'J' => 8, 'K' => 5, 'L' => 1, 'M' => 3, 'N' => 1,
        'O' => 1, 'P' => 3, 'Q' => 10, 'R' => 1, 'S' => 1, 'T' => 1, 'U' => 1,
        'V' => 4, 'W' => 4, 'X' => 8, 'Y' => 4, 'Z' => 10,
    ];
    // Use provided DL indices or default to hardcoded positions for backward compatibility
    $doubleLetterIndices = !empty($dlIndices) ? $dlIndices : [5, 9, 15, 19];

    $foundPaths = [];
    $candidateWords = [];

    for ($r = 0; $r < $gridSize; $r++) {
        for ($c = 0; $c < $gridSize; $c++) {
            foreach ($directions as $dir) {
                $path = [];
                $word = '';

                for ($step = 0; $step < 5; $step++) {
                    $nextRow = $r + ($dir[0] * $step);
                    $nextCol = $c + ($dir[1] * $step);
                    $cellInfo = getScrabbleCellAt($nextRow, $nextCol, $cells, $gridSize);
                    $letter = ($cellInfo && isset($cellInfo['letter'])) ? (string)$cellInfo['letter'] : '';

                    if (!$letter) {
                        break;
                    }

                    $path[] = ($nextRow * $gridSize) + $nextCol;
                    $word .= $letter;

                    if (strlen($word) === 5) {
                        $candidateWords[] = $word;
                        $foundPaths[] = ['word' => $word, 'path' => $path];
                    }
                }
            }
        }
    }

    $validWords = array_flip(fetchValidWords(array_values(array_unique($candidateWords)), $pdo));
    if (empty($validWords)) {
        return 0;
    }

    $bestScoreForWord = [];

    foreach ($foundPaths as $item) {
        if (!isset($validWords[$item['word']])) {
            continue;
        }

        $reversed = strrev($item['word']);
        $key = strcmp($item['word'], $reversed) < 0 ? $item['word'] : $reversed;

        $pathScore = 0;
        $hasDW = false;
        
        foreach ($item['path'] as $idx) {
            $cellInfo = $cells[$idx] ?? ['letter' => '', 'is_wildcard' => false];
            $letter = (string)($cellInfo['letter'] ?? '');
            $isWildcard = (bool)($cellInfo['is_wildcard'] ?? false);

            $value = $isWildcard ? 0 : ($scrabbleValues[$letter] ?? 0);
            if (!$isWildcard && in_array($idx, $doubleLetterIndices, true)) {
                $value *= 2;
            }
            $pathScore += $value;
            
            // Check if this path includes a DW square
            if (in_array($idx, $dwIndices, true)) {
                $hasDW = true;
            }
        }
        
        // Double the entire word score if it passes through a DW square
        if ($hasDW) {
            $pathScore *= 2;
        }

        if (!isset($bestScoreForWord[$key]) || $pathScore > $bestScoreForWord[$key]) {
            $bestScoreForWord[$key] = $pathScore;
        }
    }

    return array_sum($bestScoreForWord);
}

function calculateGridScoreForMode(string $gridString, string $mode, PDO $pdo, array $dlIndices = [], array $dwIndices = []): int
{
    $mode = normaliseMode($mode);

    if ($mode === 'scrabble') {
        return calculateScrabbleGridScore($gridString, $pdo, $dlIndices, $dwIndices);
    }

    return calculateClassicGridScore($gridString, $pdo, $mode);
}

function getModeForDate(DateTimeImmutable $date): string
{
    $epoch = new DateTimeImmutable('2026-05-21 00:00:00', new DateTimeZone('UTC'));
    $target = $date->setTime(0, 0, 0)->setTimezone(new DateTimeZone('UTC'));
    $daysSinceEpoch = (int) floor(($target->getTimestamp() - $epoch->getTimestamp()) / 86400);

    if ($daysSinceEpoch > 0 && $daysSinceEpoch % 6 === 0) {
        return 'bomb';
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 1) % 6 === 0) {
        return 'scrabble';
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 2) % 6 === 0) {
        return 'lookahead';
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 3) % 6 === 0) {
        return 'mfd';
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 4) % 6 === 0) {
        return 'tetris';
    }

    return 'classic';
}

function sortRowsByModeScore(array $rows, string $mode, PDO $pdo): array
{
    $mode = normaliseMode($mode);

    foreach ($rows as &$row) {
        if ($mode === 'tetris' || $mode === 'topup' || $mode === 'scrabble') {
            $row['score'] = (int)($row['score'] ?? 0);
            continue;
        }

        $grid = normaliseGridString($row['grid'] ?? '');
        $row['score'] = calculateGridScoreForMode($grid, $mode, $pdo);
    }
    unset($row);

    usort($rows, function (array $left, array $right): int {
        $scoreComparison = (int)($right['score'] ?? 0) <=> (int)($left['score'] ?? 0);
        if ($scoreComparison !== 0) {
            return $scoreComparison;
        }

        $leftCreated = strtotime((string)($left['created_at'] ?? '')) ?: 0;
        $rightCreated = strtotime((string)($right['created_at'] ?? '')) ?: 0;
        if ($leftCreated !== $rightCreated) {
            return $leftCreated <=> $rightCreated;
        }

        return ((int)($left['id'] ?? 0)) <=> ((int)($right['id'] ?? 0));
    });

    return $rows;
}

if (!file_exists(__DIR__ . '/config.php')) {
    jsonResponse(['error' => 'config.php is missing.'], 500);
}

require_once __DIR__ . '/config.php';

if (!isset($host, $dbname, $user, $pass)) {
    error_log('validate.php: Missing DB config variables in config.php');
    jsonResponse(['error' => 'Database configuration is incomplete.'], 500);
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
} catch (PDOException $e) {
    error_log('validate.php DB connection failed: ' . $e->getMessage());
    jsonResponse(['error' => 'Database connection failed.'], 500);
}

// ==== DIAGNOSTIC NET START ====
$rawInput = file_get_contents('php://input');
error_log("--- DIAGNOSTIC INBOUND PAYLOAD ---: " . $rawInput);

$input = json_decode($rawInput, true);

if (json_last_error() !== JSON_ERROR_NONE && !empty($rawInput)) {
    $jsonErrorMsg = "JSON Decode Error: " . json_last_error_msg();
    error_log($jsonErrorMsg);
    jsonResponse(['error' => $jsonErrorMsg], 400);
}

if (!is_array($input)) {
    $input = [];
}
// ==== DIAGNOSTIC NET END ====

if (isset($input['action'])) {
    $action = (string)$input['action'];

    if ($action === 'get_dict') {
        $mode = normaliseMode($input['mode'] ?? null);
        try {
            if ($mode === 'mfd') {
                $stmt = $pdo->query("SELECT word FROM dictionary WHERE is_mfd = 1");
            } else {
                $stmt = $pdo->query("SELECT word FROM dictionary");
            }
            $words = $stmt->fetchAll(PDO::FETCH_COLUMN);

            $words = array_values(array_filter($words, function ($word) {
                return is_string($word) && preg_match('/^[A-Z]{3,5}$/i', $word);
            }));

            $words = array_map('strtoupper', $words);

            $etag = md5(implode(',', $words));
            header("ETag: \"{$etag}\"");
            header('Cache-Control: public, max-age=0, must-revalidate');

            if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH'], '"') === $etag) {
                http_response_code(304);
                exit;
            }

            jsonResponse(['words' => $words]);
        } catch (PDOException $e) {
            error_log('validate.php get_dict failed: ' . $e->getMessage());
            jsonResponse(['error' => 'Database query failed.'], 500);
        }
    }

    if ($action === 'get_boggle_highscores') {
        try {
            $stmt = $pdo->query("
                SELECT id, initials, score, words_json
                FROM boggle_highscores
                WHERE DATE(created_at) = CURDATE()
                ORDER BY score DESC, created_at ASC, id ASC
                LIMIT 8
            ");
            $scores = $stmt->fetchAll();
            foreach ($scores as &$score) {
                $words = json_decode((string)($score['words_json'] ?? '[]'), true);
                $score['words'] = is_array($words) ? array_values(array_filter($words, 'is_string')) : [];
                unset($score['words_json']);
            }
            unset($score);
            jsonResponse(['highscores' => $scores]);
        } catch (PDOException $e) {
            error_log('validate.php get_boggle_highscores failed: ' . $e->getMessage());
            jsonResponse(['error' => 'Failed to load Boggle high scores.'], 500);
        }
    }

    if ($action === 'get_boggle_yesterdays_winner') {
        try {
            $stmt = $pdo->query("
                SELECT initials, score, words_json
                FROM boggle_highscores
                WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
                ORDER BY score DESC, created_at ASC, id ASC
                LIMIT 1
            ");
            $winner = $stmt->fetch();
            if (!is_array($winner)) {
                jsonResponse(['winner' => null]);
            }

            $words = json_decode((string)($winner['words_json'] ?? '[]'), true);
            $winner['words'] = is_array($words) ? array_values(array_filter($words, 'is_string')) : [];
            unset($winner['words_json']);
            jsonResponse(['winner' => $winner]);
        } catch (PDOException $e) {
            error_log('validate.php get_boggle_yesterdays_winner failed: ' . $e->getMessage());
            jsonResponse(['error' => 'Failed to load yesterday\'s Boggle winner.'], 500);
        }
    }

    if ($action === 'save_boggle_highscore') {
        $initials = normaliseInitials($input['initials'] ?? null);
        $score = isset($input['score']) ? (int)$input['score'] : -1;
        if ($score < 0 || $score > 100000) {
            jsonResponse(['error' => 'Invalid Boggle score.'], 400);
        }
        try {
            $words = normaliseBoggleWords($input['words'] ?? null);
        } catch (InvalidArgumentException $e) {
            jsonResponse(['error' => $e->getMessage()], 400);
        }
        $calculatedScore = array_sum(array_map('getBoggleWordPoints', $words));
        if ($score !== $calculatedScore) {
            jsonResponse(['error' => 'Boggle score does not match submitted words.'], 400);
        }
        try {
            $wordsJson = json_encode($words, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            error_log('validate.php boggle word encoding failed: ' . $e->getMessage());
            jsonResponse(['error' => 'Unable to save Boggle words.'], 500);
        }

        try {
            $stmt = $pdo->prepare("
                INSERT INTO boggle_highscores (initials, score, words_json)
                VALUES (:initials, :score, :words_json)
            ");
            $stmt->execute([':initials' => $initials, ':score' => $score, ':words_json' => $wordsJson]);
            $newId = (int)$pdo->lastInsertId();

            $topScoreStmt = $pdo->query("
                SELECT id
                FROM boggle_highscores
                WHERE DATE(created_at) = CURDATE()
                ORDER BY score DESC, created_at ASC, id ASC
                LIMIT 1
            ");
            $topScoreId = (int)$topScoreStmt->fetchColumn();

            jsonResponse([
                'success' => true,
                'is_top_score' => $newId === $topScoreId
            ]);
        } catch (PDOException $e) {
            error_log('validate.php save_boggle_highscore failed: ' . $e->getMessage());
            jsonResponse(['error' => 'Failed to save Boggle high score.'], 500);
        }
    }

    if ($action === 'save_score') {
        $initials = normaliseInitials($input['initials'] ?? null);
        $grid = normaliseGridString($input['grid'] ?? '');
        $mode = normaliseMode($input['mode'] ?? null);
        $sessionId = trim((string)($input['session_id'] ?? ''));
        $submittedScore = isset($input['score']) ? (int)$input['score'] : 0;

        // DIAGNOSTIC FIX: Explicit length reporting
        if (strlen($grid) !== 25) {
            $errMsg = 'Invalid grid. Expected 25, got ' . strlen($grid) . '. Grid string: [' . $grid . ']';
            error_log("DIAGNOSTIC REJECTION save_score: " . $errMsg);
            jsonResponse(['error' => $errMsg], 400);
        }

        // Get DL and DW indices from frontend if provided
        $dlIndices = [];
        if (isset($input['dl_indices']) && is_array($input['dl_indices'])) {
            $dlIndices = array_map('intval', $input['dl_indices']);
            $dlIndices = array_filter($dlIndices, function($idx) {
                return $idx >= 0 && $idx < 25;
            });
            $dlIndices = array_values($dlIndices);
        }
        
        $dwIndices = [];
        if (isset($input['dw_indices']) && is_array($input['dw_indices'])) {
            $dwIndices = array_map('intval', $input['dw_indices']);
            $dwIndices = array_filter($dwIndices, function($idx) {
                return $idx >= 0 && $idx < 25;
            });
            $dwIndices = array_values($dwIndices);
        }
        
        $score = calculateGridScoreForMode($grid, $mode, $pdo, $dlIndices, $dwIndices);

        if ($mode === 'tetris' || $mode === 'topup') {
            if ($sessionId === '') {
            jsonResponse(['error' => 'Missing session id for score verification.'], 400);
            }

            try {
                $stmtVerify = $pdo->prepare("\n                    SELECT final_score, grid\n                    FROM game_log\n                    WHERE session_id = :session_id\n                    ORDER BY created_at DESC, id DESC\n                    LIMIT 1\n                ");
                $stmtVerify->execute([':session_id' => $sessionId]);
                $proof = $stmtVerify->fetch();

                if (!$proof) {
                    jsonResponse(['error' => 'No gameplay proof found for this session.'], 400);
                }

                $proofGrid = normaliseGridString($proof['grid'] ?? '');
                $proofScore = (int)($proof['final_score'] ?? -1);

                if ($proofGrid !== $grid) {
                    jsonResponse(['error' => 'Score verification failed: grid proof mismatch.'], 400);
                }

                if ($submittedScore !== $proofScore) {
                    jsonResponse(['error' => 'Score verification failed: score proof mismatch.'], 400);
                }

                $score = $proofScore;
            } catch (PDOException $e) {
                error_log('validate.php score verification failed: ' . $e->getMessage());
                jsonResponse(['error' => 'Failed to verify tetris score.'], 500);
            }
        }

        try {
            $stmt = $pdo->prepare("
                INSERT INTO highscores (initials, score, grid)
                VALUES (:initials, :score, :grid)
            ");
            $stmt->execute([
                ':initials' => $initials,
                ':score' => $score,
                ':grid' => $grid,
            ]);

            $newId = (int)$pdo->lastInsertId();

            $stmtTop = $pdo->query("
                SELECT id, initials, score, grid, created_at
                FROM highscores
                WHERE DATE(created_at) = CURDATE()
            ");
            $rows = $stmtTop->fetchAll();
            $rankedRows = sortRowsByModeScore($rows, $mode, $pdo);
            $topRow = $rankedRows[0] ?? null;
            $isTopScore = ($topRow && (int)$topRow['id'] === $newId);

            jsonResponse([
                'success' => true,
                'is_top_score' => $isTopScore
            ]);
        } catch (PDOException $e) {
            error_log('validate.php save_score failed: ' . $e->getMessage());
            jsonResponse(['error' => 'Failed to save score.'], 500);
        }
    }

    if ($action === 'log_game') {
        $sessionId = $input['session_id'] ?? '';
        $gameSeed = isset($input['game_seed']) ? (int)$input['game_seed'] : 0;
        $isDaily = isset($input['is_daily']) ? (bool)$input['is_daily'] : false;
        $dailyOffset = isset($input['daily_offset']) ? (int)$input['daily_offset'] : 0;
        $finalScore = isset($input['final_score']) ? (int)$input['final_score'] : 0;
        $grid = normaliseGridString($input['grid'] ?? '');

        // DIAGNOSTIC FIX: Explicit error reporting
        if (empty($sessionId)) {
             jsonResponse(['error' => 'Invalid audit data: missing session id.'], 400);
        }
        if (strlen($grid) !== 25) {
            $errMsg = 'Invalid audit data: grid length is ' . strlen($grid) . ' instead of 25. String: [' . $grid . ']';
            error_log("DIAGNOSTIC REJECTION log_game: " . $errMsg);
            jsonResponse(['error' => $errMsg], 400);
        }

        try {
            $stmt = $pdo->prepare("
                INSERT INTO game_log (session_id, game_seed, is_daily, daily_offset, final_score, grid)
                VALUES (:session_id, :game_seed, :is_daily, :daily_offset, :final_score, :grid)
            ");
            $stmt->execute([
                ':session_id' => $sessionId,
                ':game_seed' => $gameSeed,
                ':is_daily' => $isDaily,
                ':daily_offset' => $dailyOffset,
                ':final_score' => $finalScore,
                ':grid' => $grid,
            ]);
            jsonResponse(['success' => true]);
        } catch (PDOException $e) {
            error_log('validate.php log_game failed: ' . $e->getMessage());
            jsonResponse(['error' => 'Failed to log game.'], 500);
        }
    }

    if ($action === 'get_highscores') {
        $mode = normaliseMode($input['mode'] ?? null);

        try {
            $stmt = $pdo->query("
                SELECT id, initials, score, grid, created_at
                FROM highscores
                WHERE DATE(created_at) = CURDATE()
            ");
            $scores = $stmt->fetchAll();
            $scores = array_slice(sortRowsByModeScore($scores, $mode, $pdo), 0, 8);

            jsonResponse(['highscores' => $scores]);
        } catch (PDOException $e) {
            error_log('validate.php get_highscores failed: ' . $e->getMessage());
            jsonResponse(['error' => 'Failed to load highscores.'], 500);
        }
    }

    if ($action === 'get_yesterdays_winner') {
        try {
            $yesterday = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->modify('-1 day');
            $mode = getModeForDate($yesterday);
            $stmt = $pdo->query("
                SELECT id, initials, score, grid, created_at
                FROM highscores
                WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
            ");
            $rows = $stmt->fetchAll();
            $rankedRows = sortRowsByModeScore($rows, $mode, $pdo);
            $row = $rankedRows[0] ?? null;

            jsonResponse([
                'winner_initials' => $row ? $row['initials'] : null
            ]);
        } catch (PDOException $e) {
            error_log('validate.php get_yesterdays_winner failed: ' . $e->getMessage());
            jsonResponse(['winner_initials' => null]);
        }
    }

    $unknownMsg = 'Unknown action: ' . $action;
    error_log("DIAGNOSTIC 400: " . $unknownMsg);
    jsonResponse(['error' => $unknownMsg], 400);
}