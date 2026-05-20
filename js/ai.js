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
        const cupSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="#cbd5e1" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom;"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10"/><path d="M17 4v8a5 5 0 0 1-10 0V4"/><path d="M4 4h3v5H4z"/><path d="M17 4h3v5h-3z"/></svg>`;
        aiRow.title = "Click to view AI's optimal board";
        aiRow.innerHTML = `
          <div class="lb-row-container" style="background: rgba(168, 194, 234, 0.15); border: 1px solid rgba(168, 194, 234, 0.3);">
            <div style="display:flex; align-items:center;">
              <div class="lb-rank">${cupSvg}</div>
              <div class="lb-initials-group"><div class="lb-initial-tile" style="background-color: #a8c2ea;">S</div><div class="lb-initial-tile" style="background-color: #a8c2ea;">t</div><div class="lb-initial-tile" style="background-color: #a8c2ea;">C</div></div>
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
  const cupSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="#cbd5e1" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom;"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10"/><path d="M17 4v8a5 5 0 0 1-10 0V4"/><path d="M4 4h3v5H4z"/><path d="M17 4h3v5h-3z"/></svg>`;
  showBoardViewer(`${cupSvg} AI OPTIMAL ${cupSvg}`, aiBestScore, "StC", chars, 'ai');
}
