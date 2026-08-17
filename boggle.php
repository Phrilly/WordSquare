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
  <title>Word Square - Big Boggle Sandbox</title>
  <link rel="stylesheet" href="<?= htmlspecialchars(autoVer('css/base.css'), ENT_QUOTES, 'UTF-8') ?>">
  <link rel="stylesheet" href="<?= htmlspecialchars(autoVer('css/boggle.css'), ENT_QUOTES, 'UTF-8') ?>">
</head>
<body class="boggle-page">
  <main class="boggle-app">
    <header class="boggle-header">
      <div><div class="boggle-label">BIG BOGGLE SANDBOX</div><div id="boggle-round">ROUND 1 OF 2</div></div>
      <div><div class="boggle-label">CUMULATIVE</div><output id="boggle-score">0</output></div>
      <div><div class="boggle-label">TIME</div><time id="boggle-timer">3:00</time></div>
    </header>
    <section class="boggle-preview" aria-label="Current word">
      <div id="boggle-preview-tiles" class="boggle-preview-tiles"></div>
      <p id="boggle-status" role="status" aria-live="polite">Loading British English dictionary...</p>
    </section>
    <section id="boggle-grid" class="boggle-grid" aria-label="Boggle letter board"></section>
    <div class="boggle-controls">
      <button id="boggle-backspace" class="arcade-btn mini-btn" type="button">BACKSPACE</button>
      <button id="boggle-clear" class="arcade-btn mini-btn mini-btn-warn" type="button">CLEAR</button>
      <button id="boggle-enter" class="arcade-btn mini-btn" type="button">ENTER WORD</button>
    </div>
    <section class="boggle-found" aria-labelledby="boggle-found-title">
      <h2 id="boggle-found-title">WORDS FOUND</h2>
      <ul id="boggle-found-list"></ul>
    </section>
    <section id="boggle-summary" class="boggle-summary" hidden aria-live="polite"></section>
  </main>
  <script src="<?= htmlspecialchars(autoVer('js/boggle.js'), ENT_QUOTES, 'UTF-8') ?>" defer></script>
</body>
</html>
