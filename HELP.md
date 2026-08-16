# WordSquare Help

## Help Version
- Help Version: 1.4.0
- Change Log: 1.4.0 adds Big Boggle, a two-round 5x5 timed mode with cumulative scoring and a British English dictionary.

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
- Day 5: Big Boggle
- Day 6: Classic

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

### Big Boggle (5x5 Time Attack)
- Big Boggle uses a fully populated 5x5 board with a weighted letter distribution. Common vowels and consonants occur more often than rare letters.
- A `Qu` tile contributes `QU` when used in a word.
- Form a word by dragging across tiles or clicking tiles one after another, then submit it.
- Every next tile must touch the preceding tile horizontally, vertically, or diagonally.
- A tile may not be used more than once in one submitted word.
- Words must have at least 4 letters, be in the British English dictionary, and may be found only once per round.
- A match has exactly 2 rounds. Each round lasts 3 minutes, and input locks as soon as its clock reaches 0:00.
- The Round 1 summary lists all found words, the Round 1 score, and the clearly labelled cumulative score before the player starts Round 2.
- Match Complete lists both round scores and the final cumulative total.

| Word length | Points |
| --- | ---: |
| 4 letters | 1 |
| 5 letters | 2 |
| 6 letters | 3 |
| 7 letters | 5 |
| 8+ letters | 11 |

Example: a Round 1 score of 18 and a Round 2 score of 24 produces a cumulative score of `18 + 24 = 42`.

## Validation Notes
- All words are validated against the server dictionary.
- Scrabble uses a dedicated 5-letter scoring pass with letter-value math.
- Tetris stores and ranks by its live gameplay score.
- Big Boggle uses the SCOWL British English (`B`) spelling profile, including spellings such as `COLOUR`, `ORGANISE`, and `THEATRE`.

For MFD-specific details, see HELP_MFD.md.
