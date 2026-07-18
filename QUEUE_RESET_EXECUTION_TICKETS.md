# Queue Reset Execution Tickets

This ticket set operationalizes the design in [QUEUE_RESET_ARCHITECTURE_PLAN.md](QUEUE_RESET_ARCHITECTURE_PLAN.md).

## Execution Rules
- No direct deck/cursor mutation outside the queue owner boundary.
- No merged phase without passing its Definition of Done.
- Keep each phase mergeable and reversible.

## Phase 1: Instrumentation and Baseline

### Ticket P1-1: Queue Action Telemetry
Objective:
- Add structured queue telemetry events for initialize, consume, undo, reset.

Tasks:
- Define telemetry payload fields: timestamp, mode, roundId, deckHash, cursorBefore, cursorAfter, action, source.
- Emit payload on every queue-affecting action path.
- Add a debug flag so telemetry can be enabled/disabled without code removal.

Deliverables:
- Telemetry schema document section in code comments or docs.
- Verified event stream for one full Tetris round and one Play Again cycle.

Definition of Done:
- Every queue-affecting path emits one telemetry event.
- Logs show no missing action source during normal Tetris play.

Rollback:
- Disable telemetry via flag; no behavior change.

### Ticket P1-2: Baseline Repro Suite (Manual + Scripted Checklist)
Objective:
- Capture current deterministic behavior and reproduce drift reliably.

Tasks:
- Create checklist for 20 consecutive Play Again actions on same UTC day in Tetris.
- Record first 10 queue letters per run and deck hash.
- Repeat for Bomb, Scrabble, Lookahead, MFD, Classic for baseline comparison.

Deliverables:
- Baseline results table committed to docs.

Definition of Done:
- Drift is either reproduced with evidence or ruled out with logs.
- Baseline signatures (deck hash + first letters) stored for all modes.

Rollback:
- Documentation only, no rollback required.

### Ticket P1-3: Mutation Site Inventory
Objective:
- Enumerate all direct queue mutation sites.

Tasks:
- Locate all writes to deck and cursor across shared and variant files.
- Classify each site as generator, consumer, undo, reset, UI side effect.

Deliverables:
- Inventory table listing file, function, mutation type, migration target.

Definition of Done:
- Every direct write site is documented and linked to a Phase 2 or 3 task.

Rollback:
- Documentation only.

## Phase 2: Queue Engine Introduction via Adapter

### Ticket P2-1: Queue Engine Interface Skeleton
Objective:
- Define a single ownership API without changing gameplay behavior yet.

Tasks:
- Define engine contract: createRound, resetRound, peek, consume, snapshot.
- Define immutable source deck and mutable cursor boundary.
- Add adapter layer that forwards to current internals initially.

Deliverables:
- Interface definition and adapter module.

Definition of Done:
- Existing gameplay compiles/runs with adapter in place.
- No net behavior change in baseline scenarios.

Rollback:
- Revert adapter wiring only.

### Ticket P2-2: Route Shared Flow Through Adapter
Objective:
- Move shared init/reset and preview rendering to adapter API.

Tasks:
- Replace direct shared writes with adapter calls.
- Ensure UI only reads queue snapshot output.
- Keep existing custom events, but mutation happens only in adapter path.

Deliverables:
- Shared flow using adapter for queue operations.

Definition of Done:
- No direct shared writes remain in shared gameplay flow.
- Baseline signatures unchanged for non-Tetris modes.

Rollback:
- Feature-flag fallback to legacy shared flow.

### Ticket P2-3: Route Tetris Consume Paths Through Adapter
Objective:
- Move all Tetris consumption operations to the adapter.

Tasks:
- Replace direct consume/increment logic in Tetris with adapter consume.
- Ensure auto-drop and wildcard flows use the same consume path.
- Preserve queue preview behavior via adapter snapshot.

Deliverables:
- Tetris queue lifecycle mediated by adapter only.

Definition of Done:
- No direct Tetris cursor writes remain except approved adapter internals.
- Queue consume count equals accepted placements count.

Rollback:
- Restore legacy Tetris consume path behind flag.

## Phase 3: Async Fencing and Reset State Machine Enforcement

### Ticket P3-1: Round Identity Fencing
Objective:
- Ensure stale async callbacks cannot mutate new rounds.

Tasks:
- Add roundId/sessionToken issued at create/reset.
- Propagate token into timers, animation completions, wildcard async flows.
- Add pre-mutation token validation checks in all async continuations.

Deliverables:
- Async guard checks across all queue-affecting continuations.

Definition of Done:
- Play Again during active async operations never changes new-round queue.
- Telemetry shows stale callbacks rejected cleanly.

Rollback:
- Disable guard enforcement with a kill switch if needed.

### Ticket P3-2: Reset State Machine Locking
Objective:
- Enforce serialized reset lifecycle.

Tasks:
- Implement explicit states: END_OLD_ROUND -> CANCEL_OLD_ASYNC -> BUILD_NEW_ROUND -> RENDER_INITIAL_QUEUE -> ARM_INPUT.
- Block input during pre-arm states.
- Ensure no consume operation allowed before ARM_INPUT.

Deliverables:
- Central reset controller with state transitions.

Definition of Done:
- No queue mutation events occur between CANCEL_OLD_ASYNC and ARM_INPUT except BUILD/RENDER internals.
- Reset pass rate is 100% in stress checklist.

Rollback:
- Re-enable legacy reset path behind feature flag.

### Ticket P3-3: Remove Legacy Direct Mutation
Objective:
- Complete ownership migration.

Tasks:
- Remove legacy direct writes and dead code paths.
- Keep assertions that fail fast if direct writes reappear.

Deliverables:
- Clean ownership model with one queue mutation surface.

Definition of Done:
- Mutation inventory from P1-3 is fully resolved.
- No direct write assertions trigger in test matrix.

Rollback:
- Revert to prior commit before cleanup if post-cleanup regressions appear.

## Cross-Phase Acceptance Gates

### Gate A: Deterministic Replay
- Tetris: 20 consecutive Play Again actions produce identical first 10 letters and deck hash.
- Other modes: baseline signatures unchanged.

### Gate B: Stress Timing
- Reset during timer near zero.
- Reset while wildcard modal is open.
- Reset immediately after drop click.
- No cross-round mutation detected.

### Gate C: Cursor Integrity
- Cursor never negative.
- No double consume for a single accepted placement.
- Undo behavior aligned with mode rules.

## Suggested Implementation Order (Short)
1. P1-1
2. P1-2
3. P1-3
4. P2-1
5. P2-2
6. P2-3
7. P3-1
8. P3-2
9. P3-3

## Timebox Suggestion
- Phase 1: 0.5 to 1 day
- Phase 2: 1 to 2 days
- Phase 3: 1 to 2 days

## Status Tracker
- [ ] P1-1 Queue Action Telemetry
- [ ] P1-2 Baseline Repro Suite
- [ ] P1-3 Mutation Site Inventory
- [ ] P2-1 Queue Engine Interface Skeleton
- [ ] P2-2 Route Shared Flow Through Adapter
- [ ] P2-3 Route Tetris Consume Paths Through Adapter
- [ ] P3-1 Round Identity Fencing
- [ ] P3-2 Reset State Machine Locking
- [ ] P3-3 Remove Legacy Direct Mutation
