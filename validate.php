<?php
// validate.php
header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 0); 

if (!file_exists('config.php')) {
    http_response_code(500);
    echo json_encode(['error' => 'config.php is missing.']);
    exit;
}

require_once 'config.php';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (isset($input['action'])) {
    
    // Action: Dump dictionary to browser memory
    if ($input['action'] === 'get_dict') {
        try {
            $stmt = $pdo->query("SELECT word FROM dictionary");
            $words = $stmt->fetchAll(PDO::FETCH_COLUMN);
            echo json_encode(['words' => $words]);
            exit;
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database query failed.']);
            exit;
        }
    }
    
    // Action: Save Highscore
    if ($input['action'] === 'save_score') {
        $initials = strtoupper(substr(trim($input['initials']), 0, 3));
        $score = (int)$input['score'];
        
        if (!empty($initials) && $score >= 0) {
            $stmt = $pdo->prepare("INSERT INTO highscores (initials, score) VALUES (?, ?)");
            $stmt->execute([$initials, $score]);
            echo json_encode(['success' => true]);
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid data.']);
        }
        exit;
    }

    // Action: Get Today's Highscores
    if ($input['action'] === 'get_highscores') {
        // Fetch top 10 scores for the current date
        $stmt = $pdo->query("SELECT initials, score FROM highscores WHERE DATE(created_at) = CURDATE() ORDER BY score DESC, created_at ASC LIMIT 10");
        $scores = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['highscores' => $scores]);
        exit;
    }
}

// Fallback logic for basic grid scoring (kept for safety/legacy)
if (!isset($input['grid']) || count($input['grid']) !== 25) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid grid data submitted.']);
    exit;
}

$cells = $input['grid'];
$gridSize = 5;
$directions = [ [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [-1, 1], [1, -1] ];

function getLetterAt($r, $c, $cells, $gridSize) {
    if ($r >= 0 && $r < $gridSize && $c >= 0 && $c < $gridSize) return $cells[$r * $gridSize + $c];
    return null;
}

$potentialWords = [];
for ($r = 0; $r < $gridSize; $r++) {
    for ($c = 0; $c < $gridSize; $c++) {
        foreach ($directions as $dir) {
            $currentWord = "";
            for ($step = 0; $step < 5; $step++) {
                $nextRow = $r + ($dir[0] * $step);
                $nextCol = $c + ($dir[1] * $step);
                $letter = getLetterAt($nextRow, $nextCol, $cells, $gridSize);
                if (!$letter) break; 
                $currentWord .= $letter;
                if (strlen($currentWord) >= 3) $potentialWords[] = $currentWord;
            }
        }
    }
}

$uniquePotentialWords = array_unique($potentialWords);
if (empty($uniquePotentialWords)) {
    echo json_encode(['score' => 0, 'words' => [], 'breakdown' => [3=>0, 4=>0, 5=>0]]);
    exit;
}

$placeholders = str_repeat('?,', count($uniquePotentialWords) - 1) . '?';
$stmt = $pdo->prepare("SELECT word FROM dictionary WHERE word IN ($placeholders)");
$stmt->execute(array_values($uniquePotentialWords));
$validWords = $stmt->fetchAll(PDO::FETCH_COLUMN);

$score = 0;
$breakdown = [3 => 0, 4 => 0, 5 => 0];
foreach ($validWords as $word) {
    $len = strlen($word);
    $breakdown[$len]++;
    if ($len === 5) $score += 20;
    elseif ($len === 4) $score += 5;
    elseif ($len === 3) $score += 1;
}

echo json_encode(['score' => $score, 'words' => $validWords, 'breakdown' => $breakdown]);
?>
