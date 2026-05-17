<?php
header('Content-Type: application/json');

// --- DATABASE CONNECTION SETTINGS ---
// Update these to match your specific DB credentials in Hostinger
$db_host = '127.0.0.1'; 
$db_user = 'root';      
$db_pass = '';          
$db_name = 'u271511030_word_square';

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
if ($conn->connect_error) {
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

$request_body = file_get_contents('php://input');
$data = json_decode($request_body, true);

if (!isset($data['action'])) {
    echo json_encode(['error' => 'No action specified']);
    exit;
}

// ACTION 1: Fetch Dictionary Words
if ($data['action'] === 'get_dict') {
    $words = [];
    $result = $conn->query("SELECT word FROM dictionary");
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $words[] = strtoupper($row['word']);
        }
    }
    echo json_encode(['words' => $words]);
    exit;
}

// ACTION 2: Save High Score
if ($data['action'] === 'save_score') {
    $initials = substr(strtoupper(preg_replace('/[^A-Z]/', '', $data['initials'] ?? '---')), 0, 3);
    $score = (int)($data['score'] ?? 0);
    $grid = substr($data['grid'] ?? '', 0, 25);
    $today = date('Y-m-d'); 

    // Determine if this is the new #1 score for today
    $is_top_score = false;
    
    // CRITICAL DATABASE FIX: Swapped placeholder with `date` (with backticks to protect reserved keywords).
    $top_stmt = $conn->prepare("SELECT score FROM highscores WHERE DATE(`date`) = ? ORDER BY score DESC LIMIT 1");
    $top_stmt->bind_param("s", $today);
    $top_stmt->execute();
    $top_result = $top_stmt->get_result();
    
    if ($top_result->num_rows === 0) {
        $is_top_score = true; // First score of the day is automatically the top
    } else {
        $top_row = $top_result->fetch_assoc();
        if ($score > (int)$top_row['score']) {
            $is_top_score = true;
        }
    }
    $top_stmt->close();

    // Insert the new score
    $insert_stmt = $conn->prepare("INSERT INTO highscores (initials, score, grid, `date`) VALUES (?, ?, ?, NOW())");
    $insert_stmt->bind_param("sis", $initials, $score, $grid);
    $insert_stmt->execute();
    $insert_stmt->close();

    echo json_encode(['status' => 'success', 'is_top_score' => $is_top_score]);
    exit;
}

// ACTION 3: Retrieve Today's Leaderboard
if ($data['action'] === 'get_highscores') {
    $highscores = [];
    $today = date('Y-m-d');
    
    $stmt = $conn->prepare("SELECT initials, score, grid FROM highscores WHERE DATE(`date`) = ? ORDER BY score DESC LIMIT 10");
    $stmt->bind_param("s", $today);
    $stmt->execute();
    $result = $stmt->get_result();

    while ($row = $result->fetch_assoc()) {
        $highscores[] = [
            'initials' => $row['initials'],
            'score' => (int)$row['score'],
            'grid' => $row['grid']
        ];
    }
    $stmt->close();

    echo json_encode(['highscores' => $highscores]);
    exit;
}

// ACTION 4: Retrieve Yesterday's Winner 
if ($data['action'] === 'get_yesterdays_winner') {
    $yesterday = date('Y-m-d', strtotime('-1 day')); 

    $stmt = $conn->prepare("SELECT initials FROM highscores WHERE DATE(`date`) = ? ORDER BY score DESC LIMIT 1");
    $stmt->bind_param("s", $yesterday);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($row = $result->fetch_assoc()) {
        echo json_encode(['winner_initials' => $row['initials']]);
    } else {
        echo json_encode(['winner_initials' => null]);
    }
    $stmt->close();
    exit;
}

// Catch-all for unrecognized actions
echo json_encode(['error' => 'Invalid action']);
$conn->close();
?>
