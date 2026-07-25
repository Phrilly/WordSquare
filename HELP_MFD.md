# MFD Help (My First Dictionary)

## Help Version
- Help Version: 1.2.3
- Change Log: 1.2.3 adds stronger bomb-refresh blast highlight and updates help notes.

## What MFD Is
MFD is a daily variant that plays exactly like Classic mode.
The only gameplay difference is the dictionary: only words marked as MFD are valid.

## Schedule Placement
- MFD appears on Day 3 in the 6-day daily rotation.
- Day 4 is Tetris and Day 5 is Classic.

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
