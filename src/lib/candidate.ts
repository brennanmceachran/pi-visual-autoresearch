import { readFile } from "node:fs/promises";

import {
  CANDIDATE_CSS_PATH,
  CANDIDATE_HTML_PATH,
  DEFAULT_STAGE_HEIGHT,
  DEFAULT_STAGE_WIDTH
} from "./paths.js";

export interface StageSize {
  width: number;
  height: number;
}

export async function readCandidateFiles() {
  const [html, css] = await Promise.all([
    readFile(CANDIDATE_HTML_PATH, "utf8"),
    readFile(CANDIDATE_CSS_PATH, "utf8")
  ]);

  return {
    html: html.trim(),
    css: css.trim()
  };
}

export function buildStageSize(size?: Partial<StageSize> | null): StageSize {
  return {
    width: Math.max(1, Math.round(size?.width ?? DEFAULT_STAGE_WIDTH)),
    height: Math.max(1, Math.round(size?.height ?? DEFAULT_STAGE_HEIGHT))
  };
}

export function buildPreviewDocument(input: {
  candidateHtml: string;
  compiledCss: string;
  stage: StageSize;
}) {
  const { candidateHtml, compiledCss, stage } = input;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1"
    />
    <title>Pi Visual Preview</title>
    <style>
      :root {
        color-scheme: light;
        --stage-width: ${stage.width}px;
        --stage-height: ${stage.height}px;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(244, 238, 227, 0.92)),
          radial-gradient(circle at top right, rgba(255, 160, 55, 0.22), transparent 38%);
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
      }

      body {
        display: grid;
        place-items: center;
        padding: 32px;
      }

      .stage-shell {
        display: grid;
        place-items: center;
        min-width: calc(var(--stage-width) + 64px);
        min-height: calc(var(--stage-height) + 64px);
        border: 1px solid rgba(33, 24, 13, 0.12);
        border-radius: 32px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(248, 244, 236, 0.86)),
          linear-gradient(90deg, rgba(28, 21, 12, 0.05) 1px, transparent 1px),
          linear-gradient(rgba(28, 21, 12, 0.05) 1px, transparent 1px);
        background-size: auto, 24px 24px, 24px 24px;
        box-shadow: 0 28px 90px rgba(46, 28, 5, 0.18);
      }

      #candidate-root {
        position: relative;
        width: var(--stage-width);
        height: var(--stage-height);
        overflow: hidden;
        isolation: isolate;
        background: transparent;
      }

${compiledCss}
    </style>
  </head>
  <body>
    <div class="stage-shell">
      <div id="candidate-root">${candidateHtml}</div>
    </div>
  </body>
</html>`;
}

