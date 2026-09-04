-- Run once after adding highscores.mode.
--
-- The column was added during the 2026-09-04 Scrabble day. Rows already present
-- at migration time received the default mode 'classic'; correct those rows so
-- the new mode-filtered daily leaderboard does not hide them.
UPDATE highscores
SET mode = 'scrabble'
WHERE created_at >= '2026-09-04 00:00:00'
  AND created_at < '2026-09-05 00:00:00'
  AND mode = 'classic';

-- Verify: this should report only "scrabble" for 2026-09-04.
SELECT mode, COUNT(*) AS row_count
FROM highscores
WHERE created_at >= '2026-09-04 00:00:00'
  AND created_at < '2026-09-05 00:00:00'
GROUP BY mode
ORDER BY mode;
