<?php
// validate.php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/validate-error.log');

function respond(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

function log_message(string $message, array $context = []): void {
    if (!empty($context)) {
        $message .= ' | ' . json_encode($context);
    }
    error_log($message);
}

function normalizeGridInput($gridInput): array {
    if (is_array($gridInput)) {
        if (count($gridInput) !== 25) {
            return [];
        }
        $cells = array_values($gridInput);
    } elseif (is_string($gridInput)) {
        $gridInput = preg_replace('/\s+/', '', $gridInput);
        if (strlen($gridInput) !== 25) {
            return [];
        }
        $cells = str_split($gridInput);
    } else {
        return [];
    }

    $normalized = [];

    foreach ($cells as $cell) {
        if (!is_scalar($cell)) {
            return [];
        }

        $cell = trim((string)$cell);
        if ($cell === '') {
            return [];
        }

        $cell = strtoupper(substr($cell, 0, 1));

        if (!preg_match('/^[A-Z?]$/', $cell)) {
            return [];
        }

        $normalized[] = $cell;
    }

    return count($normalized) === 25 ? $normalized : [];
}

function getLetterAt(int $r, int $c, array $cells, int $gridSize): ?string {
    if ($r >= 0 && $r < $gridSize && $c >= 0 && $c < $gridSize) {
        return $cells[$r * $gridSize + $c];
    }
    return null;
}

if (!file_exists(__DIR__ . '/config.php')) {
    log_message('config.php missing');
    respond(['error' => 'config.php is missing.'], 500);
}

require_once __DIR__ . '/config.php';

try {
    $dsn = "mysql:host={$host};dbname={$dbname};charset=utf8mb4";

    if (isset($port) && $port !== '') {
        $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
    }

    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    log_message('Database connection failed', ['exception' => $e->getMessage()]);
    respond(['error' => 'Database connection failed.'], 500);
}

$rawBody = file_get_contents('php://input');
$input = json_decode($rawBody, true);

if ($rawBody !== '' && $input === null && json_last_error() !== JSON_ERROR_NONE) {
    log_message('Invalid JSON received', ['json_error' => json_last_error_msg()]);
    respond(['error' => 'Invalid JSON body.'], 400);
}

if (!is_array($input)) {
    $input = [];
}

if (isset($input['action'])) {
    $action = (string)$input['action'];

    try {
        if ($action === 'get_dict') {
            $stmt = $pdo->query("SELECT word FROM dictionary");
            $words = $stmt->fetchAll(PDO::FETCH_COLUMN);
            respond(['words' => $words]);
        }

        if ($action === 'save_score') {
            $initialsRaw = strtoupper((string)($input['initials'] ?? ''));
            $initials = preg_replace('/[^A-Z]/', '', $initialsRaw);
            $initials = substr($initials . '---', 0, 3);

            $score = filter_var($input['score'] ?? null, FILTER_VALIDATE_INT);
            if ($score === false || $score < 0) {
                respond(['error' => 'Invalid score.'], 400);
            }

            $grid = preg_replace('/[^A-Za-z]/', '', (string)($input['grid'] ?? ''));
            $grid = substr($grid, 0, 25);

            $stmt = $pdo->prepare("INSERT INTO highscores (initials, score, grid) VALUES (?, ?, ?)");
            $stmt->execute([$initials, $score, $grid]);

            $newId = $pdo->lastInsertId();

            $stmtTop = $pdo->query("
                SELECT id
                FROM highscores
                WHERE DATE(created_at) = CURDATE()
                ORDER BY score DESC, created_at ASC
                LIMIT 1
            ");
            $topRow = $stmtTop->fetch();
            $isTopScore = ($topRow && (string)$topRow['id'] === (string)$newId);

            respond([
                'success' => true,
                'is_top_score' => $isTopScore
            ]);
        }

        if ($action === 'get_highscores') {
            $stmt = $pdo->query("
                SELECT initials, score, grid
                FROM highscores
                WHERE DATE(created_at) = CURDATE()
                ORDER BY score DESC, created_at ASC
                LIMIT 10
            ");
            $scores = $stmt->fetchAll();
            respond(['highscores' => $scores]);
        }

        if ($action === 'get_yesterdays_winner') {
            $stmt = $pdo->query("
                SELECT initials
                FROM highscores
                WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
                ORDER BY score DESC, created_at ASC
                LIMIT 1
            ");
            $row = $stmt->fetch();
            respond(['winner_initials' => $row ? $row['initials'] : null]);
        }

        respond(['error' => 'Unknown action.'], 400);
    } catch (PDOException $e) {
        log_message('Action query failed', [
            'action' => $action,
            'exception' => $e->getMessage()
        ]);

        if ($action === 'get_yesterdays_winner') {
            respond(['winner_initials' => null]);
        }

        respond(['error' => 'Database query failed.'], 500);
    }
}

// Optional fallback scoring endpoint
$grid = normalizeGridInput($input['grid'] ?? null);

if (empty($grid)) {
    respond(['error' => 'Invalid grid data submitted.'], 400);
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

                $letter = getLetterAt($nextRow, $nextCol, $grid, $gridSize);
                if ($letter === null || $letter === '') {
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
    respond([
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
} catch (PDOException $e) {
    log_message('Fallback scoring query failed', ['exception' => $e->getMessage()]);
    respond(['error' => 'Database query failed.'], 500);
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

    sort($group);
    $displayWords[] = implode('/', $group);
}

respond([
    'score' => $score,
    'words' => $displayWords,
    'breakdown' => $breakdown
]);
?>
