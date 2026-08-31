# Code Comparison: Before and After Fix

## The Problem Flow

```
User plays topup game on Aug 30 → Score saved to database
Next day (Aug 31), app loads  → Calls get_yesterdays_winner()
                                ↓
                            getModeForDate() called with Aug 30
                                ↓
                        ❌ OLD: Calculates wrong mode (6-day cycle)
                        ✓ NEW: Calculates correct mode = 'topup' (7-day cycle)
                                ↓
                            sortRowsByModeScore() called
                                ↓
                        ❌ OLD: Wrong scoring algorithm (based on wrong mode)
                        ✓ NEW: Correct scoring algorithm (topup)
                                ↓
                        ❌ OLD: Wrong person selected as winner
                        ✓ NEW: Correct person (highest topup scorer)
                                ↓
                        ❌ OLD: Wrong initials displayed
                        ✓ NEW: Correct initials displayed
```

## Code Changes

### Location: validate.php lines 348-382

**BEFORE (Broken - 6-day cycle):**
```php
function getModeForDate(DateTimeImmutable $date): string
{
    $epoch = new DateTimeImmutable('2026-05-21 00:00:00', new DateTimeZone('UTC'));
    $target = $date->setTime(0, 0, 0)->setTimezone(new DateTimeZone('UTC'));
    $daysSinceEpoch = (int) floor(($target->getTimestamp() - $epoch->getTimestamp()) / 86400);

    if ($daysSinceEpoch > 0 && $daysSinceEpoch % 6 === 0) {                    // ❌ modulo 6
        return 'bomb';
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 1) % 6 === 0) {              // ❌ modulo 6
        return 'scrabble';
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 2) % 6 === 0) {              // ❌ modulo 6
        return 'lookahead';
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 3) % 6 === 0) {              // ❌ modulo 6, wrong mode
        return 'mfd';                                                           // ❌ Should be 'topup'
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 4) % 6 === 0) {              // ❌ modulo 6
        return 'tetris';
    }
    // ❌ MISSING: 'boggle' and 'topup' modes

    return 'classic';
}
```

**AFTER (Fixed - 7-day cycle):**
```php
/**
 * Calculate the game mode for a given date based on the 7-day cycle.
 * This matches the cycle logic in index.php exactly.
 * 
 * @param DateTimeImmutable $date The date to calculate the mode for
 * @return string The mode: 'bomb', 'scrabble', 'lookahead', 'topup', 'tetris', 'boggle', or 'classic'
 */
function getModeForDate(DateTimeImmutable $date): string
{
    $epoch = new DateTimeImmutable('2026-05-21 00:00:00', new DateTimeZone('UTC'));
    $target = $date->setTime(0, 0, 0)->setTimezone(new DateTimeZone('UTC'));
    $daysSinceEpoch = (int) floor(($target->getTimestamp() - $epoch->getTimestamp()) / 86400);

    // 7-day cycle matching index.php logic exactly
    if ($daysSinceEpoch > 0 && $daysSinceEpoch % 7 === 0) {                    // ✓ modulo 7
        return 'bomb';          // Day 0
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 1) % 7 === 0) {              // ✓ modulo 7
        return 'scrabble';      // Day 1
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 2) % 7 === 0) {              // ✓ modulo 7
        return 'lookahead';     // Day 2
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 3) % 7 === 0) {              // ✓ modulo 7, correct mode
        return 'topup';         // ✓ Day 3 - This was the bug!
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 4) % 7 === 0) {              // ✓ modulo 7
        return 'tetris';        // Day 4
    }
    if ($daysSinceEpoch > 0 && ($daysSinceEpoch - 6) % 7 === 0) {              // ✓ Added boggle
        return 'boggle';        // ✓ Day 6 - Previously missing!
    }

    return 'classic';           // Default / Day 5
}
```

## Key Differences

| Aspect | Before | After |
|--------|--------|-------|
| Cycle Length | 6 days | 7 days |
| Modulo Operator | `% 6` | `% 7` |
| Day 3 Mode | `mfd` (wrong) | `topup` (correct) |
| Day 6 Mode | Missing | `boggle` (added) |
| Matches index.php | ❌ No | ✓ Yes |
| Yesterday (Aug 30) Mode | Wrong | topup ✓ |

## Verification

The fix ensures:
1. ✓ Yesterday's game mode is calculated correctly
2. ✓ The correct scoring algorithm is applied
3. ✓ High scores are ranked correctly
4. ✓ The actual winner is identified and celebrated
5. ✓ Correct initials are displayed in the morning announcement

## Related Functions

The fixed function is used by:
- `get_yesterdays_winner` action (line 786)
- Returns the mode to `sortRowsByModeScore()` (line 793)
- Ensures correct winner selection based on game-specific scoring rules

## Deployment Impact

- **No breaking changes:** Same function signature, same return types
- **Immediate fix:** No database migration required
- **Automatic:** Next time `get_yesterdays_winner` is called, correct results
- **Historical:** Past scores may be re-ranked correctly going forward
