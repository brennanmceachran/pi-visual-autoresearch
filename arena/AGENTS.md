# Pi Visual Autoresearch Arena

This folder is the agent workspace for the visual battleground. Treat it as the default project root for optimization work.

## Goal

Optimize the visual similarity score between the active private target image and the rendered component defined by:

- `candidate.html`
- `candidate.css`

Drive `difference` as close to `0` as possible and `similarity` as close to `100` as possible.
Do not stop at "good enough" while credible improvements still exist.

## Workspace facts

- The scorer already provides a fixed stage at the current target dimensions. Build to fill that frame directly.
- `pnpm research:score` is the battleground experiment command. The local skill explains how to run it through the experiment tools.
- The scored truth surface is the candidate capture returned by the scorer, not any ad hoc browser tab state.
- The source of truth for progress is `run_experiment("pnpm research:score")`, not eyeballing the page.
- Files outside this folder are battleground infrastructure. Only touch them when the user explicitly asks for battleground implementation work.

## Diff interpretation

- Treat the diff image as a penalty map, not just a visual overlay.
- Transparent pixels are effectively free: they either matched within tolerance or were ignored as background/transparent.
- Blue pixels are slight misses just over tolerance.
- Green pixels are moderate misses.
- Yellow and orange pixels are large misses.
- Red pixels are the highest-penalty misses and should be fixed first.
- If one side has a visible pixel and the other side is effectively background/transparent, that is a severe miss.
- If the heatmap is noisy across the whole frame, fix scale, framing, and major layout first.
- If the heatmap is concentrated in a few hot regions, focus on those regions before polishing anything else.
- After each meaningful edit, validate by running the experiment again. Do not assume an edit helped until the scorer says it did.

## Files you may edit by default

- `candidate.html`
- `candidate.css`

## Boundaries

- Treat `candidate.html` as the primary editable surface. Keep structure simple and deterministic.
- Use Tailwind utility classes in `candidate.html` when possible. Use `candidate.css` for anything custom that would be awkward in utilities.
- Do not use private battleground state or scorer artifacts as visual inputs or asset sources.
- Avoid animations, timers, and random values in the candidate.
- Never embed or fetch the target image or scorer artifacts. Honest reconstruction may use normal DOM, CSS, SVG, canvas, or script primitives, but must not depend on private battleground paths, network fetches, or `data:` URIs.
- If the evaluator reports a validation failure, rewrite the candidate honestly instead of trying to bypass the rule.
- If visual feedback is missing from `run_experiment`, treat it as a battleground bug instead of reading artifact files directly.
