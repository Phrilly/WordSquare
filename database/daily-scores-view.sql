-- Run against the database selected in your hosting control panel after
-- database/add-highscore-mode.sql and database/boggle-highscores.sql.
--
-- A read-only common shape for daily winner and recent-winner queries. Detail
-- fields stay in their source tables because main games store a final grid and
-- word events, while Boggle stores a multi-round word list.
CREATE OR REPLACE VIEW daily_scores AS
    SELECT id, initials, score, mode, created_at
    FROM highscores

    UNION ALL

    SELECT id, initials, score, 'boggle' AS mode, created_at
    FROM boggle_highscores;
