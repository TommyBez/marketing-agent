# Animation plans

| Plan | Title | Severity | Status |
| --- | --- | --- | --- |
| 001 | Build a restrained landing motion system | MEDIUM | DONE |

## Execution order

1. Execute plan 001 as one cohesive change. Its hero, section reveals, media
   treatment, CTA feedback, and reduced-motion behavior share the same tokens and
   client-leaf abstraction, so splitting them would create competing motion systems.

## Dependencies

- Motion 12.42.2 is already present in `package.json`.
- Preserve the current uncommitted rebrand, landing image, and workspace shell work.
