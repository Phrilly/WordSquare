-- Run this against the database already selected by your shared-hosting panel.

CREATE TABLE IF NOT EXISTS dictionary (
    word VARCHAR(25) NOT NULL,
    is_mfd TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (word)
);

-- Example seed data. Import data/boggle-uk-scowl-60.txt with
-- database/import-boggle-dictionary.php for the full Big Boggle corpus.
INSERT IGNORE INTO dictionary (word) VALUES
    ('APPLE'), ('APP'), ('TEST'), ('THE'), ('WORD'), ('WORDS'),
    ('CAT'), ('DOG'), ('GOLF'), ('CODE'), ('SQL'), ('PHP'),
    ('DATA'), ('BASE'), ('LINE'), ('ROWS'), ('COLS'), ('WEB'),
    ('SITE'), ('HOST'), ('HTML'), ('CSS'), ('BIRD'), ('FISH'),
    ('BEAR'), ('LION'), ('TIGER'), ('ANY'), ('WAY'), ('ALL'), ('WIN');
