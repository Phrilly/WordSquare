# WordSquare Help

## Help Version
- Help Version: 1.3.1
- Change Log: 1.3.1 fixes Scrabble leaderboard score ranking for random DL/DW boards and updates help notes.

## Core Rules
- The board is always 5x5.
- Words can be formed in rows, columns, and diagonals (both directions).
- Letters stay on the board after placement unless removed by a mode mechanic (for example, Tetris clears or bombs).
- Daily games are ranked on mode-specific leaderboards.

## Daily 7-Day Variant Schedule
- Day 0: Bomb
- Day 1: Scrabble
- Day 2: Lookahead
- Day 3: MFD (My First Dictionary)
- Day 4: Tetris
- Day 5: Classic
- Day 6: Big Boggle

## Classic / Bomb / Lookahead / MFD Scoring
- 3-letter word: 1 point
- 4-letter word: 5 points
- 5-letter word: 20 points
- Word + reverse count as one canonical word for scoring.

## Variant Rules

### Classic
- Standard queue play.
- Uses standard scoring (1 / 5 / 20).

### Bomb
- Standard scoring (1 / 5 / 20).
- Three hidden bomb cells exist on the board.
- Clicking a hidden bomb consumes the current queued letter (it is burned) instead of placing that letter on the board.
- Bomb mode deck includes extra draws so the game can still reach a full board after bomb burns.

### Lookahead
- Standard scoring (1 / 5 / 20).
- Shows additional upcoming queue letters so you can plan ahead.
- No extra scoring modifiers beyond Classic.

### Scrabble
- Only 5-letter words score.
- 3-letter and 4-letter words do not score in Scrabble mode.
- Score is the sum of Scrabble letter values along each valid 5-letter word path.
- Wildcard tiles (?) are worth 0 points.
- Double-letter (DL) squares double the value of letters placed on them.
- Double-word (DW) squares double the entire word score when a 5-letter word passes through them.
- Special square configuration: 50% chance of 4 DL squares, 50% chance of 2 DL + 1 DW squares.
- All special squares (DL and DW) are separated by at least one square horizontally and vertically.
- If the same canonical word appears in multiple paths, the best-scoring path is used.

### MFD (My First Dictionary)
- Gameplay and scoring are the same as Classic (1 / 5 / 20).
- Only words flagged as MFD in the dictionary are valid.

### Tetris
- You place letters by dropping into columns from the top drop row.
- Only 4-letter and 5-letter words clear in Tetris mode.
- 4-letter clear: 5 points.
- 5-letter clear: 20 points.
- Cleared letters are removed, then gravity pulls letters down.
- Turn timer starts at 10.0s and drops by 0.2s per round to a 2.8s minimum.
- You start with 3 bombs; one bomb removes one occupied tile.
- Survival top-up: +1 bomb every 60 seconds survived, up to the cap of 3.
- Bomb top-up cue: a bright strip blast, icon flash/pop, expanding rings, and a +1 BOMB READY label near the bomb bar.
- If any column reaches the top (no legal drop), the run ends.

### Big Boggle
- Big Boggle uses a fixed 5x5 weighted-letter board for each of three two-minute rounds.
- All players receive the same three boards for the UTC day; Play Again repeats them for fair comparison.
- Form words by joining horizontally, vertically, or diagonally adjacent tiles without reusing a tile.
- Words must contain at least four letters.
- 4 letters score 1, 5 score 2, 6 score 3, 7 score 5, and 8 or more score 11.
- Desktop: click the first tile, glide across adjacent tiles, then click the final tile to submit.
- Mobile: tap the final selected tile again to submit.
- A green outline marks the first tile of an active desktop path; a gold outline marks the final tile before submission.
- Double-click the same board tile to abandon a selected path. Backspace removes one tile and X clears the full path.
- Invalid dictionary words receive red outlines. Duplicate words receive yellow outlines. Click any tile to clear a rejected path.
- SCORES ends an unsaved match and opens the daily high-score table.

## Validation Notes
- All words are validated against the server dictionary.
- Scrabble uses a dedicated 5-letter scoring pass with letter-value math.
- Tetris stores and ranks by its live gameplay score.

For MFD-specific details, see HELP_MFD.md.
