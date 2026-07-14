# Animation plans

| Plan | Title | Severity | Status |
| --- | --- | --- | --- |
| 001 | Build a restrained landing motion system | MEDIUM | DONE |
| 002 | Turn the brief into an orchestration score | HIGH | DONE |

## Execution order

1. Plan 001 is complete and provides the shared reveal tokens and client-leaf
   architecture.
2. Plan 002 is complete: hero masks, discipline score, and sticky story now share
   one semantic sequence.

## Dependencies

- Motion 12.42.2 is already present in `package.json`.
- Plan 002 depends on the motion primitives introduced by plan 001.
- Preserve the current Branderize tokens, real product screenshots, and workspace
  shell work.
