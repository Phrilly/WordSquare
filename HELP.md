# WordSquare Help

## Help Version
- Help Version: 1.2.0
- Change Log: 1.2.0 expands mode-specific rules and scoring details (including Scrabble 5-letter-only scoring and Tetris survival bomb top-ups).

## Core Rules
- The board is always 5x5.
- Words can be formed in rows, columns, and diagonals (both directions).
- Letters stay on the board after placement unless removed by a mode mechanic (for example, Tetris clears or bombs).
- Daily games are ranked on mode-specific leaderboards.

## Daily 6-Day Variant Schedule
- Day 0: Bomb
- Day 1: Scrabble
- Day 2: Lookahead
- Day 3: MFD (My First Dictionary)
- Day 4: Tetris
- Day 5: Classic

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
- Double-letter squares apply in Scrabble mode on the dedicated highlighted cells.
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
- If any column reaches the top (no legal drop), the run ends.

## Validation Notes
- All words are validated against the server dictionary.
- Scrabble uses a dedicated 5-letter scoring pass with letter-value math.
- Tetris stores and ranks by its live gameplay score.

For MFD-specific details, see HELP_MFD.md.
