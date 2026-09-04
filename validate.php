<?php
declare(strict_types=1);

// validate.php
header('Content-Type: application/json; charset=utf-8');
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/php-error.log');

// Shared Scrabble rules (seed + daily special-square layout). Side-effect free.
require_once __DIR__ . '/scrabble.php';

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
        if (!preg_match('/^[A-Z]{4,25}$/', $normalisedWord)) {
            throw new InvalidArgumentException('Invalid Boggle word.');
        }

        // Allow duplicate words (same word can be found in different rounds and scores each time)
        $normalisedWords[] = $normalisedWord;
    }

    return $normalisedWords;
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

/**
 * Score a Scrabble grid and return the authoritative per-word breakdown.
 *
 * Only five-letter words score. Each word is valued with Scrabble letter
 * values; a double-letter square doubles that one letter and a double-word
 * square doubles the finished word. Wildcard tiles are worth 0.
 *
 * A word and its reverse are a single scoring entry, so only the highest
 * scoring path of each pair is counted, and only once.
 *
 * @param list<int> $dlIndices
 * @param list<int> $dwIndices
 * @return array{score: int, events: list<array{word: string, points: int}>}
 */
function calculateScrabbleScoreWithEvents(string $gridString, PDO $pdo, array $dlIndices = [], array $dwIndices = []): array
{
    // One batched dictionary lookup for the whole grid keeps the shared scorer
    // free of any database access.
    $resolveValidWords = static function (array $candidateWords) use ($pdo): array {
        return fetchValidWords($candidateWords, $pdo);
    };

    return calculateScrabbleScoreWithResolver($gridString, $resolveValidWords, $dlIndices, $dwIndices);
}

function calculateScrabbleGridScore(string $gridString, PDO $pdo, array $dlIndices = [], array $dwIndices = []): int
{
    $result = calculateScrabbleScoreWithEvents($gridString, $pdo, $dlIndices, $dwIndices);

    return $result['score'];
}

function calculateGridScoreForMode(string $gridString, string $mode, PDO $pdo, array $dlIndices = [], array $dwIndices = []): int
{
    $mode = normaliseMode($mode);

    if ($mode === 'scrabble') {
        return calculateScrabbleGridScore($gridString, $pdo, $dlIndices, $dwIndices);
    }

    return calculateClassicGridScore($gridString, $pdo, $mode);
}

/**
 * Calculate the game mode for a given date based on the 7-day cycle.
 * This matches the cycle logic in index.php exactly.
 * 
 * @param DateTimeImmutable $date The date to calculate the mode for
 * @return string The mode: 'bomb', 'scrabble', 'lookahead', 'topup', 'tetris', 'boggle', or 'classic'
 */
function getModeForDate(DateTimeImmutable $date): string
{
    $epoch = new DateTimeImmutable('2026-05-21 00:00:00', new DateTimeZone('UTC'));
    $target = $date->setTime(0, 0, 0)->setTimezone(new DateTimeZone('UTC'));
    $daysSinceEpoch = (int) floor(($target->getTimestamp() - $epoch->getTimestamp()) / 86400);

    // 7-day cycle matching index.php logic exactly
    if ($daysSinceEpoch > 0 && $daysSinceEpoch % 7 === 0) {
        return 'bomb';          // Day 0
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 1) % 7 === 0) {
        return 'scrabble';      // Day 1
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 2) % 7 === 0) {
        return 'lookahead';     // Day 2
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 3) % 7 === 0) {
        return 'topup';         // Day 3
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 4) % 7 === 0) {
        return 'tetris';        // Day 4
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 6) % 7 === 0) {
        return 'boggle';        // Day 6
    }

    return 'classic';           // Default / Day 5
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
        $dailyMode = getModeForDate(new DateTimeImmutable('now', new DateTimeZone('UTC')));
        if ($mode !== $dailyMode) {
            jsonResponse(['error' => 'Score mode does not match today\'s daily challenge.'], 400);
        }

        $sessionId = trim((string)($input['session_id'] ?? ''));
        $submittedScore = isset($input['score']) ? (int)$input['score'] : 0;
        $submittedWordEvents = is_array($input['word_events'] ?? null) ? $input['word_events'] : [];
        $wordEvents = [];
        foreach (array_slice($submittedWordEvents, 0, 250) as $event) {
            if (!is_array($event)) {
                continue;
            }

            $word = strtoupper(trim((string)($event['word'] ?? '')));
            $points = isset($event['points']) ? (int)$event['points'] : 0;
            $expectedPoints = strlen($word) === 3 ? 1 : (strlen($word) === 4 ? 5 : (strlen($word) === 5 ? 20 : 0));
            if (preg_match('/^[A-Z]{3,5}$/', $word) && $points === $expectedPoints) {
                $wordEvents[] = ['word' => $word, 'points' => $points];
            }
        }

        // DIAGNOSTIC FIX: Explicit length reporting
        if (strlen($grid) !== 25) {
            $errMsg = 'Invalid grid. Expected 25, got ' . strlen($grid) . '. Grid string: [' . $grid . ']';
            error_log("DIAGNOSTIC REJECTION save_score: " . $errMsg);
            jsonResponse(['error' => $errMsg], 400);
        }

        // SECURITY: the double-letter / double-word layout is derived from the UTC
        // daily seed on the server. It is never read from the request, so a client
        // cannot award itself multipliers. index.php publishes the same layout to
        // the browser, which guarantees the rendered board is the scored board.
        $dailyScrabbleLayout = generateScrabbleSpecialSquares(scrabbleDailySeed());
        $dlIndices = $dailyScrabbleLayout['dl'];
        $dwIndices = $dailyScrabbleLayout['dw'];

        if ($mode === 'scrabble') {
            // Scrabble values words with letter points and square multipliers, so
            // the generic fixed-value (1/5/20) event normaliser above cannot
            // represent them. Replace the client events with a server generated
            // breakdown so the stored tiles always sum to the stored score.
            $scrabbleResult = calculateScrabbleScoreWithEvents($grid, $pdo, $dlIndices, $dwIndices);
            $score = $scrabbleResult['score'];
            $wordEvents = $scrabbleResult['events'];
        } else {
            $score = calculateGridScoreForMode($grid, $mode, $pdo, $dlIndices, $dwIndices);
        }

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

        if ($mode !== 'scrabble') {
            $wordEventScore = array_sum(array_map(static function (array $event): int {
                return $event['points'];
            }, $wordEvents));
            if ($wordEventScore !== $score) {
                jsonResponse(['error' => 'Word breakdown does not match the verified score.'], 400);
            }
        } else {
            // Scrabble events are generated from the verified grid by the same
            // server calculation that produced the score. Treat any disagreement
            // here as an internal integrity failure rather than persisting data
            // whose visible breakdown cannot equal its total.
            $scrabbleEventScore = array_sum(array_map(static function (array $event): int {
                return $event['points'];
            }, $wordEvents));

            if ($scrabbleEventScore !== $score) {
                error_log('validate.php: Scrabble breakdown integrity failure.');
                jsonResponse(['error' => 'Verified Scrabble breakdown does not match the score.'], 500);
            }

            if ($submittedScore !== $score) {
                error_log('validate.php: corrected Scrabble client score ' . $submittedScore . ' to ' . $score . '.');
            }
        }

        $wordEventsJson = json_encode($wordEvents);
        if ($wordEventsJson === false) {
            jsonResponse(['error' => 'Failed to encode word breakdown.'], 500);
        }

        try {
            $stmt = $pdo->prepare("
                INSERT INTO highscores (initials, score, grid, word_events_json)
                VALUES (:initials, :score, :grid, :word_events_json)
            ");
            $stmt->execute([
                ':initials' => $initials,
                ':score' => $score,
                ':grid' => $grid,
                ':word_events_json' => $wordEventsJson,
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
                'is_top_score' => $isTopScore,
                'verified_score' => $score,
                'word_events' => $wordEvents,
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
                SELECT id, initials, score, grid, word_events_json, created_at
                FROM highscores
                WHERE DATE(created_at) = CURDATE()
            ");
            $scores = $stmt->fetchAll();
            $scores = array_slice(sortRowsByModeScore($scores, $mode, $pdo), 0, 8);
            foreach ($scores as &$scoreRow) {
                $events = json_decode((string)($scoreRow['word_events_json'] ?? '[]'), true);
                $scoreRow['word_events'] = is_array($events) ? $events : [];
                unset($scoreRow['word_events_json']);
            }
            unset($scoreRow);

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