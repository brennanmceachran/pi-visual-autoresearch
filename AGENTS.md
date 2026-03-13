# Pi Visual Autoresearch

This repository is a battleground for Pi's autoresearch loop.

## Primary goal

Optimize the visual similarity score between the current target image in `data/targets/` and the rendered component defined by:

- `candidate.html`
- `candidate.css`

## Normal workflow

1. Read the current target metadata in `data/targets/current.json`.
2. Evaluate with `pnpm research:score`.
3. Inspect `.artifacts/latest/report.json`, `.artifacts/latest/diff.png`, and `.artifacts/latest/candidate.png`.
4. Edit only the candidate files unless a change to the scoring pipeline is explicitly requested.

## Guardrails

- Do not modify files in `data/targets/` or `.artifacts/`.
- Treat `candidate.html` as the primary editable surface. Keep structure simple and deterministic.
- Use Tailwind utility classes in `candidate.html` when possible. Use `candidate.css` for anything custom that would be awkward in utilities.
- The rendered component should fit the full target frame. The evaluator sets the stage size from the current target dimensions.
- Avoid animations, timers, and random values in the candidate.
