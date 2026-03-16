# Pi Visual Autoresearch

Local battleground for Pi's autoresearch loop. You upload a target image, Pi works inside `arena/`, and the score is the visual similarity between the rendered component and that target.

## What is here

- `arena/candidate.html` and `arena/candidate.css`
  Pi's editable surface. Use HTML plus Tailwind utility classes, with optional custom CSS.
- `arena/package.json`
  Tiny local wrapper so `run_experiment("pnpm research:score")` works from the agent workspace.
- `.pi/extensions/pi-autoresearch.ts`
  Vendored upstream autoresearch extension from `davebcn87/pi-autoresearch`.
- `.pi/skills/`
  Local-only Pi skills, including the upstream generic skill and a project-specific `visual-diff-autoresearch` skill.
- `src/server/`
  Local battleground server for uploads, previewing, and inspecting score history.
- `src/research/score.ts`
  Headless evaluator that Playwright uses for the actual metric.

## Quick start

1. Install dependencies:

```bash
pnpm install
pnpm exec playwright install chromium
```

2. Start the battleground:

```bash
pnpm battleground
```

3. Open `http://127.0.0.1:4242`, upload a target image, then inspect the target, latest candidate capture, and diff heatmap.

4. Start Pi in local-only mode:

```bash
pnpm pi
```

Then run:

```text
/skill:visual-diff-autoresearch
```

Or launch straight into the loop:

```bash
pnpm research:agent
```

When you are done with the local battleground server:

```bash
pnpm battleground:stop
```

## Reset

To start a completely fresh battleground for a new target:

```bash
pnpm battleground:reset
```

This clears the uploaded target, resets `arena/candidate.html` and `arena/candidate.css`, removes experiment history and artifacts, and wipes local Pi sessions for this repo.

## Notes

- Pi is launched with `PI_CODING_AGENT_DIR` set to this repo's `.pi/agent`, and with `--no-skills` / `--no-extensions` so it does not pull in global user skills or extensions.
- Pi now starts with its working directory set to `arena/`, so searches and edits stay inside the battleground workspace by default.
- The evaluator writes artifacts to `.artifacts/latest/`. These are ignored by git so the autoresearch loop does not accidentally commit screenshots.
- `autoresearch.jsonl` is intentionally ignored so experiment history survives `git checkout -- .` reverts.
- The scorer rejects cheating candidates. Embedded target pixels, fetches, `data:` URIs, asset tags, and non-fragment CSS `url(...)` references all fail before scoring.
