-- Creates the new table for auditing game sessions
CREATE TABLE IF NOT EXISTS game_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(32) NOT NULL,
    game_seed BIGINT NOT NULL,
    is_daily BOOLEAN NOT NULL,
    daily_offset INT NOT NULL,
    final_score INT NOT NULL,
    grid VARCHAR(25) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);