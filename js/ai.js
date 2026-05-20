function runAIOptimizerOnBestGrid(bestGridString) {
  let rawChars = bestGridString.split('');
  let upperChars = rawChars.map(c => c.toUpperCase());

  let bestIndices = Array.from({ length: 25 }, (_, i) => i);
  let bestScore = getScoreForPureGrid(upperChars);
  let currentTestIndices = [...bestIndices];
  let currentTestScore = bestScore;

  const endTime = performance.now() + 1500;

  function computeChunk() {
    const chunkEnd = performance.now() + 12;

    while (performance.now() < chunkEnd) {
      let candidateIndices = [...currentTestIndices];
      let swaps = Math.floor(Math.random() * 3) + 1;

      for (let i = 0; i < swaps; i++) {
        let a = Math.floor(Math.random() * 25);
        let b = Math.floor(Math.random() * 25);
        let temp = candidateIndices[a];
        candidateIndices[a] = candidateIndices[b];
        candidateIndices[b] = temp;
      }

      let mappedChars = candidateIndices.map(idx => upperChars[idx]);
      let score = getScoreForPureGrid(mappedChars);

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
      requestAnimationFrame(computeChunk);
    } else {
      aiBestScore = bestScore;
      aiBestGrid = bestIndices.map(idx => {
        let char = rawChars[idx];
        let isWild = char !== char.toUpperCase();
        return { char: char.toUpperCase(), isWild: isWild };
      });

      const aiRow = document.getElementById('ai-leaderboard-row');
      if (aiRow) {
        aiRow.title = "Click to view AI's optimal board";
        aiRow.innerHTML = `
          <div class="lb-row-container" style="background: rgba(168, 194, 234, 0.15); border: 1px solid rgba(168, 194, 234, 0.3);">
            <div style="display:flex; align-items:center;">
              <div class="lb-rank" style="color: var(--highlight);">🤖</div>
              <div class="lb-initials-group"><div class="lb-initial-tile" style="background-color: #a8c2ea;">A</div><div class="lb-initial-tile" style="background-color: #a8c2ea;">I</div><div class="lb-initial-tile" style="background-color: #a8c2ea;">.</div></div>
            </div>
            <div class="lb-score-tile" style="background-color: #4a6c9e;">${aiBestScore}</div>
          </div>
        `;
        aiRow.style.cursor = 'pointer';
        aiRow.addEventListener('click', showAIBoard);
      }
    }
  }

  requestAnimationFrame(computeChunk);
}

function showAIBoard() {
  if (!aiBestGrid || aiBestGrid.length !== 25) return;

  const chars = aiBestGrid.map(t => t.isWild ? t.char.toLowerCase() : t.char);
  showBoardViewer("🤖 AI OPTIMAL 🤖", aiBestScore, "THE AI", chars, 'ai');
}
