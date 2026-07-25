# WordSquare Help

## Help Version
- Help Version: 1.1.1
- Change Log: 1.1.1 refreshes Tetris UI clarity (larger DROP chevrons, stronger active tile emphasis, and a slightly faded first queue tile).

## Core Rules
- Fill the 5x5 board with letters from the active mode queue/tray.
- Score words found in rows, columns, and diagonals.
- Daily games are ranked on the mode-specific leaderboard.

## Tile Placement Rule Update
- Placed tiles are locked.
- You can no longer delete inserted tiles in normal daily modes.

## Daily 6-Day Variant Schedule
- Day 0: Bomb
- Day 1: Scrabble
- Day 2: Lookahead
- Day 3: MFD (My First Dictionary)
- Day 4: Tetris
- Day 5: Classic

## Turn & Validation Notes
- Words are validated against the active dictionary for that mode.
- MFD mode accepts only dictionary entries marked for MFD.
- Invalid letter placements still remain on the board; scoring depends on completed valid words.

## Scoring Notes
- Classic/Bomb/Lookahead/MFD use standard WordSquare word scoring.
- Scrabble uses per-letter values and board modifiers.
- Tetris uses its own live gameplay scoring model (drops, clears, and chain flow), then saves that verified result.

## Mode Notes
- Classic: Standard WordSquare rules and scoring.
- Bomb: Bomb mechanics are active.
- Scrabble: Uses Scrabble-style letter values.
- Lookahead: Shows additional upcoming queue letters.
- MFD: Classic gameplay with a restricted My First Dictionary word list.
- Tetris: Drop queued letters into columns, clear 4-letter and 5-letter words, and let remaining tiles fall under gravity.

## Tetris Quick Controls
- Click a DROP slot to place the moving letter in that column.
- 4-letter and 5-letter words clear in Tetris mode (rows, columns, diagonals).
- You have 3 bombs per game to remove occupied cells.
- A full column disables its DROP slot; game over occurs when no valid drops remain.

For MFD-specific details, see HELP_MFD.md.
