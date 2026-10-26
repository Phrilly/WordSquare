-- Run against the database selected in your hosting control panel (the one config.php points at).
-- Sloggle (Slow Boggle, 5 minutes per round) keeps its own scores, separate from Boggle.
-- Run this BEFORE database/daily-scores-view.sql.
CREATE TABLE IF NOT EXISTS sloggle_highscores (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    initials CHAR(3) NOT NULL,
    score INT UNSIGNED NOT NULL,
    words_json MEDIUMTEXT NOT NULL,
    round_scores VARCHAR(64) NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_sloggle_highscores_created_score (created_at, score)
);
