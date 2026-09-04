<?php
declare(strict_types=1);

// Cross-check: the shared PHP scorer and the live JavaScript scorer must produce
// identical scores and identical per-word breakdowns for every fixture grid.

$phpOutput = shell_exec('php ' . escapeshellarg(__DIR__ . '/tools_test_scoring.php') . ' 2>&1');
$jsOutput = shell_exec('node ' . escapeshellarg(__DIR__ . '/tools_test_scoring.js') . ' 2>&1');

if (!is_string($phpOutput) || !is_string($jsOutput)) {
    fwrite(STDERR, 'Unable to run one of the harnesses.' . PHP_EOL);
    exit(1);
}

$normalise = static function (string $output): array {
    return array_values(array_filter(array_map('trim', explode("\n", $output)), 'strlen'));
};

$phpLines = $normalise($phpOutput);
$jsLines = $normalise($jsOutput);

if (count($phpLines) !== count($jsLines)) {
    fwrite(STDERR, 'Row count differs: php=' . count($phpLines) . ' js=' . count($jsLines) . PHP_EOL);
    exit(1);
}

$failures = 0;

foreach ($phpLines as $index => $phpLine) {
    $jsLine = $jsLines[$index];

    if ($phpLine !== $jsLine) {
        $failures++;
        echo 'MISMATCH:' . PHP_EOL . '  php=[' . $phpLine . ']' . PHP_EOL . '  js =[' . $jsLine . ']' . PHP_EOL;
        continue;
    }

    // Independent invariant: the breakdown must add up to the total, and every
    // reported word must be a five-letter word.
    [$label, $score, $eventList] = array_pad(explode('|', $phpLine, 3), 3, '');
    $total = 0;
    foreach (array_filter(explode(';', $eventList)) as $event) {
        [$word, $points] = array_pad(explode(':', $event, 2), 2, '0');
        if (strlen($word) !== 5) {
            $failures++;
            echo 'BAD WORD LENGTH in ' . $label . ': ' . $word . PHP_EOL;
        }
        $total += (int)$points;
    }

    if ($total !== (int)$score) {
        $failures++;
        echo 'TOTAL MISMATCH in ' . $label . ': events=' . $total . ' score=' . $score . PHP_EOL;
    }

    echo 'ok  ' . $label . ' -> score ' . $score . ' [' . $eventList . ']' . PHP_EOL;
}

if ($failures > 0) {
    echo 'FAILED: ' . $failures . ' problem(s).' . PHP_EOL;
    exit(1);
}

echo 'PASS: PHP and JavaScript scoring agree and every breakdown sums to its score.' . PHP_EOL;
