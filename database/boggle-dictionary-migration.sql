-- Big Boggle dictionary migration
-- Run once before database/import-boggle-dictionary.php.
-- The existing dictionary table remains the source for every game mode.

ALTER TABLE dictionary MODIFY word VARCHAR(25) NOT NULL;

-- Existing installations use this column for MFD filtering. Add it only if it
-- is not already present; MySQL does not support portable IF NOT EXISTS here.
-- ALTER TABLE dictionary ADD COLUMN is_mfd TINYINT(1) NOT NULL DEFAULT 0;
