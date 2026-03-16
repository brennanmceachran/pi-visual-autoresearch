# Pi Visual Autoresearch

Turn Pi into a visual-diff grinder.

Upload a target image, let Pi work inside a tiny `arena/` workspace, and watch it push HTML/CSS toward the highest similarity score it can find.

This repo is a local battleground built on Pi's experiment loop:

- live dashboard for target, scored candidate, diff curve, and run history
- local-only Pi setup with no global skill or extension pollution
- agent workspace isolated to `arena/`
- successful experiment runs feed the agent:
  - score text
  - target image
  - candidate capture
  - diff heatmap
- resettable battleground for running fresh optimization loops against new images

## Why this is interesting

This is basically a CSS battle harness for a coding agent.

The agent edits two files:

- `arena/candidate.html`
- `arena/candidate.css`

Then it validates changes by calling the experiment tools and running:

```text
run_experiment(command="pnpm research:score", timeout_seconds=600)
```

That score run renders the candidate, compares it to the uploaded target, and returns the result back into the loop.

## What the battleground does

1. You upload a target image in the local UI.
2. Pi starts in `arena/` and uses the battleground skill.
3. Pi edits `candidate.html` and `candidate.css`.
4. `pnpm research:score` renders the candidate with Playwright.
5. The scorer compares the capture to the target and emits:
   - `METRIC similarity=...`
   - `METRIC difference=...`
   - `METRIC evaluation_ms=...`
6. The agent gets the target image, scored capture, and diff heatmap attached to the experiment result.
7. Pi decides whether to keep or discard the run, then continues.

## Scoring

The scoring math is intentionally aligned with the `synhax` / MAD CSS battle engine settings:

- Euclidean RGB diff
- `colorTolerance = 30`
- `ignoreTransparent = true`
- `ignoreBackgroundColor = true`
- `backgroundColorTolerance = 10`

The capture pipeline here is different: this repo captures the candidate via Playwright screenshot of the battleground stage rather than the browser-side `snapdom` pipeline used in `synhax`.

That means the important part is the same:

- the numeric compare settings match
- the agent is optimizing against the same style of diff humans are scored against

## Diff heatmap semantics

The diff image is a penalty map, not just an overlay.

- transparent: no visible penalty for that pixel
- blue: slight miss just over tolerance
- green: moderate miss
- yellow/orange: large miss
- red: worst miss, fix these first

If the whole frame is noisy, fix scale, framing, and structure before details.
If only a few regions are hot, focus there first.

## Quick start

Install dependencies:

```bash
pnpm install
pnpm exec playwright install chromium
```

Start the battleground:

```bash
pnpm battleground
```

Open:

```text
http://127.0.0.1:4242
```

Upload a target image, then start Pi:

```bash
pnpm pi
```

Inside Pi:

```text
/skill:visual-diff-autoresearch
```

Or launch Pi directly into the battleground flow:

```bash
pnpm research:agent
```

## Commands

```bash
pnpm battleground        # start the local UI/server
pnpm battleground:stop   # stop the local UI/server
pnpm battleground:reset  # wipe target, sessions, logs, artifacts, and reset the arena baseline
pnpm pi                  # start Pi in local-only battleground mode
pnpm research:agent      # start Pi with the battleground skill prompt
pnpm research:score      # run one scoring pass manually
pnpm typecheck           # typecheck the repo
```

## Repo layout

```text
arena/
  candidate.html         # primary editable surface
  candidate.css          # custom CSS surface
  AGENTS.md              # workspace rules for the optimization agent
  .pi/skills/...         # battleground skill

.pi/extensions/
  pi-autoresearch.ts     # vendored experiment-loop extension
  visual-diff-autoresearch.ts
                         # battleground hook layer: guardrails + scorer image attachments

src/research/score.ts    # one-shot scoring entrypoint
src/lib/evaluator.ts     # render + compare + artifact generation
src/server/              # battleground UI/API
public/                  # battleground frontend
scripts/pi-local.mjs     # local-only Pi launcher
```

## Local-only Pi setup

This repo does not rely on your global Pi config.

`pnpm pi` launches Pi with:

- repo-local agent state
- repo-local skills
- repo-local extensions
- working directory set to `arena/`

That keeps the battleground reproducible and avoids dumping project-specific skills into global user folders.

## Anti-cheat boundary

The battleground is built for honest reconstruction, not pixel import tricks.

Current protections:

- `data:` URIs are rejected
- `iframe`, `frame`, `object`, and `embed` are rejected
- external runtime resource loads are blocked during scoring
- the scorer only attaches fresh images for successful experiment runs

Honest reconstruction can still use normal DOM, CSS, SVG, canvas, and script primitives.

## Good targets

This setup works best on:

- CSS battle prompts
- dashboards
- posters
- hero sections
- tightly framed UI screenshots
- image targets where structure and layout matter more than photography

## References

- Pi: https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent
- Autoresearch plugin: https://github.com/davebcn87/pi-autoresearch
- Synhax diff engine: https://github.com/syntaxfm/synhax/blob/main/src/utils/diff.ts
