<?php
// validate.php
header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 0); // Hide raw HTML errors to ensure clean JSON output

// 1. Check if config.php exists on the server
if (!file_exists('config.php')) {
    http_response_code(500);
    echo json_encode(['error' => 'config.php is missing. Please create it manually in the Hostinger File Manager.']);
    exit;
}

// Pull in the secure credentials
require_once 'config.php';

// 2. Check the database connection
try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed. Check your password in config.php. Details: ' . $e->getMessage()]);
    exit;
}

// Get the JSON payload from the frontend
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['grid']) || count($input['grid']) !== 25) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid grid data submitted.']);
    exit;
}

$cells = $input['grid'];
$gridSize = 5;

// 8-way directional mapping: [row_delta, col_delta]
$directions = [
    [0, 1], [0, -1], [1, 0], [-1, 0], 
    [1, 1], [-1, -1], [-1, 1], [1, -1]
];

// Helper to get letter based on row and col coordinates
function getLetterAt($r, $c, $cells, $gridSize) {
    if ($r >= 0 && $r < $gridSize && $c >= 0 && $c < $gridSize) {
        return $cells[$r * $gridSize + $c];
    }
    return null;
}

$potentialWords = [];

// Scan the grid for all possible letter combinations
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
                
                if (strlen($currentWord) >= 3) {
                    $potentialWords[] = $currentWord;
                }
            }
        }
    }
}

// Remove duplicates to only query unique possibilities
$uniquePotentialWords = array_unique($potentialWords);

if (empty($uniquePotentialWords)) {
    echo json_encode(['score' => 0, 'words' => [], 'breakdown' => [3=>0, 4=>0, 5=>0]]);
    exit;
}

// 3. Validate against the SQL dictionary and catch query errors
try {
    $placeholders = str_repeat('?,', count($uniquePotentialWords) - 1) . '?';
    $sql = "SELECT word FROM dictionary WHERE word IN ($placeholders)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_values($uniquePotentialWords));
    $validWords = $stmt->fetchAll(PDO::FETCH_COLUMN);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database query failed. Did you run the SQL code in phpMyAdmin? Details: ' . $e->getMessage()]);
    exit;
}

// Tally the final score
$score = 0;
$breakdown = [3 => 0, 4 => 0, 5 => 0];

foreach ($validWords as $word) {
    $len = strlen($word);
    $breakdown[$len]++;
    
    if ($len === 5) {
        $score += 20;
    } elseif ($len === 4) {
        $score += 5;
    } elseif ($len === 3) {
        $score += 1;
    }
}

// Return the validated payload to the frontend
echo json_encode([
    'score' => $score,
    'words' => $validWords,
    'breakdown' => $breakdown
]);
?>
