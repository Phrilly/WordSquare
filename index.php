<?php
declare(strict_types=1);

// Prevent the browser and CDN from caching the main page structure
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

// Function to append the file's exact last-modified timestamp
function autoVer(string $url): string {
    if (file_exists(__DIR__ . '/' . $url)) {
        return $url . '?v=' . filemtime(__DIR__ . '/' . $url);
    }
    return $url . '?v=' . time(); // Fallback if file isn't found
}

// VARIANT SCHEDULER: 7-Day Cycle Calculation
$epochTimestamp = strtotime('2026-05-21 00:00:00 UTC'); 
$daysSinceEpoch = (int) floor((time() - $epochTimestamp) / 86400);

// Default cycle logic
$isBombDay      = ($daysSinceEpoch > 0 && $daysSinceEpoch % 7 === 0);       // Day 0
$isScrabbleDay  = ($daysSinceEpoch > 0 && ($daysSinceEpoch - 1) % 7 === 0); // Day 1
$isLookaheadDay = ($daysSinceEpoch > 0 && ($daysSinceEpoch - 2) % 7 === 0); // Day 2
$isCommonDay    = false;                                                    // Day 3 is now Boggle (MFD retired from natural cycle)
$isTetrisDay    = ($daysSinceEpoch > 0 && ($daysSinceEpoch - 4) % 7 === 0); // Day 4
$isBoggleDay    = ($daysSinceEpoch > 0 && (($daysSinceEpoch - 6) % 7 === 0 || ($daysSinceEpoch - 3) % 7 === 0)); // Day 6 & Day 3

// DEV OVERRIDES: Strict Input Validation
$rawQuery = (string)($_SERVER['QUERY_STRING'] ?? '');
if (isset($_GET['mode']) || isset($_GET['']) || $rawQuery === '=boggle') {
    $mode = trim((string)($_GET['mode'] ?? $_GET[''] ?? ($rawQuery === '=boggle' ? 'boggle' : '')));
  if ($mode === 'classic') {
    $isBombDay = false; $isLookaheadDay = false; $isScrabbleDay = false; $isCommonDay = false; $isTetrisDay = false; $isBoggleDay = false;
  } elseif ($mode === 'bomb') {
      $isBombDay = true; $isLookaheadDay = false; $isScrabbleDay = false; $isCommonDay = false; $isTetrisDay = false; $isBoggleDay = false;
    } elseif ($mode === 'lookahead') {
      $isBombDay = false; $isLookaheadDay = true; $isScrabbleDay = false; $isCommonDay = false; $isTetrisDay = false; $isBoggleDay = false;
    } elseif ($mode === 'scrabble') {
      $isBombDay = false; $isLookaheadDay = false; $isScrabbleDay = true; $isCommonDay = false; $isTetrisDay = false; $isBoggleDay = false;
    } elseif ($mode === 'mfd' || $mode === 'common') {
      $isBombDay = false; $isLookaheadDay = false; $isScrabbleDay = false; $isCommonDay = true; $isTetrisDay = false; $isBoggleDay = false;
    } elseif ($mode === 'tetris') {
      $isBombDay = false; $isLookaheadDay = false; $isScrabbleDay = false; $isCommonDay = false; $isTetrisDay = true; $isBoggleDay = false;
    } elseif ($mode === 'boggle') {
      $isBombDay = false; $isLookaheadDay = false; $isScrabbleDay = false; $isCommonDay = false; $isTetrisDay = false; $isBoggleDay = true;
    }
}

if ($isBoggleDay) {
    header('Location: boggle.php', true, 302);
    exit;
}

$modeDisplayName = 'Classic';
if ($isBombDay) {
    $modeDisplayName = 'Bomb';
} elseif ($isScrabbleDay) {
    $modeDisplayName = 'Scrabble';
} elseif ($isLookaheadDay) {
    $modeDisplayName = 'Lookahead';
} elseif ($isCommonDay) {
    $modeDisplayName = 'My First Dictionary';
} elseif ($isTetrisDay) {
  $modeDisplayName = 'Tetris';
}

$leaderboardHeading = $isCommonDay ? "TODAY'S MFD HIGH SCORES" : "TODAY'S HIGH SCORES";
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Word Square - <?= htmlspecialchars($modeDisplayName, ENT_QUOTES, 'UTF-8') ?></title>
  <link rel="icon" href="data:,">

  <link rel="stylesheet" href="<?= autoVer('css/base.css') ?>">
  <link rel="stylesheet" href="<?= autoVer('css/layout.css') ?>">
  <link rel="stylesheet" href="<?= autoVer('css/board.css') ?>">
  <link rel="stylesheet" href="<?= autoVer('css/modals.css') ?>">
  <link rel="stylesheet" href="<?= autoVer('css/leaderboard.css') ?>">
  <link rel="stylesheet" href="<?= autoVer('css/effects.css') ?>">
  <link rel="stylesheet" href="<?= autoVer('css/opening.css') ?>">
  <link rel="stylesheet" href="<?= autoVer('css/responsive.css') ?>">
  <link rel="stylesheet" href="<?= autoVer('css/tryit.css') ?>">
  <link rel="stylesheet" href="<?= autoVer('css/tetris.css') ?>">
  
  <?php if ($isBombDay): ?>
  <link rel="stylesheet" href="<?= autoVer('css/bomb.css') ?>">
  <?php endif; ?>

  <?php if ($isScrabbleDay): ?>
  <link rel="stylesheet" href="<?= autoVer('css/scrabble.css') ?>">
  <?php endif; ?>
  
  <script>
    // Pass PHP state to JS securely
    window.GAME_CONFIG = {
        isBombDay: <?= json_encode($isBombDay) ?>,
        isLookaheadDay: <?= json_encode($isLookaheadDay) ?>,
      isScrabbleDay: <?= json_encode($isScrabbleDay) ?>,
      isCommonDay: <?= json_encode($isCommonDay) ?>,
      isTetrisDay: <?= json_encode($isTetrisDay) ?>,
      modeDisplayName: <?= json_encode($modeDisplayName) ?>
    };
  </script>

  <style>
    .back-arrow {
      position: absolute;
      top: 20px;
      left: 20px;
      font-size: 32px;
      color: #ffffff;
      cursor: pointer;
      font-weight: bold;
      z-index: 10;
      transition: color 0.2s, transform 0.2s;
      font-family: inherit;
    }
    .back-arrow:hover {
      color: var(--highlight, #fde047);
      transform: scale(1.1);
    }
    #best-board-modal #best-grid {
      width: min(80vw, 320px);
      height: min(80vw, 320px);
      margin: 20px auto;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      grid-template-rows: repeat(5, 1fr);
      gap: 5px;
    }
    #best-board-modal #best-grid .grid-cell {
      width: 100%;
      height: 100%;
      font-size: min(6vw, 24px);
      display: flex;
      justify-content: center;
      align-items: center;
    }
  </style>
</head>
<body>
  <div id="loading-screen">
    <div class="spinner"></div>
    <h2>Loading Game Engine...</h2>
  </div>

  <div id="winner-overlay" class="winner-overlay" style="display: none;">
    <h1 class="winner-title">YESTERDAY'S CHAMPION</h1>
    <div id="winner-initials" class="winner-initials"></div>
  </div>

  <button class="arcade-btn mini-btn help-fab" id="open-help-btn" data-help-open="1" type="button" aria-label="Open help">HELP</button>

  <div id="opening-screen" class="opening-screen" style="display:none;">
    <h1 id="opening-title" style="color:var(--highlight); margin-bottom:20px; font-size:clamp(24px, 5vw, 36px); text-align:center;"><?= htmlspecialchars($leaderboardHeading, ENT_QUOTES, 'UTF-8') ?></h1>
    <div class="grid-container opening-grid" id="opening-grid">
      </div>
    <div class="play-button-container" id="play-btn-tiles">
      <div class="grid-cell play-tile">P</div>
      <div class="grid-cell play-tile">L</div>
      <div class="grid-cell play-tile">A</div>
      <div class="grid-cell play-tile">Y</div>
    </div>
  </div>

  <div class="top-bar">
    <div id="left-header" title="Click to open wildcard picker">
      <span id="header-label">Next:</span>

      <?php if ($isTetrisDay): ?>
      <div id="tetris-active-tile" class="tetris-active-tile" aria-live="polite" aria-label="Active tile"></div>
      <?php endif; ?>

      <!-- Classic / Lookahead Queue -->
      <div id="queue-container" class="queue-container">
        <span id="next-letter"></span>
        <span class="queued-letter" id="queue-1"></span>
        <span class="queued-letter" id="queue-2"></span>
      </div>

      <!-- Scrabble Tray -->
      <div id="scrabble-tray" class="scrabble-tray" style="display: none;">
        <div class="tray-cell" data-index="0"></div>
        <div class="tray-cell" data-index="1"></div>
        <div class="tray-cell" data-index="2"></div>
        <div class="tray-cell" data-index="3"></div>
        <div class="tray-cell" data-index="4"></div>
      </div>

    </div>
    <div class="score-stack">
      <div class="score-meta-row">
        <div id="mode-badge" class="mode-badge"><?= htmlspecialchars(strtoupper($modeDisplayName), ENT_QUOTES, 'UTF-8') ?></div>
        <button class="top-help-btn" id="open-help-btn-top" data-help-open="1" type="button" aria-label="Open help">?</button>
      </div>
      <div id="score">0</div>
    </div>
    <div id="tetris-clock" class="tetris-clock" aria-live="polite" aria-atomic="true">
      <span class="tetris-clock-label">CLOCK</span>
      <span id="tetris-clock-value" class="tetris-clock-value">10.0s</span>
    </div>
  </div>

  <div id="tetris-drop-row" class="tetris-drop-row" aria-label="Drop row">
    <button class="drop-slot" type="button" data-col="0" aria-label="Drop into column 1"></button>
    <button class="drop-slot" type="button" data-col="1" aria-label="Drop into column 2"></button>
    <button class="drop-slot" type="button" data-col="2" aria-label="Drop into column 3"></button>
    <button class="drop-slot" type="button" data-col="3" aria-label="Drop into column 4"></button>
    <button class="drop-slot" type="button" data-col="4" aria-label="Drop into column 5"></button>
  </div>

  <div class="grid-container" id="grid">
    <?php if ($isTetrisDay): ?>
    <div class="overlay-modal" id="go-gate-modal" role="dialog" aria-modal="true" aria-label="Start round gate">
      <button id="go-start-btn" class="go-octagon-btn" type="button" aria-label="Start game">GO</button>
      <div class="go-gate-hint">Press GO to start this round.</div>
    </div>
    <?php endif; ?>

    <div class="alphabet-modal" id="alphabet-modal"></div>

    <div class="overlay-modal" id="highscore-entry-modal">
      <h2 style="margin-top:0; color:var(--highlight);">GAME OVER</h2>
      <div style="font-size:20px; margin-bottom:25px;">
        Final Score: <strong id="final-score-display" style="color:var(--highlight)">0</strong>
      </div>

      <div id="daily-save-section">
        <div class="initials-wrapper">
          <input type="text" id="hidden-initials" class="hidden-initials-input" maxlength="3" autocomplete="off">
          <div class="initial-tile" id="init-tile-1"></div>
          <div class="initial-tile" id="init-tile-2"></div>
          <div class="initial-tile" id="init-tile-3"></div>
        </div>
        <button class="arcade-btn" id="submit-score-btn">SAVE SCORE</button>
      </div>

      <div id="non-daily-section" hidden style="margin-top:15px;">
        <p style="color:#ffcccc; font-size:14px; margin-bottom:20px; max-width:250px;">
          Daily Challenge Mode was disabled.<br>Score will not be saved.
        </p>
        <button class="arcade-btn" id="skip-to-leaderboard-btn">VIEW LEADERBOARD</button>
      </div>
    </div>

    <div class="overlay-modal" id="leaderboard-modal">
      <h3 id="leaderboard-title" style="margin-top:0; color:var(--highlight);"><?= htmlspecialchars($leaderboardHeading, ENT_QUOTES, 'UTF-8') ?></h3>
      <ul class="leaderboard-list" id="leaderboard-list"></ul>
      <div class="audit-link-container" style="text-align: center; padding-top: 15px; margin-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.2); width: 100%;">
        <a href="audit.php" target="_blank" style="color: var(--highlight); opacity: 0.8; text-decoration: none; transition: opacity 0.2s;" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.8'">View Today's Game Log</a>
      </div>
      <div class="overlay-actions">
        <button class="arcade-btn" id="play-again-btn">PLAY AGAIN</button>
      </div>
    </div>

    <div class="overlay-modal" id="best-board-modal">
      <div id="back-to-leaderboard-btn" class="back-arrow" title="Back to Leaderboard">&#8592;</div>
      <h2 id="board-viewer-title" class="board-title top-score-mode" style="margin-top:0; padding: 0 40px;">🏆 #1 BOARD 🏆</h2>
      <div id="board-score-line" class="board-score-line top-score-mode">
        Score <strong id="best-board-score" class="glow-gold"></strong> by
        <strong id="best-board-initials" style="color:var(--highlight)"></strong>
      </div>
      <div class="grid-container" id="best-grid" style="pointer-events:none; opacity:1;"></div>
    </div>

    <div class="overlay-modal" id="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-modal-title">
      <h2 id="help-modal-title" style="margin-top:0; color:var(--highlight);">HOW TO PLAY</h2>
      <div id="help-content" class="help-content"></div>
      <div class="overlay-actions">
        <button class="arcade-btn" id="close-help-btn" type="button">CLOSE</button>
      </div>
    </div>
  </div>

  <?php if ($isTetrisDay): ?>
  <div class="tetris-bomb-strip" aria-label="Bombs remaining">
    <div id="tetris-bomb-indicator" class="tetris-bomb-indicator" aria-label="Bombs remaining">
      <span class="tetris-bomb-icon" data-bomb-index="0" aria-hidden="true"></span>
      <span class="tetris-bomb-icon" data-bomb-index="1" aria-hidden="true"></span>
      <span class="tetris-bomb-icon" data-bomb-index="2" aria-hidden="true"></span>
    </div>
  </div>
  <?php endif; ?>

  <?php if (!$isTetrisDay): ?>
  <div id="try-it-panel" class="try-it-panel" role="group" aria-label="Try words">
    <div class="try-it-top">
      <div class="try-it-header">TRY IT!</div>
      <button id="try-it-clear-btn" class="try-it-clear-btn" type="button" aria-label="Clear TRY IT letters">CLEAR</button>
    </div>

    <div class="try-row" id="try-forward-row">
      <div class="try-row-head">
        <span class="try-row-label">Forward</span>
        <span id="try-forward-status" class="try-row-status">Type 3-5 letters</span>
      </div>
      <div class="try-tiles" id="try-forward-tiles" aria-label="Forward word preview"></div>
    </div>

    <div class="try-row" id="try-reverse-row">
      <div class="try-row-head">
        <span class="try-row-label">Mirror (Reverse)</span>
        <span id="try-reverse-status" class="try-row-status">Type 3-5 letters</span>
      </div>
      <div class="try-tiles" id="try-reverse-tiles" aria-label="Reverse word preview"></div>
    </div>

    <div class="try-it-hint" id="try-it-hint">Type letters on your keyboard. Backspace deletes.</div>

    <input id="try-it-input" class="try-it-input" type="text" inputmode="latin" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="5" aria-label="Type up to 5 letters to test dictionary words">
  </div>
  <?php endif; ?>

  <div class="version-tag">Version Dynamic Auto-Versioning</div>

  <script src="<?= autoVer('js/state.js') ?>" defer></script>
  <script src="<?= autoVer('js/utils.js') ?>" defer></script>
  <script src="<?= autoVer('js/render.js') ?>" defer></script>
  <script src="<?= autoVer('js/gameplay.js') ?>" defer></script>
  
  <?php if ($isBombDay): ?>
  <script src="<?= autoVer('js/gameplay-bomb.js') ?>" defer></script>
  <?php endif; ?>

  <?php if ($isScrabbleDay): ?>
  <script src="<?= autoVer('js/gameplay-scrabble.js') ?>" defer></script>
  <?php endif; ?>

  <?php if ($isLookaheadDay): ?>
  <script src="<?= autoVer('js/gameplay-lookahead.js') ?>" defer></script>
  <?php endif; ?>

  <?php if ($isCommonDay): ?>
  <script src="<?= autoVer('js/gameplay-common.js') ?>" defer></script>
  <?php endif; ?>

  <?php if ($isTetrisDay): ?>
  <script src="<?= autoVer('js/gameplay-tetris.js') ?>" defer></script>
  <?php endif; ?>
  
  <script src="<?= autoVer('js/leaderboard.js') ?>" defer></script>
  <script src="<?= autoVer('js/ai.js') ?>" defer></script>
  <script src="<?= autoVer('js/startup.js') ?>" defer></script>
  <script src="<?= autoVer('js/try-it.js') ?>" defer></script>
  <script src="<?= autoVer('js/events.js') ?>" defer></script>
</body>
</html>
