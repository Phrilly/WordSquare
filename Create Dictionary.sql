-- Create the database
CREATE DATABASE IF NOT EXISTS word_square;
USE word_square;

-- Create the dictionary table
CREATE TABLE IF NOT EXISTS dictionary (
    word VARCHAR(5) PRIMARY KEY
);

-- Example seed data (You will want to import a full CSV dictionary here)
INSERT IGNORE INTO dictionary (word) VALUES 
('APPLE'), ('APP'), ('TEST'), ('THE'), ('WORD'), ('WORDS'), 
('CAT'), ('DOG'), ('GOLF'), ('CODE'), ('SQL'), ('PHP'), 
('DATA'), ('BASE'), ('LINE'), ('ROWS'), ('COLS'), ('WEB'),
('SITE'), ('HOST'), ('HTML'), ('CSS'), ('BIRD'), ('FISH'), 
('BEAR'), ('LION'), ('TIGER'), ('ANY'), ('WAY'), ('ALL'), ('WIN');
