---
inclusion: always
---

# Technology Stack

## Languages & Frameworks

- **TypeScript** — all source code.
- **React** — UI for both apps.
- **Vite** — build tooling and dev server.
- **Tailwind CSS** — styling.

## Monorepo

npm workspaces monorepo. Workspace packages: `packages/skeleton-core`, `midnight-code-hunt/`, `dead-circuit-check/`.

## Testing

- **Vitest** — unit and integration tests.
- **fast-check** — property-based tests. Every calculator must ship with property-based tests.

## Constraints

- No runtime AI.
- No backend.
- Calculators are pure, deterministic functions.
- Static deploys on Vercel.
