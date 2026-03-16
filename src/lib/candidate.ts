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

interface CandidateFiles {
  html: string;
  css: string;
}

interface CandidateValidationRule {
  pattern: RegExp;
  message: string;
}

const HTML_VALIDATION_RULES: CandidateValidationRule[] = [
  {
    pattern: /<\s*(?:[a-z0-9-]+:)?(?:iframe|frame|object|embed)\b/i,
    message: "HTML cannot contain iframe, frame, object, or embed elements."
  },
  {
    pattern: /\bon[a-z]+\s*=/i,
    message: "Inline event handlers are forbidden."
  },
  {
    pattern: /\bdata\s*:/i,
    message: "Embedded data URIs are forbidden."
  }
];

const CSS_VALIDATION_RULES: CandidateValidationRule[] = [
  {
    pattern: /@import\b/i,
    message: "CSS @import is forbidden."
  },
  {
    pattern: /\bdata\s*:/i,
    message: "Embedded data URIs are forbidden."
  }
];

export class CandidateValidationError extends Error {
  readonly violations: string[];

  constructor(violations: string[]) {
    super(`Candidate validation failed:\n- ${violations.join("\n- ")}`);
    this.name = "CandidateValidationError";
    this.violations = violations;
  }
}

export function validateCandidateFiles(files: CandidateFiles) {
  const violations: string[] = [];

  for (const rule of HTML_VALIDATION_RULES) {
    if (rule.pattern.test(files.html)) violations.push(rule.message);
  }

  for (const rule of CSS_VALIDATION_RULES) {
    if (rule.pattern.test(files.css)) violations.push(rule.message);
  }

  if (violations.length > 0) {
    throw new CandidateValidationError([...new Set(violations)]);
  }
}

export async function readCandidateFiles() {
  const [html, css] = await Promise.all([
    readFile(CANDIDATE_HTML_PATH, "utf8"),
    readFile(CANDIDATE_CSS_PATH, "utf8")
  ]);

  const files = {
    html: html.trim(),
    css: css.trim()
  };

  validateCandidateFiles(files);
  return files;
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
        --preview-scale: 1;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #ffffff;
      }

      body {
        display: grid;
        place-items: center;
        overflow: hidden;
      }

      .preview-viewport {
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
      }

      .preview-frame {
        position: relative;
        display: grid;
        place-items: center;
        width: calc(var(--stage-width) * var(--preview-scale));
        height: calc(var(--stage-height) * var(--preview-scale));
        max-width: 100%;
        max-height: 100%;
        overflow: hidden;
      }

      .preview-scaler {
        position: absolute;
        top: 50%;
        left: 50%;
        width: var(--stage-width);
        height: var(--stage-height);
        transform: translate(-50%, -50%) scale(var(--preview-scale));
        transform-origin: center center;
      }

      #candidate-root {
        position: relative;
        width: var(--stage-width);
        height: var(--stage-height);
        overflow: hidden;
        isolation: isolate;
        background: #ffffff;
      }

${compiledCss}
    </style>
  </head>
  <body>
    <div class="preview-viewport">
      <div class="preview-frame">
        <div class="preview-scaler">
          <div id="candidate-root">${candidateHtml}</div>
        </div>
      </div>
    </div>
    <script>
      const stageWidth = ${stage.width};
      const stageHeight = ${stage.height};
      const chromePadding = 0;

      function updatePreviewScale() {
        const availableWidth = Math.max(window.innerWidth - chromePadding, 1);
        const availableHeight = Math.max(window.innerHeight - chromePadding, 1);
        const scale = Math.min(availableWidth / stageWidth, availableHeight / stageHeight, 1);
        document.documentElement.style.setProperty("--preview-scale", String(scale));
      }

      window.addEventListener("resize", updatePreviewScale, { passive: true });
      updatePreviewScale();
    </script>
  </body>
</html>`;
}
