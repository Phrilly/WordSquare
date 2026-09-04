# MFD Help (My First Dictionary) - RETIRED

> **MFD is retired.** It is no longer part of the daily rotation and is not played.
> This file is kept for historic reference only.

## Help Version
- Help Version: 1.3.4
- Change Log: 1.3.4 marks MFD as retired - it no longer appears in the daily rotation.

## What MFD Was
MFD was a daily variant that played exactly like Classic mode.
The only gameplay difference was the dictionary: only words marked as MFD were valid.

## Schedule Placement (historic)
- MFD occupied Day 3 in earlier rotations.
- The daily rotation changed several times: MFD ran on Day 3 under an early 5-day
  cycle, then under the 7-day cycle introduced when Boggle was added.
- MFD was subsequently retired from the natural cycle. Day 3 became Boggle, and
  later Top Up.
- The current rotation is: Day 0 Bomb, Day 1 Scrabble, Day 2 Lookahead,
  Day 3 Top Up, Day 4 Tetris, Day 5 Classic, Day 6 Boggle.
- MFD remains reachable only through the developer `?mode=mfd` override.

## Dictionary Source
- Backend dictionary action: get_dict with mode=mfd
- SQL filter: dictionary.is_mfd = 1

## Scoring and Board Rules
- Same board and placement model as Classic mode.
- Scoring is unchanged from Classic mode:
- 3-letter word: 1 point
- 4-letter word: 5 points
- 5-letter word: 20 points
- Reverse duplicates count as one canonical word for scoring.
- Daily high scores are shown under MFD-specific leaderboard labels.
- MFD leaderboard ranking follows the Classic-style word scoring model.

## Tile Placement Rule
- MFD follows the same placement behavior as Classic mode.

## Validation Notes
- A word must be valid and MFD-flagged to score.
- Non-MFD words are ignored for MFD scoring even if they are valid in other modes.
