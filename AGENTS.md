# Pi Visual Autoresearch

This repository is a battleground for Pi's autoresearch loop.

## Primary goal

Optimize the visual similarity score between the active private target image and the rendered component defined by:

- `candidate.html`
- `candidate.css`

## Normal workflow

1. Read this file plus `candidate.html` and `candidate.css`.
2. Evaluate with `pnpm research:score`.
3. Use the `run_experiment` result itself as the feedback surface:
   - score and metric text
   - attached target image
   - attached candidate capture
   - attached diff heatmap
4. Edit only the candidate files unless a change to the scoring pipeline is explicitly requested.

## Guardrails

- Do not modify or inspect private battleground paths such as `.pi/private/targets/`, `.pi/sessions/`, `data/target.json`, or `.artifacts/`.
- Treat `candidate.html` as the primary editable surface. Keep structure simple and deterministic.
- Use Tailwind utility classes in `candidate.html` when possible. Use `candidate.css` for anything custom that would be awkward in utilities.
- The rendered component should fit the full target frame. The evaluator sets the stage size from the current target dimensions.
- Avoid animations, timers, and random values in the candidate.
- Never embed or fetch the target image. No `data:` URIs, no `<img>`, `<picture>`, `<canvas>`, `<iframe>`, `<script>`, `<object>`, or similar asset-loading elements.
- Do not use `src`, `srcset`, `poster`, non-fragment `href`, or CSS `url(...)` values that point at files, network resources, or the battleground API. Only DOM, CSS, Tailwind, and inline SVG vectors are allowed.
- The evaluator rejects cheating candidates before scoring. If a run fails with a validation error, rewrite the candidate honestly instead of trying to bypass the rule.
- Never fall back to reading artifact images directly. If visual feedback is missing from `run_experiment`, treat that as a battleground bug rather than reading `.artifacts/latest/*.png`.
