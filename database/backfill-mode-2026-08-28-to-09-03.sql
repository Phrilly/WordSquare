-- Backfill the highscores.mode column for the seven completed days
-- 2026-08-28 .. 2026-09-03.
--
-- Run against the database selected in your hosting control panel.
--
-- Every label below is unambiguous. The daily rotation only ever disagreed
-- about Day 3 (MFD -> Boggle -> Top Up), and the Day 3 date inside this
-- window (2026-08-30) falls after Top Up was inserted on 2026-08-29, so it
-- is Top Up regardless of which era is applied.
--
-- 2026-09-02 (cycle day 6, Boggle) is deliberately EXCLUDED: Boggle scores are
-- recorded in boggle_highscores, never highscores. Any highscores row on that
-- date is a stray (developer ?mode= override, or a game finishing across the
-- UTC midnight boundary) and is left untouched for manual review.
--
-- Date       cycle day  mode
-- 2026-08-28     1      scrabble
-- 2026-08-29     2      lookahead
-- 2026-08-30     3      topup
-- 2026-08-31     4      tetris
-- 2026-09-01     5      classic
-- 2026-09-02     6      boggle  (excluded - see above)
-- 2026-09-03     0      bomb


-- STEP 1: dry run. Confirm row counts before writing anything.
SELECT DATE(created_at) AS game_date,
       COUNT(*) AS rows_total,
       SUM(CASE WHEN mode <> 'classic' THEN 1 ELSE 0 END) AS already_labelled
FROM highscores
WHERE DATE(created_at) BETWEEN '2026-08-28' AND '2026-09-03'
GROUP BY DATE(created_at)
ORDER BY game_date;


-- STEP 2: review any strays on the Boggle day before proceeding.
SELECT id, initials, score, grid, created_at
FROM highscores
WHERE DATE(created_at) = '2026-09-02';


-- STEP 3: apply the labels.
UPDATE highscores
SET mode = CASE DATE(created_at)
    WHEN '2026-08-28' THEN 'scrabble'
    WHEN '2026-08-29' THEN 'lookahead'
    WHEN '2026-08-30' THEN 'topup'
    WHEN '2026-08-31' THEN 'tetris'
    WHEN '2026-09-01' THEN 'classic'
    WHEN '2026-09-03' THEN 'bomb'
END
WHERE DATE(created_at) BETWEEN '2026-08-28' AND '2026-09-03'
  AND DATE(created_at) <> '2026-09-02';


-- STEP 4: verify. Each date should report exactly one mode.
-- NOTE: ROWS is a reserved word in MariaDB/MySQL, hence "row_count".
SELECT DATE(created_at) AS game_date, mode, COUNT(*) AS row_count
FROM highscores
WHERE DATE(created_at) BETWEEN '2026-08-28' AND '2026-09-03'
GROUP BY DATE(created_at), mode
ORDER BY game_date, mode;


-- ROLLBACK - valid only while every pre-existing row is still 'classic'.
-- UPDATE highscores
-- SET mode = 'classic'
-- WHERE DATE(created_at) BETWEEN '2026-08-28' AND '2026-09-03'
--   AND DATE(created_at) <> '2026-09-02';
