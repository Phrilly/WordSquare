-- Run against the database selected in your hosting control panel.
-- Records which daily game mode each submitted score belongs to.
-- Existing rows default to 'classic' and are corrected by the backfill script.
ALTER TABLE highscores
    ADD COLUMN IF NOT EXISTS mode VARCHAR(16) NOT NULL DEFAULT 'classic' AFTER initials;

-- One-shot: plain MySQL has no ADD INDEX IF NOT EXISTS, so re-running errors.
ALTER TABLE highscores
    ADD INDEX idx_highscores_created_mode (created_at, mode);
