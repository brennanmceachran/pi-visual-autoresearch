# Pi Visual Autoresearch

Local battleground for Pi's autoresearch loop. You upload a target image, Pi edits `candidate.html` and `candidate.css`, and the score is the visual similarity between the rendered component and that target.

## What is here

- `candidate.html` and `candidate.css`
  Pi's editable surface. Use HTML plus Tailwind utility classes, with optional custom CSS.
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

3. Open `http://127.0.0.1:4242`, upload a target image, then inspect the target, live preview, latest candidate capture, and diff heatmap.

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

## Notes

- Pi is launched with `PI_CODING_AGENT_DIR` set to this repo's `.pi/agent`, and with `--no-skills` / `--no-extensions` so it does not pull in global user skills or extensions.
- The evaluator writes artifacts to `.artifacts/latest/`. These are ignored by git so the autoresearch loop does not accidentally commit screenshots.
- `autoresearch.jsonl` is intentionally ignored so experiment history survives `git checkout -- .` reverts.
