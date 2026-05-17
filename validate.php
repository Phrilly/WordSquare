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

function normaliseGridString(?string $grid): string
{
    $grid = trim((string)$grid);
    $grid = preg_replace('/[^A-Za-z]/', '', $grid) ?? '';
    return substr($grid, 0, 25);
}

function getLetterAt(int $r, int $c, array $cells, int $gridSize): ?string
{
    if ($r >= 0 && $r < $gridSize && $c >= 0 && $c < $gridSize) {
        $idx = ($r * $gridSize) + $c;
        return isset($cells[$idx]) ? (string)$cells[$idx] : null;
    }
    return null;
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

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

if (!is_array($input)) {
    $input = [];
}

if (isset($input['action'])) {
    $action = (string)$input['action'];

    if ($action === 'get_dict') {
        try {
            $stmt = $pdo->query("SELECT word FROM dictionary");
            $words = $stmt->fetchAll(PDO::FETCH_COLUMN);

            $words = array_values(array_filter($words, function ($word) {
                return is_string($word) && preg_match('/^[A-Z]{3,5}$/i', $word);
            }));

            $words = array_map('strtoupper', $words);

            jsonResponse(['words' => $words]);
        } catch (PDOException $e) {
            error_log('validate.php get_dict failed: ' . $e->getMessage());
            jsonResponse(['error' => 'Database query failed.'], 500);
        }
    }

    if ($action === 'save_score') {
        $initials = normaliseInitials($input['initials'] ?? null);
        $score = isset($input['score']) ? (int)$input['score'] : -1;
        $grid = normaliseGridString($input['grid'] ?? '');

        if ($score < 0) {
            jsonResponse(['error' => 'Invalid score.'], 400);
        }

        if (strlen($grid) !== 25) {
            jsonResponse(['error' => 'Invalid grid.'], 400);
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
                SELECT id
                FROM highscores
                WHERE DATE(created_at) = CURDATE()
                ORDER BY score DESC, created_at ASC, id ASC
                LIMIT 1
            ");
            $topRow = $stmtTop->fetch();
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

    if ($action === 'get_highscores') {
        try {
            $stmt = $pdo->query("
                SELECT id, initials, score, grid, created_at
                FROM highscores
                WHERE DATE(created_at) = CURDATE()
                ORDER BY score DESC, created_at ASC, id ASC
                LIMIT 10
            ");
            $scores = $stmt->fetchAll();

            jsonResponse(['highscores' => $scores]);
        } catch (PDOException $e) {
            error_log('validate.php get_highscores failed: ' . $e->getMessage());
            jsonResponse(['error' => 'Failed to load highscores.'], 500);
        }
    }

    if ($action === 'get_yesterdays_winner') {
        try {
            $stmt = $pdo->query("
                SELECT initials, score, grid, created_at
                FROM highscores
                WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
                ORDER BY score DESC, created_at ASC, id ASC
                LIMIT 1
            ");
            $row = $stmt->fetch();

            jsonResponse([
                'winner_initials' => $row ? $row['initials'] : null
            ]);
        } catch (PDOException $e) {
            error_log('validate.php get_yesterdays_winner failed: ' . $e->getMessage());
            jsonResponse(['winner_initials' => null]);
        }
    }

    jsonResponse(['error' => 'Unknown action.'], 400);
}

if (!isset($input['grid']) || !is_array($input['grid']) || count($input['grid']) !== 25) {
    jsonResponse(['error' => 'Invalid grid data submitted.'], 400);
}

$cells = array_map(function ($cell) {
    $cell = strtoupper(trim((string)$cell));
    return preg_match('/^[A-Z]$/', $cell) ? $cell : '';
}, $input['grid']);

if (count(array_filter($cells, fn($c) => $c !== '')) !== 25) {
    jsonResponse(['error' => 'Grid must contain 25 letters.'], 400);
}

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
    jsonResponse([
        'score' => 0,
        'words' => [],
        'breakdown' => [3 => 0, 4 => 0, 5 => 0]
    ]);
}

$placeholders = implode(',', array_fill(0, count($uniquePotentialWords), '?'));

try {
    $stmt = $pdo->prepare("SELECT word FROM dictionary WHERE word IN ($placeholders)");
    $stmt->execute($uniquePotentialWords);
    $validWords = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $validWords = array_map('strtoupper', array_filter($validWords, 'is_string'));
} catch (PDOException $e) {
    error_log('validate.php scoring dictionary lookup failed: ' . $e->getMessage());
    jsonResponse(['error' => 'Dictionary lookup failed.'], 500);
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
$displayWords = [];
$breakdown = [3 => 0, 4 => 0, 5 => 0];

foreach ($grouped as $key => $group) {
    $len = strlen($key);

    if (!isset($breakdown[$len])) {
        continue;
    }

    $breakdown[$len]++;

    if ($len === 5) {
        $score += 20;
    } elseif ($len === 4) {
        $score += 5;
    } elseif ($len === 3) {
        $score += 1;
    }

    sort($group, SORT_STRING);
    $displayWords[] = implode('/', $group);
}

jsonResponse([
    'score' => $score,
    'words' => $displayWords,
    'breakdown' => $breakdown
]);
?>
