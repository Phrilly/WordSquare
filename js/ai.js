'use strict';

let _aiOptimizationHandle = null;

async function runAIOptimizerOnBestGrid(localGridString) {
  if (typeof localGridString !== 'string' || localGridString.length !== GameState.CELL_COUNT) {
    console.error('runAIOptimizerOnBestGrid: invalid localGridString, aborting.');
    return;
  }

  if (_aiOptimizationHandle !== null) {
    cancelAnimationFrame(_aiOptimizationHandle);
    _aiOptimizationHandle = null;
  }

  let targetGridString = localGridString;

  try {
    const response = await fetchWithTimeout('validate.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_highscores' })
    }, 8000);

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}.`);
    }

    const data = await response.json();
    const candidateGrid = data && data.highscores && data.highscores[0] && data.highscores[0].grid;

    if (typeof candidateGrid === 'string' && candidateGrid.length === GameState.CELL_COUNT) {
      targetGridString = candidateGrid;
    } else if (candidateGrid !== undefined) {
      console.warn('runAIOptimizerOnBestGrid: champion grid had unexpected shape, using local fallback.');
    }
  } catch (err) {
    console.error("AI couldn't fetch human champion grid, falling back to local.", err);
  }

  let rawChars, upperChars;
  try {
    rawChars = targetGridString.split('');
    upperChars = rawChars.map(c => c.toUpperCase());
  } catch (err) {
    console.error('runAIOptimizerOnBestGrid: failed to parse target grid string.', err);
    return;
  }

  let bestIndices = Array.from({ length: GameState.CELL_COUNT }, (_, i) => i);
  let bestScore = getScoreForPureGrid(upperChars);
  let currentTestIndices = [...bestIndices];
  let currentTestScore = bestScore;

  const endTime = performance.now() + 1500;

  function computeChunk() {
    try {
      const chunkEnd = performance.now() + 12;

      while (performance.now() < chunkEnd) {
        const candidateIndices = [...currentTestIndices];
        const swaps = Math.floor(Math.random() * 3) + 1;

        for (let i = 0; i < swaps; i++) {
          const a = Math.floor(Math.random() * GameState.CELL_COUNT);
          const b = Math.floor(Math.random() * GameState.CELL_COUNT);
          const temp = candidateIndices[a];
          candidateIndices[a] = candidateIndices[b];
          candidateIndices[b] = temp;
        }

        const mappedChars = candidateIndices.map(idx => upperChars[idx]);
        const score = getScoreForPureGrid(mappedChars);

        if (score >= currentTestScore) {
          currentTestIndices = candidateIndices;
          currentTestScore = score;
          if (score > bestScore) {
            bestScore = score;
            bestIndices = [...candidateIndices];
          }
        } else if (Math.random() < 0.05) {
          currentTestIndices = candidateIndices;
          currentTestScore = score;
        }
      }

      if (performance.now() < endTime) {
        _aiOptimizationHandle = requestAnimationFrame(computeChunk);
      } else {
        _aiOptimizationHandle = null;
        finalizeAiResult(bestScore, bestIndices, rawChars);
      }
    } catch (err) {
      console.error('runAIOptimizerOnBestGrid: computeChunk crashed.', err);
      _aiOptimizationHandle = null;
    }
  }

  _aiOptimizationHandle = requestAnimationFrame(computeChunk);
}

function finalizeAiResult(bestScore, bestIndices, rawChars) {
  try {
    GameState.setAiBestScore(bestScore);
    GameState.setAiBestGrid(bestIndices.map(idx => {
      const char = rawChars[idx];
      const isWild = typeof char === 'string' && char !== char.toUpperCase();
      return { char: (char || '').toUpperCase(), isWild };
    }));
  } catch (err) {
    console.error('finalizeAiResult: failed to persist AI result.', err);
    return;
  }

  const aiRow = document.getElementById('ai-leaderboard-row');
  if (!aiRow) {
    console.warn('finalizeAiResult: #ai-leaderboard-row not found in DOM.');
    return;
  }

  const cupSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="#cbd5e1" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom;"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10"/><path d="M17 4v8a5 5 0 0 1-10 0V4"/><path d="M4 4h3v5H4z"/><path d="M17 4h3v5h-3z"/></svg>`;

  aiRow.title = "Click to view AI's optimal board";
  aiRow.innerHTML = `
    <div class="lb-row-container" style="background: rgba(168, 194, 234, 0.15); border: 1px solid rgba(168, 194, 234, 0.3);">
      <div style="display:flex; align-items:center;">
        <div class="lb-rank">${cupSvg}</div>
        <div class="lb-initials-group"><div class="lb-initial-tile" style="background-color: #a8c2ea;">S</div><div class="lb-initial-tile" style="background-color: #a8c2ea;">t</div><div class="lb-initial-tile" style="background-color: #a8c2ea;">C</div></div>
      </div>
      <div class="lb-score-tile" style="background-color: #4a6c9e;">${escapeHtml(String(GameState.getAiBestScore()))}</div>
    </div>
  `;
  aiRow.style.cursor = 'pointer';

  const newRow = aiRow.cloneNode(true);
  aiRow.replaceWith(newRow);
  newRow.addEventListener('click', showAIBoard);
}

function showAIBoard() {
  const aiBestGrid = GameState.getAiBestGrid();
  if (!Array.isArray(aiBestGrid) || aiBestGrid.length !== GameState.CELL_COUNT) {
    console.warn('showAIBoard: no valid AI grid available yet.');
    return;
  }

  const chars = aiBestGrid.map(t => (t.isWild ? t.char.toLowerCase() : t.char));
  const cupSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="#cbd5e1" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom;"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10"/><path d="M17 4v8a5 5 0 0 1-10 0V4"/><path d="M4 4h3v5H4z"/><path d="M17 4h3v5h-3z"/></svg>`;

  if (typeof showBoardViewer === 'function') {
    showBoardViewer(`${cupSvg} Skerries the Cup ${cupSvg}`, GameState.getAiBestScore(), "StC", chars, 'ai');
  } else {
    console.error('showAIBoard: showBoardViewer is not defined. Ensure leaderboard.js is loaded.');
  }
}