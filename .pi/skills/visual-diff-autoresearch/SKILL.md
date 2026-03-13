---
name: visual-diff-autoresearch
description: Optimize the current target image in this repository with Pi's autoresearch loop. Use when asked to match the uploaded image, improve the visual diff score, or start the battleground optimization loop.
---

# Visual Diff Autoresearch

Use this skill for the current repository's battleground workflow.

## Objective

Improve the visual similarity score reported by `pnpm research:score` for the current target image.

## Editable files

- `candidate.html`
- `candidate.css`

Do not edit files in `data/targets/` or `.artifacts/` unless the user explicitly asks for changes to the battleground itself.

## Workflow

1. Read:
   - `AGENTS.md`
   - `candidate.html`
   - `candidate.css`
   - `data/targets/current.json`
   - `.artifacts/latest/report.json` if it exists
2. If there is no git branch for the run yet, create one:
   - `git checkout -b autoresearch/visual-diff-$(date +%Y%m%d-%H%M%S)`
3. Write or refresh:
   - `autoresearch.md`
   - `autoresearch.sh`
4. Initialize the loop:
   - `init_experiment`
     - `name`: `Visual diff battleground`
     - `metric_name`: `similarity`
     - `metric_unit`: `%`
     - `direction`: `higher`
5. Run the baseline:
   - `run_experiment` with `pnpm research:score`
6. Parse the `METRIC name=value` lines from stdout and call `log_experiment`.

## Metrics

- Primary: `similarity` (higher is better)
- Secondary:
  - `difference`
  - `evaluation_ms`

## Logging rules

- If the command succeeds and similarity improved over the best current keep, use `status: keep`.
- If the command succeeds but similarity did not improve, use `status: discard` and then revert with `git checkout -- .`.
- If the command crashes, use `status: crash`, then revert with `git checkout -- .`.

## Strategy

- Keep the markup deterministic and frame-filling.
- Prefer simple geometric reconstruction first: large blocks, background, major shapes, text bands.
- Use Tailwind utility classes in `candidate.html` for rapid iteration.
- Use `candidate.css` only for custom gradients, masks, or effects that are awkward in Tailwind.
- Avoid animation, filters that depend on browser timing, and anything random.

## autoresearch.sh

Write this script with `set -euo pipefail` and have it run:

```bash
pnpm research:score
```

It must print the metric lines from that command unchanged.

## Never stop

Once the baseline is recorded, keep iterating until interrupted.
