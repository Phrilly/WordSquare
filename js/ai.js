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

      document.getElementById('view-ai-btn').style.display = 'block';
    }
  }

  requestAnimationFrame(computeChunk);
}

function showAIBoard() {
  if (!aiBestGrid || aiBestGrid.length !== 25) return;

  document.getElementById('leaderboard-modal').classList.remove('active');
  document.getElementById('return-to-menu-btn').style.display = 'none';
  topBarEl.style.opacity = '0';

  setBoardViewerTheme('ai');
  boardViewerTitleEl.innerText = "🤖 AI OPTIMAL 🤖";
  document.getElementById('best-board-score').innerText = aiBestScore;
  document.getElementById('best-board-initials').innerText = "THE AI";

  const bg = document.getElementById('best-grid');
  bg.innerHTML = '';

  let chars = aiBestGrid.map(t => t.char);

  for (let i = 0; i < 25; i++) {
    let c = document.createElement('div');
    c.className = 'grid-cell';
    if (aiBestGrid[i].isWild) c.classList.add('is-wildcard');
    c.innerText = chars[i];
    bg.appendChild(c);
  }

  const bValid = findValidWordsLocalArray(chars);
  const groupedData = buildGroupedWordData(bValid);

  applyColorsToSpecificGrid(groupedData.rawScoringWords, chars, bg);
  renderWordListsForBoard(bValid);
  document.getElementById('best-board-modal').classList.add('active');
}
