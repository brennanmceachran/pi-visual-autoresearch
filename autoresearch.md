# Autoresearch: Visual diff battleground

## Target
- File: `data/targets/current.png`
- Original name: `heatmap-last-year.png`
- Size: `4000x5014`

## Objective
Increase the `similarity` score from `pnpm research:score`.

## Constraints
- Edit only `candidate.html` and `candidate.css`
- Do not modify `data/targets/` or `.artifacts/`
- Keep the output deterministic and frame-filling

## Initial observations
- The target is a light dashboard-style page on an off-white background.
- It contains three stacked sections: Claude Code, Codex, and Open Code.
- Each section has a title, a compact stat row on the right, a 7-row heatmap, a legend, and summary stats below.
- The current candidate is a dark centered card and is far from the target.

## Plan
1. Record the baseline score.
2. Rebuild the overall layout with a light background and three repeated sections.
3. Approximate the heatmaps using dense rounded square grids.
4. Tune spacing, typography, and the colored active cells.
5. Iterate on alignment and density based on diff output.
