-- Run against the database selected in your hosting control panel after
-- database/add-highscore-mode.sql, database/boggle-highscores.sql and
-- database/sloggle-highscores.sql and database/add-first-go.sql.
--
-- A read-only common shape for daily winner and recent-winner queries. Detail
-- fields stay in their source tables because main games store a final grid and
-- word events, while Boggle and Sloggle store a multi-round word list.
CREATE OR REPLACE VIEW daily_scores AS
    SELECT id, initials, score, mode, first_go, created_at
    FROM highscores

    UNION ALL

    SELECT id, initials, score, 'boggle' AS mode, first_go, created_at
    FROM boggle_highscores

    UNION ALL

    SELECT id, initials, score, 'sloggle' AS mode, first_go, created_at
    FROM sloggle_highscores;
