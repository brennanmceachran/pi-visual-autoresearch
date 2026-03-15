# Autoresearch

Objective: improve the `similarity` score from `pnpm research:score` by iterating on `candidate.html` and `candidate.css` only.

## Loop

1. Run `pnpm research:score`.
2. Inspect the scorer feedback from the experiment output attachments.
3. Make a simple deterministic visual reconstruction edit.
4. Keep changes only when `similarity` improves.
5. Revert losing or crashing attempts and continue.
