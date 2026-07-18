# Queue Reset Architecture Plan

## Goal
Stabilize queue behavior so Play Again always reconstructs the exact expected starting queue for the current day and mode, with zero cross-round drift.

This document is design only. It intentionally proposes structure and process without implementation code.

## Problem Statement
The current queue behavior can drift after Play Again, especially in Tetris mode. The main risk is that queue state can be mutated by multiple subsystems (shared flow, variant flow, timers, wildcard flow, async animations) and old callbacks may fire after a new round has already started.

## Scope
- Primary: Tetris queue/reset correctness.
- Secondary: Preserve deterministic behavior for Bomb, Scrabble, Lookahead, MFD, and Classic.
- Out of scope: visual restyling and scoring formula changes.

## Non-Negotiable Invariants
1. Daily deterministic invariant:
   - For a fixed UTC day and mode, Initialize Round and Play Again must produce the same queue seed and same initial queue letters every time.
2. Single-consumer invariant:
   - Exactly one consume operation per accepted tile placement.
   - No consume on canceled interactions.
3. Reset isolation invariant:
   - No callback from a previous round may mutate queue state of the new round.
4. Cursor integrity invariant:
   - Cursor only advances through explicit consume operations.
   - Cursor never changes directly in UI render code.
5. Ownership invariant:
   - Queue data (deck + cursor) is owned by one module only.

## Root Causes To Address
1. Shared mutable global state:
   - Deck and cursor are reachable by multiple files.
2. Event-order coupling:
   - beforeInit/afterInit and mode events can reorder behavior if one flow is delayed.
3. Async continuation after reset:
   - Timers/animations/wildcard async branches can complete against stale state.
4. Mixed concerns:
   - Generation, consumption, and rendering are intertwined.

## Proposed Structural Design
### 1) Queue Engine (Single Owner)
Create one queue engine responsible for all queue state mutation.

Responsibilities:
- Build deterministic source deck for a mode/day.
- Hold runtime cursor.
- Provide read-only preview window.
- Perform consume/undo operations with strict guardrails.
- Emit structured snapshots for UI rendering.

Public contract (conceptual, no code):
- createRound(mode, daySeed, rules): returns immutable round state with roundId.
- resetRound(mode, daySeed, rules): same as createRound with new roundId.
- peek(n): returns next n letters from cursor.
- consume(reason): advances cursor exactly once and logs reason.
- snapshot(): returns deck hash, cursor, preview, roundId.

Rules:
- No external file writes deck/cursor directly.
- UI receives snapshots only.

### 2) Deterministic Builders (Pure Functions)
Separate deterministic deck builders from runtime mutation.

Requirements:
- Builder must be pure and side-effect free.
- Input must be explicit: mode, seed, optional mode flags.
- Output must be immutable deck list.
- Same input always yields same output.

### 3) Round Identity and Async Fencing
Every round gets a unique roundId/sessionToken.

Rules:
- All async handlers capture roundId at start.
- Before mutation, handler verifies captured roundId matches active roundId.
- On mismatch: return immediately and never mutate state.

Applies to:
- Tetris clock/sweep timers.
- Auto-drop.
- Wildcard modal flow.
- Any delayed animation completion callbacks.

### 4) Reset State Machine
Reset must be explicit and serialized.

State sequence:
1. END_OLD_ROUND
2. CANCEL_OLD_ASYNC
3. BUILD_NEW_ROUND
4. RENDER_INITIAL_QUEUE
5. ARM_INPUT

Guardrails:
- Input disabled until ARM_INPUT.
- No consume allowed during BUILD_NEW_ROUND or RENDER_INITIAL_QUEUE.
- Any late old callback is ignored by roundId check.

### 5) Event Model Cleanup
Keep existing custom events but redefine mutation boundaries.

Event policy:
- Events may request actions from Queue Engine.
- Events must not directly increment/decrement cursor.
- Rendering events consume snapshot only.

## Migration Strategy (Low-Risk)
### Phase 1: Instrument and observe
- Add queue audit logs for deck hash, cursor before/after, roundId, action source.
- Keep current behavior, no logic changes yet.
- Confirm where drift occurs.

### Phase 2: Introduce Queue Engine behind adapter
- Route all queue read/write through adapter API.
- Maintain existing UI events.
- Block direct cursor/deck writes in variant modules.

### Phase 3: Enforce async fencing
- Apply roundId checks across all async branches.
- Reject stale callbacks silently with debug logging.

### Phase 4: Remove legacy direct mutation
- Delete old direct cursor manipulation paths.
- Keep adapter telemetry for one release window.

### Phase 5: Stabilization and cleanup
- Remove temporary telemetry once acceptance tests pass consistently.

## Acceptance Criteria
1. Play Again reproducibility:
   - In Tetris mode, the first 10 queue letters are identical across 20 consecutive Play Again actions on the same day.
2. Cross-mode safety:
   - Bomb, Scrabble, Lookahead, MFD, Classic produce unchanged initial queues vs baseline for the same day.
3. Async reset safety:
   - Pressing Play Again during active timer, wildcard modal, or animation never changes new-round queue unexpectedly.
4. Cursor sanity:
   - No negative cursor values, no double-advance per single placement.
5. Determinism check:
   - Source deck hash remains constant for same mode/day in all replay attempts.

## Test Matrix
- Mode coverage:
  - Tetris, Bomb, Scrabble, Lookahead, MFD, Classic.
- Interaction timing coverage:
  - Play Again when idle.
  - Play Again while timer is near zero.
  - Play Again while wildcard chooser is open.
  - Play Again immediately after drop click.
- Device coverage:
  - Desktop.
  - Mobile viewport.

## Operational Debug Signals
Track per action:
- timestamp
- mode
- roundId
- deckHash
- cursorBefore
- cursorAfter
- action (initialize, consume, undo, reset)
- source (shared flow, tetris timer, wildcard flow, etc.)

## Risks and Mitigations
1. Risk: regressions from changing shared flow.
   - Mitigation: adapter-first migration and baseline snapshots for all modes.
2. Risk: hidden direct cursor writes remain.
   - Mitigation: temporary write-guard assertions and targeted search checklist.
3. Risk: async paths missed in Tetris.
   - Mitigation: roundId gate required in every Promise/timer continuation.

## Implementation Checklist (No Code)
1. Approve invariants and state machine.
2. Define queue engine interface and adapter boundaries.
3. List all direct deck/cursor mutation call sites for removal.
4. Add telemetry schema and validation checklist.
5. Implement phases in order with per-phase rollback point.

## Decision Log
- This plan prioritizes structural correctness over quick patches.
- Queue ownership centralization is mandatory; incremental local fixes are insufficient for long-term stability.
