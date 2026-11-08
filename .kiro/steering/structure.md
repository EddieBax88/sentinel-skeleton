---
inclusion: always
---

# Repository Structure

```
sentinel-skeleton/
├── packages/
│   └── skeleton-core/     # Shared engine and extension contracts only
├── midnight-code-hunt/    # App 1 — timed NEC navigation drills
└── dead-circuit-check/    # App 2 — field calculators
```

## Rules

- `packages/skeleton-core` holds the shared engine and the `defineCalcPlugin` / `defineCodeTrail` contracts only. No app-specific code belongs here.
- Calculator plug-ins and drill packs live inside their respective app folder (`midnight-code-hunt/` or `dead-circuit-check/`), never in the core.
- Each app folder is a standalone Vite + React workspace package.
