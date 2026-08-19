<?php
declare(strict_types=1);

function autoVer(string $url): string
{
    $path = __DIR__ . '/' . $url;
    return $url . '?v=' . (file_exists($path) ? filemtime($path) : time());
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Word Square - Boggle</title>
  <link rel="stylesheet" href="<?= htmlspecialchars(autoVer('css/base.css'), ENT_QUOTES, 'UTF-8') ?>">
  <link rel="stylesheet" href="<?= htmlspecialchars(autoVer('css/board.css'), ENT_QUOTES, 'UTF-8') ?>">
  <link rel="stylesheet" href="<?= htmlspecialchars(autoVer('css/leaderboard.css'), ENT_QUOTES, 'UTF-8') ?>">
  <link rel="stylesheet" href="<?= htmlspecialchars(autoVer('css/modals.css'), ENT_QUOTES, 'UTF-8') ?>">
  <link rel="stylesheet" href="<?= htmlspecialchars(autoVer('css/effects.css'), ENT_QUOTES, 'UTF-8') ?>">
  <link rel="stylesheet" href="<?= htmlspecialchars(autoVer('css/boggle.css'), ENT_QUOTES, 'UTF-8') ?>">
</head>
<body class="boggle-page">
  <main class="boggle-app">
    <header class="boggle-header">
      <div>
        <div class="boggle-label">BOGGLE</div>
        <div id="boggle-round"><span>ROUND</span><span id="round-val">1</span><span>OF</span><span>3</span></div>
      </div>
      <div>
        <div class="boggle-label">CUMULATIVE</div>
        <output id="boggle-score">0</output>
      </div>
      <div>
        <div class="boggle-label">TIME</div>
        <button id="boggle-timer" type="button" aria-label="Open detailed high scores" title="Open detailed high scores">
          <span id="timer-min" class="mini-tile header-tile">2</span>
          <span class="timer-separator" aria-hidden="true">:</span>
          <span id="timer-sec1" class="mini-tile header-tile">0</span>
          <span id="timer-sec2" class="mini-tile header-tile">0</span>
        </button>
      </div>
      <button id="boggle-help-button" class="arcade-btn mini-btn boggle-help-button" type="button" aria-label="Open Boggle help" title="Help">?</button>
    </header>
    <section class="boggle-preview" aria-label="Current word">
      <div class="boggle-preview-row">
        <div id="boggle-preview-tiles" class="boggle-preview-tiles"></div>
        <div class="boggle-controls">
          <button id="boggle-backspace" class="arcade-btn mini-btn boggle-icon-button" type="button" aria-label="Remove last tile" title="Remove last tile">&#9003;</button>
          <button id="boggle-clear" class="arcade-btn mini-btn mini-btn-warn boggle-icon-button" type="button" aria-label="Clear word" title="Clear word">&#215;</button>
        </div>
      </div>
      <p id="boggle-status" role="status" aria-live="polite">Loading British English dictionary...</p>
    </section>
    <section id="boggle-grid" class="grid-container boggle-grid" aria-label="Boggle letter board">
      <section id="boggle-summary" class="boggle-summary" hidden aria-live="polite"></section>
      <section id="boggle-help-modal" class="boggle-help-modal" hidden aria-modal="true" aria-label="Boggle rules">
        <h2>HOW TO PLAY</h2>
        <ul>
          <li><strong>Dictionary:</strong> boggle-uk-game v1.0</li>
          <li>SCOWL-derived UK game dictionary. Proper nouns, offensive entries, and non-game words are filtered out.</li>
          <li>UK spellings are normalised: COLOUR, ORGANISE, THEATRE.</li>
          <li>Play three two-minute rounds on 5x5 boards.</li>
          <li>Join touching tiles horizontally, vertically, or diagonally. Do not reuse a tile.</li>
          <li>Words need at least four letters: 4 = 1, 5 = 2, 6 = 3, 7 = 5, 8+ = 11 points.</li>
          <li>Desktop: click the first tile, glide through the path, then click the final tile.</li>
          <li>Mobile: tap the final selected tile again to submit.</li>
          <li>The first tile is green while a desktop path is active; the final clicked tile is gold.</li>
          <li>Backspace removes one tile. Press Escape on desktop, press and hold any board tile on touch devices, or use X to clear the full selection.</li>
          <li>Invalid words show red outlines. Already-found words show yellow outlines. Click any tile to clear either rejected path.</li>
          <li>Every player receives the same three daily boards.</li>
        </ul>
        <button id="boggle-close-help" class="arcade-btn" type="button">CLOSE</button>
      </section>
    </section>
    <section class="boggle-found" aria-labelledby="boggle-found-title">
      <h2 id="boggle-found-title">WORDS FOUND</h2>
      <ul id="boggle-found-list"></ul>
    </section>
  </main>
  <script src="<?= htmlspecialchars(autoVer('js/boggle.js'), ENT_QUOTES, 'UTF-8') ?>" defer></script>
</body>
</html>
