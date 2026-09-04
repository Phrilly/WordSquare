-- Run once after database/add-highscore-mode.sql.
--
-- Winner and leaderboard queries filter by mode equality and then by a UTC date
-- range. Putting mode first lets MariaDB use both parts of the index efficiently.
ALTER TABLE highscores
    DROP INDEX idx_highscores_created_mode,
    ADD INDEX idx_highscores_mode_created (mode, created_at);
