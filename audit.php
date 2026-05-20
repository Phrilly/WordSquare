<?php
declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/php-error.log');

$logs = [];
$error = null;

if (!file_exists(__DIR__ . '/config.php')) {
    $error = 'Configuration file (config.php) is missing.';
} else {
    require_once __DIR__ . '/config.php';

    if (!isset($host, $dbname, $user, $pass)) {
        $error = 'Database configuration variables are missing in config.php.';
    } else {
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

            $stmt = $pdo->query("
                SELECT session_id, game_seed, is_daily, daily_offset, final_score, grid, created_at
                FROM game_log
                WHERE DATE(created_at) = CURDATE()
                ORDER BY created_at DESC
            ");
            $logs = $stmt->fetchAll();

        } catch (PDOException $e) {
            $error = 'Database Error: ' . $e->getMessage();
            error_log('audit.php DB connection/query failed: ' . $e->getMessage());
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Word Square - Daily Audit</title>
    <style>
        :root {
            --background: #0f172a;
            --surface: #1e293b;
            --text-primary: #e2e8f0;
            --text-secondary: #94a3b8;
            --highlight: #fde047;
            --border: #334155;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--background);
            color: var(--text-primary);
            margin: 0;
            padding: 20px;
        }
        h1 {
            text-align: center;
            color: var(--highlight);
            margin-bottom: 30px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            overflow-x: auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            white-space: nowrap;
        }
        th, td {
            border: 1px solid var(--border);
            padding: 10px 15px;
            text-align: left;
        }
        th {
            background-color: var(--surface);
        }
        tbody tr {
            cursor: pointer;
        }
        tbody tr:hover {
            background-color: #28364d;
        }
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(15, 23, 42, 0.8);
            backdrop-filter: blur(5px);
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .modal-content {
            background-color: var(--surface);
            padding: 30px;
            border: 1px solid var(--border);
            border-radius: 8px;
            width: auto;
            max-width: 500px;
            text-align: center;
        }
        #board-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 5px;
            width: 300px;
            height: 300px;
            margin: 20px auto;
        }
        .grid-cell {
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 24px;
            font-weight: bold;
            background-color: #475569;
            border-radius: 4px;
            text-transform: uppercase;
        }
        .is-wildcard {
            background-color: var(--highlight);
            color: var(--surface);
        }
        .error-box {
            background-color: #7f1d1d;
            color: #fecaca;
            border: 1px solid #ef4444;
            padding: 15px;
            border-radius: 5px;
            margin: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Game Audit - Today</h1>
        <?php if ($error): ?>
            <div class="error-box"><?= htmlspecialchars($error) ?></div>
        <?php elseif (empty($logs)): ?>
            <p style="text-align:center;">No games have been logged today.</p>
        <?php else: ?>
            <table>
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Session ID</th>
                        <th>Score</th>
                        <th>Seed</th>
                        <th>Daily</th>
                        <th>Offset</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($logs as $log): ?>
                        <tr class="log-row" data-grid="<?= htmlspecialchars($log['grid']) ?>" data-score="<?= $log['final_score'] ?>">
                            <td><?= date('H:i:s', strtotime($log['created_at'])) ?></td>
                            <td><?= htmlspecialchars($log['session_id']) ?></td>
                            <td><?= htmlspecialchars($log['final_score']) ?></td>
                            <td><?= htmlspecialchars($log['game_seed']) ?></td>
                            <td><?= $log['is_daily'] ? 'Yes' : 'No' ?></td>
                            <td><?= htmlspecialchars($log['daily_offset']) ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </div>

    <div id="board-viewer-modal" style="display:none;">
        <div class="modal-content">
            <h2>Completed Board <span style="font-size:16px; color: var(--text-secondary);">(Score: <strong id="board-score" style="color: var(--highlight);"></strong>)</span></h2>
            <div id="board-grid"></div>
        </div>
    </div>

    <script>
    document.addEventListener('DOMContentLoaded', () => {
        const modal = document.getElementById('board-viewer-modal');
        const boardGridEl = document.getElementById('board-grid');
        const boardScoreEl = document.getElementById('board-score');

        document.querySelectorAll('.log-row').forEach(row => {
            row.addEventListener('click', () => {
                const gridString = row.dataset.grid;
                const score = row.dataset.score;

                boardGridEl.innerHTML = '';
                boardScoreEl.innerText = score;

                for (let i = 0; i < gridString.length; i++) {
                    const char = gridString[i];
                    const cell = document.createElement('div');
                    cell.className = 'grid-cell';
                    cell.innerText = char;
                    if (char === char.toLowerCase() && char !== char.toUpperCase()) {
                        cell.classList.add('is-wildcard');
                    }
                    boardGridEl.appendChild(cell);
                }
                modal.style.display = 'flex';
            });
        });

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    </script>
</body>
</html>