-- Run against the database selected in your hosting control panel.
CREATE TABLE IF NOT EXISTS boggle_highscores (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    initials CHAR(3) NOT NULL,
    score INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_boggle_highscores_created_score (created_at, score)
);
