<?php
declare(strict_types=1);

// Cross-check: the server layout generator and the browser layout generator must
// produce identical output for every daily seed.

require_once __DIR__ . '/scrabble.php';

$seedCount = 200;

$phpLines = [];
for ($seed = 1; $seed <= $seedCount; $seed++) {
    $layout = generateScrabbleSpecialSquares($seed);
    $phpLines[] = $seed . '|' . implode(',', $layout['dl']) . '|' . implode(',', $layout['dw']);
}

$jsOutput = shell_exec('node ' . escapeshellarg(__DIR__ . '/tools_test_layout.js') . ' 2>&1');
if (!is_string($jsOutput)) {
    fwrite(STDERR, 'Unable to run the JavaScript harness.' . PHP_EOL);
    exit(1);
}

$jsLines = array_values(array_filter(array_map('trim', explode("\n", $jsOutput)), 'strlen'));
if (count($jsLines) !== $seedCount) {
    fwrite(STDERR, 'JavaScript harness returned ' . count($jsLines) . ' rows, expected ' . $seedCount . '.' . PHP_EOL);
    exit(1);
}

$mismatches = 0;
for ($i = 0; $i < $seedCount; $i++) {
    if ($phpLines[$i] !== $jsLines[$i]) {
        $mismatches++;
        if ($mismatches <= 10) {
            echo 'MISMATCH seed row ' . ($i + 1) . ': php=[' . $phpLines[$i] . '] js=[' . $jsLines[$i] . ']' . PHP_EOL;
        }
    }
}

if ($mismatches > 0) {
    echo 'FAILED: ' . $mismatches . ' of ' . $seedCount . ' seeds differ.' . PHP_EOL;
    exit(1);
}

echo 'PASS: PHP and JavaScript layouts match for all ' . $seedCount . ' seeds.' . PHP_EOL;
