# Pi Visual Autoresearch Arena

This folder is the agent workspace for the visual battleground.

## Primary goal

Optimize the visual similarity score between the active private target image and the rendered component defined by:

- `candidate.html`
- `candidate.css`

## Normal workflow

1. Read this file plus `candidate.html` and `candidate.css`.
2. Use the upstream autoresearch tools:
   - `init_experiment`
   - `run_experiment`
   - `log_experiment`
3. For `run_experiment`, use `pnpm research:score`.
4. Use the `run_experiment` result itself as the feedback surface:
   - score and metric text
   - attached target image
   - attached candidate capture
   - attached diff heatmap
5. Edit only the candidate files unless a change to the battleground itself is explicitly requested.

## Guardrails

- Stay inside this `arena/` workspace unless the user explicitly asks for battleground infrastructure changes.
- Do not inspect or modify private battleground paths such as `../.pi/private/targets/`, `../.pi/sessions/`, `../data/target.json`, or `../.artifacts/`.
- Treat `candidate.html` as the primary editable surface. Keep structure simple and deterministic.
- Use Tailwind utility classes in `candidate.html` when possible. Use `candidate.css` for anything custom that would be awkward in utilities.
- The rendered component should fit the full target frame. The evaluator sets the stage size from the current target dimensions.
- Avoid animations, timers, and random values in the candidate.
- Never embed or fetch the target image or scorer artifacts. Honest reconstruction may use normal DOM, CSS, SVG, canvas, or script primitives, but must not depend on private battleground paths, network fetches, or `data:` URIs.
- If asset loading is attempted, the evaluator will block network/private-path requests. Treat that as a cue to reconstruct honestly rather than trying another fetch path.
- If the evaluator reports a validation failure, rewrite the candidate honestly instead of trying to bypass the rule.
- Never fall back to reading artifact images directly. If visual feedback is missing from `run_experiment`, treat that as a battleground bug rather than reading `../.artifacts/latest/*.png`.
