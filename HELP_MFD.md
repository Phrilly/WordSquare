# MFD Help (My First Dictionary)

## What MFD Is
MFD is a daily variant that plays exactly like Classic mode.
The only gameplay difference is the dictionary: only words marked as MFD are valid.

## Dictionary Source
- Backend dictionary action: get_dict with mode=mfd
- SQL filter: dictionary.is_mfd = 1

## Scoring and Board Rules
- Same board, placement, and scoring model as Classic mode.
- Daily high scores are shown under MFD-specific leaderboard labels.

## Tile Placement Rule
- In normal modes, placed tiles cannot be deleted.
- MFD follows the same no-delete behavior as Classic.
