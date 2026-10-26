-- Run against the database selected in your hosting control panel (the one config.php points at).
-- Adds the "first go of the day" marker to all three score tables.
-- Run each statement ONCE, then re-run database/daily-scores-view.sql.
-- Existing rows stay 0 (not marked), so only new scores can carry the marker.
ALTER TABLE highscores ADD COLUMN first_go TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE boggle_highscores ADD COLUMN first_go TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE sloggle_highscores ADD COLUMN first_go TINYINT(1) NOT NULL DEFAULT 0;
