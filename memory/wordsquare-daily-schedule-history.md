---
name: wordsquare-daily-schedule-history
description: WordSquare daily variant rotation changed several times (5-day then 7-day), MFD is retired, and Boggle days run the main game as Classic
metadata:
  type: project
---

The WordSquare daily variant rotation is **not** fixed — it changed at least five
times, reconstructed from `git log` on `index.php` (epoch 2026-05-21 UTC):

- **2026-07-14** `08b17be` — MFD added; cycle was **5-day** (`% 5`), MFD on Day 3.
- **2026-08-17** `f6bbe27` — Boggle added; cycle became **7-day** (`% 7`), MFD still Day 3, Boggle Day 6.
- **2026-08-28** `360f472` — MFD retired from the natural cycle; Day 3 became Boggle.
- **2026-08-29** `d20ec20` — Top Up inserted on Day 3; Boggle back to Day 6 only.
- **2026-09-17** (effective date; edited 2026-09-16) — Epoch-offset cycle dropped
  entirely in favor of a pure day-of-week mapping (no more epoch math): Monday
  Classic, Tuesday Lookahead, Wednesday Bomb, Thursday Scrabble, Friday Top Up,
  Saturday Tetris, Sunday Boggle. Dates before 2026-09-17 still resolve through
  the legacy epoch-offset logic, preserved unchanged in both `index.php` and
  `validate.php`'s `getModeForDate()` specifically so historical rows are not
  reinterpreted.

Current rotation (from 2026-09-17): Monday Classic, Tuesday Lookahead, Wednesday
Bomb, Thursday Scrabble, Friday Top Up, Saturday Tetris, Sunday Boggle.

Prior rotation (up to 2026-09-16): Day 0 Bomb, 1 Scrabble, 2 Lookahead, 3 Top Up, 4 Tetris, 5 Classic, 6 Boggle.

**Why:** Any historical analysis (backfilling a `mode` column, computing past
winners) cannot use today's `getModeForDate()` — it would label old Day 3 rows as
`topup` when they were really MFD. Commit dates are also not deploy dates.

**How to apply:** Use date-ranged schedule eras, and prefer data-derived evidence
where possible. Note that classic / bomb / lookahead / MFD all score identically
(recalculated 1/5/20), so confusing those four does not change any winner — only
scrabble, tetris, topup and boggle need to be right.

Related: Boggle is a separate app (`boggle.php` + `js/boggle.js` + own endpoint
`save_boggle_highscore` + own table `boggle_highscores`); `boggle` is deliberately
absent from `normaliseMode()`'s allow-list. On Boggle days `GAME_CONFIG` has no
`isBoggleDay` flag, so the main game falls back to **Classic** and still writes to
`highscores` — so a Boggle day is *not* identified by having no `highscores` rows.

The schedule logic is duplicated in three places that must stay in sync: the
scheduler block in `index.php`, `getModeForDate()` in `validate.php`, and the
help-modal debug helper `getScheduleDebugInfo()` in `js/events.js`. Any future
schedule change must update all three (the 2026-09-17 rollout initially missed
the latter two, breaking `save_score` mode-matching until fixed).

See [[wordsquare-db-and-deployment-notes]].
