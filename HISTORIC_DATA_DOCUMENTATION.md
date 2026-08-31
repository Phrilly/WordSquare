# Historic Player Score Data Storage

## Summary
Yes, the WordSquare application has **full historic data recording** of player scores. Data is stored in two main database tables.

---

## Data Storage Tables

### 1. **`highscores` Table** (Main Scoring Records)
Stores daily high scores for all game modes.

**Columns:**
- `id` - Auto-incrementing primary key
- `initials` - Player initials (3 characters, padded with '-')
- `score` - Final score (integer)
- `grid` - The 25-character game grid (string)
- `word_events_json` - JSON array of word events with points breakdown (LONGTEXT)
- `created_at` - Timestamp (auto-set to CURRENT_TIMESTAMP)

**Data Recorded:**
- Every score submission from daily games
- Works for modes: classic, bomb, scrabble, lookahead, tetris, topup
- Stores both the final score AND the word breakdown (what words were found, how many points each)
- Timestamps allow historical analysis by date

**Usage in Code:**
- `validate.php` line 688: Inserts scores
- `validate.php` line 700-708: Retrieves today's scores to check if new score is top score
- `validate.php` line 762-768: Retrieves today's top 8 scores for leaderboard display
- `validate.php` line 787-794: Retrieves yesterday's scores to determine winner

---

### 2. **`game_log` Table** (Complete Gameplay Records)
Stores detailed logs of every game session played.

**Columns:**
- `id` - Auto-incrementing primary key
- `session_id` - Unique session identifier (32-char string)
- `game_seed` - Random seed used for this game (BIGINT)
- `is_daily` - Boolean flag (whether this was a daily challenge)
- `daily_offset` - Day offset from epoch (for identifying which daily puzzle)
- `final_score` - Final score achieved in that session
- `grid` - The final grid state (25-char string)
- `created_at` - Timestamp (auto-set to CURRENT_TIMESTAMP)

**Data Recorded:**
- Every game session (including non-scored attempts)
- Provides a complete audit trail of gameplay
- Used for score verification (especially for tetris/topup modes)
- Allows replay or analysis of any game

**Usage in Code:**
- `validate.php` line 740: Inserts game logs
- `validate.php` line 646-648: Retrieves game proof for verification

---

### 3. **`boggle_highscores` Table** (Boggle-Specific Records)
Separate table for Boggle game mode (different scoring system).

**Columns:**
- `id` - Auto-incrementing primary key
- `initials` - Player initials (3 characters)
- `score` - Boggle score (total points from all valid words)
- `words_json` - JSON array of all valid words found (MEDIUMTEXT)
- `created_at` - Timestamp (auto-set to CURRENT_TIMESTAMP)

**Data Recorded:**
- Every Boggle game high score submission
- Word list for verification and display
- Indexed by date and score for fast queries

---

## Data Retention

**Current Implementation:**
- Data is stored permanently (no automatic deletion)
- All historic data from application start is preserved

---

## Data Structure Diagram

```
┌──────────────────────────────┐
│    highscores Table          │
├──────────────────────────────┤
│ id (PK)                      │
│ initials (3 chars)           │
│ score                        │
│ grid (25-char)               │
│ word_events_json (LONGTEXT)  │
│ created_at                   │
└──────────────────────────────┘
      │ Daily leaderboard
      │ Winner identification
      │ Mode-based ranking


┌──────────────────────────────┐
│    game_log Table            │
├──────────────────────────────┤
│ id (PK)                      │
│ session_id (unique)          │
│ game_seed                    │
│ is_daily (boolean)           │
│ daily_offset                 │
│ final_score                  │
│ grid (25-char)               │
│ created_at                   │
└──────────────────────────────┘
      │ Gameplay audit trail
      │ Score verification
      │ Game reproducibility


┌──────────────────────────────┐
│ boggle_highscores Table      │
├──────────────────────────────┤
│ id (PK)                      │
│ initials (3 chars)           │
│ score                        │
│ words_json (MEDIUMTEXT)      │
│ created_at                   │
│ INDEX (created_at, score)    │
└──────────────────────────────┘
      │ Boggle-specific scoring
      │ Word validation storage
```

---

## Current Limitations

1. **No user accounts** - Keyed by initials only (3 characters)
   - Multiple players can share initials
   - No persistence across browsers/sessions

2. **Daily reset on display** - UI shows only today's scores
   - Historic data preserved but must query by date
   - No automatic archival

3. **Boggle separate** - Different table/schema
   - Cleaner for Boggle-specific queries
   - Different scoring rules

4. **No purging** - Data grows indefinitely
   - All history preserved permanently
   - May need indices for large datasets

---

## Access Methods

**Direct Database Access:**
- Connect to `word_square` database
- Query tables directly with SQL

**Via Application API:** (validate.php)
- `get_highscores` - Today's leaderboard
- `get_yesterdays_winner` - Yesterday's winner
- `get_boggle_highscores` - Boggle leaderboard
- (Not all historic data exposed via API)

**Database Export:**
- Use MySQL export tools
- Create views for common queries
- Set up reporting dashboards

---

## Summary Table

| Aspect | Details |
|--------|---------|
| **Tables** | 3: highscores, game_log, boggle_highscores |
| **Data** | Every game + score submission + full audit trail |
| **Date Range** | Application start to present (permanent) |
| **Stored Info** | Initials, scores, grids, words, game sessions, timestamps |
| **Verification** | Score proof, word validation, grid verification |
| **Query Access** | Full SQL - can answer detailed historical questions |
| **Analysis** | Complete - trends, patterns, progression tracking |
| **Limitations** | Initials-only (no accounts), daily UI limits |

**Answer: YES - Full historic data is recorded permanently.**

- Queries can filter by date using `WHERE DATE(created_at) = CURDATE()`

**Historic Data Capabilities:**
- ✅ Query all scores from any specific date
- ✅ Track player progression over time
- ✅ Identify patterns and trends
- ✅ Compare day-to-day performance
- ✅ Audit trail for score disputes
- ✅ Replay any previous game

---

## Example Queries

### Get all scores from today
```sql
SELECT id, initials, score, grid, created_at
FROM highscores
WHERE DATE(created_at) = CURDATE();
```

### Get all scores from a specific date
```sql
SELECT id, initials, score, grid, created_at
FROM highscores
WHERE DATE(created_at) = '2026-08-30';
```

### Get player's best score (all time)
```sql
SELECT id, initials, score, grid, created_at
FROM highscores
WHERE initials = 'ABC'
ORDER BY score DESC
LIMIT 1;
```

### Get daily winner for last 7 days (requires proper mode ranking)
```sql
SELECT DATE(created_at) as game_date, initials, score
FROM highscores
WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
ORDER BY created_at DESC;
```

### Get all games played by a session
```sql
SELECT id, game_seed, is_daily, final_score, created_at
FROM game_log
WHERE session_id = 'abc123def456'
ORDER BY created_at DESC;
```

### Get word breakdown for a score
```sql
SELECT initials, score, word_events_json, created_at
FROM highscores
WHERE id = 42;
-- Then parse word_events_json as JSON to see word breakdown
```

---

## Data Integrity Features

### Score Verification
- For `tetris` and `topup` modes, scores must match the game_log entry
- Grid must match proof from gameplay session
- Prevents cheating/invalid score submission

### Word Validation
- `word_events_json` is verified to match the calculated score
- Words must be in dictionary
- Points must be correctly calculated per game mode

### Audit Trail
- `game_log` provides complete proof of gameplay
- `highscores` provides final score submission
- Can be cross-referenced via `session_id` (if captured)

---

## Historic Data Analysis Questions

With this data structure, you can answer:

1. **Who was yesterday's winner?** - Query yesterday's date scores
2. **What's the highest score ever achieved?** - `SELECT MAX(score) FROM highscores`
3. **Who's the most consistent player?** - Find average score per player
4. **What day had the highest scores overall?** - Group by date, aggregate scores
5. **Did anyone cheat?** - Cross-reference highscores with game_log
6. **What words are most commonly found?** - Parse word_events_json, aggregate
7. **How did a player perform on a specific day?** - Filter by initials and date
