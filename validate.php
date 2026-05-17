<?php
header('Content-Type: application/json');
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php-error.log');

try {
    $configFile = __DIR__ . '/config.php';
    if (!file_exists($configFile)) {
        throw new Exception('config.php missing at: ' . $configFile);
    }

    require_once $configFile;

    if (!isset($host, $dbname, $user, $pass)) {
        throw new Exception('config.php does not define $host, $dbname, $user, $pass');
    }

    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $user,
        $pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );

    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);

    if ($raw !== '' && $input === null && json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON: ' . json_last_error_msg());
    }

    echo json_encode([
        'ok' => true,
        'message' => 'validate.php is running',
        'db' => 'connected'
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine()
    ]);
}
