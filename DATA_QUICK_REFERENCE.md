# Historic Data - Quick Reference Guide

## Do we have full historic data?
✅ **YES** - Complete historic recording of all player scores and games.

---

## What Data Is Stored?

### 1. Score Records (`highscores` table)
- **What:** Every submitted score from daily games
- **Fields:** Player initials, score, game grid, word breakdown, timestamp
- **Coverage:** Classic, Bomb, Scrabble, Lookahead, Tetris, TopUp modes
- **Retention:** Permanent (all history preserved)

### 2. Game Sessions (`game_log` table)
- **What:** Complete record of every game played
- **Fields:** Session ID, game seed, score, grid, timestamp
- **Coverage:** All games, including non-scored attempts
- **Purpose:** Proof/audit trail, cheating prevention

### 3. Boggle Scores (`boggle_highscores` table)
- **What:** Boggle-specific high scores
- **Fields:** Player initials, score, words found, timestamp
- **Coverage:** Boggle mode only
- **Retention:** Permanent

---

## Quick Access

### Today's Top 8 Scores
```sql
SELECT id, initials, score, grid, created_at
FROM highscores
WHERE DATE(created_at) = CURDATE()
ORDER BY score DESC
LIMIT 8;
```

### Yesterday's Winner (after fix)
```sql
-- Backend handles this via: get_yesterdays_winner API endpoint
-- Uses getModeForDate() to calculate yesterday's game mode
-- Applies correct scoring rules for that mode
```

### Any Player's Full History
```sql
SELECT score, created_at
FROM highscores
WHERE initials = 'ABC'  -- or whoever
ORDER BY created_at DESC;
```

### Specific Date's Scores
```sql
SELECT * FROM highscores
WHERE DATE(created_at) = '2026-08-30'
ORDER BY score DESC;
```

---

## Where to Find the Data

### In Database (via SQL)
- Database name: `word_square`
- Tables: `highscores`, `game_log`, `boggle_highscores`
- Connection: MySQL database

### Via Application API
- Endpoint: `validate.php`
- `get_highscores` - Today's leaderboard
- `get_yesterdays_winner` - Yesterday's winner
- `get_boggle_highscores` - Boggle leaderboard
- (Other data requires direct SQL access)

### In Code Files
- Data insertion: `validate.php` lines 686-696
- Data retrieval: `validate.php` lines 758-803
- API calls: `js/startup.js`, `js/leaderboard.js`, `js/ai.js`

---

## Key Features

✅ **Permanent Storage** - No auto-deletion, all history preserved

✅ **Timestamped** - Every entry has created_at timestamp

✅ **Auditable** - game_log table provides proof of gameplay

✅ **Verified** - Scores validated against game proof

✅ **Word-Tracked** - word_events_json stores complete word breakdown

✅ **Mode-Based** - Correct scoring per game mode

✅ **Date-Queryable** - Can filter by any date range

---

## Useful Statistics

**Query: Total scores ever recorded**
```sql
SELECT COUNT(*) FROM highscores;
```

**Query: Average score across all time**
```sql
SELECT AVG(score) FROM highscores;
```

**Query: Most active day**
```sql
SELECT DATE(created_at), COUNT(*) as score_count
FROM highscores
GROUP BY DATE(created_at)
ORDER BY score_count DESC
LIMIT 1;
```

**Query: Highest score ever**
```sql
SELECT MAX(score) as highest_score FROM highscores;
```

**Query: Number of unique players**
```sql
SELECT COUNT(DISTINCT initials) FROM highscores;
```

---

## Related Documentation

- `HISTORIC_DATA_DOCUMENTATION.md` - Complete detailed guide
- `validate.php` - Backend code where data is stored/retrieved
- `Create Audit Table.sql` - game_log table definition
- `database/boggle-highscores.sql` - Boggle table definition

---

## Summary

| Question | Answer |
|----------|--------|
| Is historic data recorded? | ✅ YES - permanently |
| What tables store it? | highscores, game_log, boggle_highscores |
| How far back? | Since application start (complete history) |
| Can we query it? | ✅ YES - full SQL access |
| Can we track individual players? | ✅ YES - by initials |
| Can we see game progression? | ✅ YES - timestamped entries |
| Can we verify scores? | ✅ YES - game_log proof + word validation |
| Can we analyze trends? | ✅ YES - complete date/score history |

**TL;DR: Full historic data is recorded, preserved permanently, and queryable in detail.**
