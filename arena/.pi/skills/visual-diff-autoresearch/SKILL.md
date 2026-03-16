---
name: visual-diff-autoresearch
description: Optimize the current target image in this battleground with Pi's autoresearch loop. Use when asked to match the uploaded image, improve the visual diff score, or start the battleground optimization loop.
---

# Visual Diff Autoresearch

Use this skill for the current battleground workspace.

## Objective

Improve the visual similarity score reported by `pnpm research:score` for the current target image.

## Files you may edit by default

- `candidate.html`
- `candidate.css`

Do not inspect or edit battleground infrastructure or private scorer state unless the user explicitly asks for battleground implementation work.

## Core loop

This project uses these tools directly:

- `init_experiment`
- `run_experiment`
- `log_experiment`

`pnpm research:score` is not a separate tool. It is the command you pass into `run_experiment`.

## Step-by-step workflow

1. Read:
   - `AGENTS.md`
   - `candidate.html`
   - `candidate.css`
   - if present, `autoresearch.jsonl`
2. If `autoresearch.jsonl` is missing in the current folder, call `init_experiment` with:
   - `name: "Visual diff battleground"`
   - `metric_name: "similarity"`
   - `metric_unit: "%"`
   - `direction: "higher"`
3. Call `run_experiment` with exactly:
   - `command: "pnpm research:score"`
   - `timeout_seconds: 600`
4. Parse the `METRIC name=value` lines from the returned stdout:
   - `similarity`
   - `difference`
   - `evaluation_ms`
5. Call `log_experiment` after every `run_experiment`:
   - `commit`: current `HEAD` short SHA before logging
   - `metric`: `similarity`
   - `metrics`: include `difference` and `evaluation_ms`
   - `status`: `keep`, `discard`, `crash`, or `checks_failed` if the tool reports a failed checks phase
   - `description`: one-line summary of the attempted change
6. Do not manually commit or manually revert before `log_experiment`. On `keep`, the tool handles the git commit itself. On `discard`, `crash`, and `checks_failed`, the tool auto-reverts code changes.

## Metrics

- Primary: `similarity` (higher is better)
- Secondary:
  - `difference`
  - `evaluation_ms`

## What `run_experiment` returns

The `run_experiment("pnpm research:score")` result is the main feedback surface for the loop.

You will get back:

- A text block with pass/fail state, runtime, recent scorer output, and `METRIC ...` lines.
- `Target image`
  - the visual goal you are trying to match
- `Candidate capture`
  - the exact screenshot the scorer judged for this run
  - trust this more than any separate manual preview
- `Diff heatmap`
  - this is a penalty map, not just a change overlay
  - transparent pixels mean either a match within tolerance or ignored background/transparent pixels
  - blue pixels are slight misses just over tolerance
  - green pixels are moderate misses
  - yellow and orange pixels are large misses
  - red pixels are the highest-penalty misses
  - use the hottest regions first when choosing the next edit

In practice, the call looks like:

- `run_experiment(command="pnpm research:score", timeout_seconds=600)`

Interpretation:

- If the candidate capture is framed, sized, or positioned wrong, fix layout before cosmetic details.
- If one side has visible content and the other side is effectively background/transparent, treat that as a severe miss.
- If the heatmap is concentrated in a few regions, those regions should dominate the next edit.
- If the heatmap is broadly noisy everywhere, simplify and realign the overall structure first.

## Logging rules

- If the command succeeds and similarity improved over the best current keep, use `status: keep`.
- If the command succeeds but similarity did not improve, use `status: discard`.
- If the command crashes, use `status: crash`.
- If the command reports that correctness checks failed after a passing benchmark, use `status: checks_failed`.
- Do not manually revert after logging one of these non-keep statuses. The tool handles the revert.

## Strategy

- Keep the markup deterministic and frame-filling.
- Prefer simple geometric reconstruction first: large blocks, background, major shapes, text bands.
- Use Tailwind utility classes in `candidate.html` for rapid iteration.
- Use `candidate.css` only for custom gradients, masks, or effects that are awkward in Tailwind.
- Avoid animation, filters that depend on browser timing, and anything random.
- Never cheat by embedding or fetching the target pixels. Honest reconstruction may use DOM layout, Tailwind, custom CSS, inline SVG, canvas, and script, but must not depend on private battleground paths, network fetches, or `data:` URIs.
- If an asset request is blocked by the evaluator, do not try alternate fetch paths. Reconstruct the frame honestly instead.
- If the evaluator reports a validation failure, remove the forbidden construct and continue with an honest approximation.
- If visual feedback is missing from `run_experiment`, do not read artifact images directly. Treat it as a battleground bug and continue only after that bug is fixed.
