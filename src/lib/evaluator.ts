import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { chromium } from "playwright";

import { buildPreviewDocument, buildStageSize, readCandidateFiles, type StageSize } from "./candidate.js";
import {
  ARTIFACTS_DIR,
  REPORT_PATH,
  ensureRuntimeDirs
} from "./paths.js";
import { buildCandidateCss } from "./tailwind.js";
import { readCurrentTarget } from "./target.js";

const BROWSER_DIFF_SCRIPT = String.raw`
window.__PI_VISUAL_DIFF = async function __PI_VISUAL_DIFF(payload) {
  const { candidateDataUrl, targetDataUrl, width, height } = payload;
  const SKIPPED_PIXEL = -1;

  const hslToRgb = (h, s, l) => {
    let r;
    let g;
    let b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;

      const hueToRgb = (pValue, qValue, tValue) => {
        let t = tValue;
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return pValue + (qValue - pValue) * 6 * t;
        if (t < 1 / 2) return qValue;
        if (t < 2 / 3) return pValue + (qValue - pValue) * (2 / 3 - t) * 6;
        return pValue;
      };

      r = hueToRgb(p, q, h + 1 / 3);
      g = hueToRgb(p, q, h);
      b = hueToRgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  const loadImage = (source) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load image."));
      image.src = source;
    });

  const toCanvas = (source, compareWidth, compareHeight) => {
    const canvas = document.createElement("canvas");
    canvas.width = compareWidth;
    canvas.height = compareHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not create canvas context.");
    }

    context.drawImage(source, 0, 0, compareWidth, compareHeight);
    return canvas;
  };

  const getImageData = (canvas) => {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not get image data context.");
    }

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    return {
      data: imageData.data,
      width: canvas.width,
      height: canvas.height
    };
  };

  const compareImages = (contestant, target) => {
    const colorTolerance = 30;
    const ignoreTransparent = true;
    const ignoreBackgroundColor = true;
    const backgroundColorTolerance = 10;
    const compareWidth = Math.max(contestant.width, target.width);
    const compareHeight = Math.max(contestant.height, target.height);
    const totalPixels = compareWidth * compareHeight;
    const pixelDiffs = new Float32Array(totalPixels);

    let skippedCount = 0;
    const bgR = target.data[0];
    const bgG = target.data[1];
    const bgB = target.data[2];

    const isBackgroundColor = (r, g, b) => {
      if (!ignoreBackgroundColor) return false;
      const distance = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
      return distance <= backgroundColorTolerance;
    };

    for (let y = 0; y < compareHeight; y += 1) {
      for (let x = 0; x < compareWidth; x += 1) {
        const index = y * compareWidth + x;

        let r1 = 0;
        let g1 = 0;
        let b1 = 0;
        let a1 = 0;

        if (x < contestant.width && y < contestant.height) {
          const offset = (y * contestant.width + x) * 4;
          r1 = contestant.data[offset];
          g1 = contestant.data[offset + 1];
          b1 = contestant.data[offset + 2];
          a1 = contestant.data[offset + 3];
        }

        let r2 = 0;
        let g2 = 0;
        let b2 = 0;
        let a2 = 0;

        if (x < target.width && y < target.height) {
          const offset = (y * target.width + x) * 4;
          r2 = target.data[offset];
          g2 = target.data[offset + 1];
          b2 = target.data[offset + 2];
          a2 = target.data[offset + 3];
        }

        let effectiveA1 = a1;
        let effectiveA2 = a2;

        if (ignoreBackgroundColor) {
          if (isBackgroundColor(r1, g1, b1)) effectiveA1 = 0;
          if (isBackgroundColor(r2, g2, b2)) effectiveA2 = 0;
        }

        if (ignoreTransparent && effectiveA1 === 0 && effectiveA2 === 0) {
          pixelDiffs[index] = SKIPPED_PIXEL;
          skippedCount += 1;
          continue;
        }

        if ((effectiveA1 === 0 && effectiveA2 > 0) || (effectiveA1 > 0 && effectiveA2 === 0)) {
          pixelDiffs[index] = 1;
          continue;
        }

        const rDiff = r1 - r2;
        const gDiff = g1 - g2;
        const bDiff = b1 - b2;
        const rgbDistance = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
        pixelDiffs[index] = rgbDistance / 441.67;
      }
    }

    const effectivePixels = totalPixels - skippedCount;
    const normalizedTolerance = colorTolerance / 441.67;
    let totalDiff = 0;

    for (let index = 0; index < totalPixels; index += 1) {
      const diff = pixelDiffs[index];
      if (diff === SKIPPED_PIXEL) continue;
      if (diff <= normalizedTolerance) continue;

      const excess = diff - normalizedTolerance;
      totalDiff += excess / (1 - normalizedTolerance);
    }

    const diffCanvas = document.createElement("canvas");
    diffCanvas.width = compareWidth;
    diffCanvas.height = compareHeight;
    const diffContext = diffCanvas.getContext("2d");
    if (!diffContext) {
      throw new Error("Could not create diff canvas context.");
    }
    const diffImageData = diffContext.createImageData(compareWidth, compareHeight);

    const maskedContestantCanvas = document.createElement("canvas");
    maskedContestantCanvas.width = contestant.width;
    maskedContestantCanvas.height = contestant.height;
    const maskedContestantContext = maskedContestantCanvas.getContext("2d");
    if (!maskedContestantContext) {
      throw new Error("Could not create masked contestant context.");
    }
    const maskedContestantData = maskedContestantContext.createImageData(contestant.width, contestant.height);

    const maskedTargetCanvas = document.createElement("canvas");
    maskedTargetCanvas.width = target.width;
    maskedTargetCanvas.height = target.height;
    const maskedTargetContext = maskedTargetCanvas.getContext("2d");
    if (!maskedTargetContext) {
      throw new Error("Could not create masked target context.");
    }
    const maskedTargetData = maskedTargetContext.createImageData(target.width, target.height);

    for (let y = 0; y < compareHeight; y += 1) {
      for (let x = 0; x < compareWidth; x += 1) {
        const pixelIndex = y * compareWidth + x;
        const rgbaIndex = pixelIndex * 4;
        const pixelDiff = pixelDiffs[pixelIndex];

        if (pixelDiff === SKIPPED_PIXEL || pixelDiff <= normalizedTolerance) {
          diffImageData.data[rgbaIndex + 3] = 0;
        } else {
          const hue = (1 - pixelDiff) * 0.67;
          const [r, g, b] = hslToRgb(hue, 1, 0.5);
          diffImageData.data[rgbaIndex] = r;
          diffImageData.data[rgbaIndex + 1] = g;
          diffImageData.data[rgbaIndex + 2] = b;
          diffImageData.data[rgbaIndex + 3] = 255;
        }

        if (x < contestant.width && y < contestant.height) {
          const source = (y * contestant.width + x) * 4;
          const r = contestant.data[source];
          const g = contestant.data[source + 1];
          const b = contestant.data[source + 2];
          const a = contestant.data[source + 3];
          const masked = isBackgroundColor(r, g, b) || a === 0;

          maskedContestantData.data[source] = r;
          maskedContestantData.data[source + 1] = g;
          maskedContestantData.data[source + 2] = b;
          maskedContestantData.data[source + 3] = masked ? 0 : a;
        }

        if (x < target.width && y < target.height) {
          const source = (y * target.width + x) * 4;
          const r = target.data[source];
          const g = target.data[source + 1];
          const b = target.data[source + 2];
          const a = target.data[source + 3];
          const masked = isBackgroundColor(r, g, b) || a === 0;

          maskedTargetData.data[source] = r;
          maskedTargetData.data[source + 1] = g;
          maskedTargetData.data[source + 2] = b;
          maskedTargetData.data[source + 3] = masked ? 0 : a;
        }
      }
    }

    diffContext.putImageData(diffImageData, 0, 0);
    maskedContestantContext.putImageData(maskedContestantData, 0, 0);
    maskedTargetContext.putImageData(maskedTargetData, 0, 0);

    const score =
      effectivePixels === 0
        ? 0
        : Math.max(0, Math.min(100, (1 - totalDiff / effectivePixels) * 100));

    return {
      score,
      effectivePixels,
      skippedPixels: skippedCount,
      detectedBackgroundColor: {
        r: bgR,
        g: bgG,
        b: bgB
      },
      diffDataUrl: diffCanvas.toDataURL("image/png"),
      maskedCandidateDataUrl: maskedContestantCanvas.toDataURL("image/png"),
      maskedTargetDataUrl: maskedTargetCanvas.toDataURL("image/png")
    };
  };

  const [candidateImage, targetImage] = await Promise.all([
    loadImage(candidateDataUrl),
    loadImage(targetDataUrl)
  ]);

  const candidateCanvas = toCanvas(candidateImage, width, height);
  const targetCanvas = toCanvas(targetImage, width, height);
  return compareImages(getImageData(candidateCanvas), getImageData(targetCanvas));
};
`;

export interface EvaluationReport {
  score: number;
  difference: number;
  evaluationMs: number;
  generatedAt: string;
  target: {
    fileName: string;
    originalName: string;
    width: number;
    height: number;
    updatedAt: string;
  };
  stage: StageSize;
  detectedBackgroundColor?: {
    r: number;
    g: number;
    b: number;
  };
  stats: {
    effectivePixels: number;
    skippedPixels: number;
  };
  artifacts: {
    candidate: string;
    diff: string;
    maskedCandidate: string | null;
    maskedTarget: string | null;
    target: string;
  };
}

interface BrowserDiffResult {
  score: number;
  effectivePixels: number;
  skippedPixels: number;
  detectedBackgroundColor: {
    r: number;
    g: number;
    b: number;
  };
  diffDataUrl: string;
  maskedCandidateDataUrl: string | null;
  maskedTargetDataUrl: string | null;
}

function mimeFromFileName(fileName: string) {
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (fileName.endsWith(".webp")) {
    return "image/webp";
  }
  if (fileName.endsWith(".gif")) {
    return "image/gif";
  }
  if (fileName.endsWith(".svg")) {
    return "image/svg+xml";
  }
  return "image/png";
}

async function writeDataUrlToFile(dataUrl: string | null, name: string) {
  if (!dataUrl) {
    return null;
  }

  const [, payload = ""] = dataUrl.split(",", 2);
  const buffer = Buffer.from(payload, "base64");
  const absolutePath = join(ARTIFACTS_DIR, name);
  await writeFile(absolutePath, buffer);
  return absolutePath;
}

export async function readLatestReport(): Promise<EvaluationReport | null> {
  try {
    return JSON.parse(await readFile(REPORT_PATH, "utf8")) as EvaluationReport;
  } catch {
    return null;
  }
}

export async function evaluateCurrentTarget(): Promise<EvaluationReport> {
  ensureRuntimeDirs();

  const target = await readCurrentTarget();
  if (!target) {
    throw new Error("No target image selected yet. Upload one in the battleground first.");
  }

  const startedAt = Date.now();
  const stage = buildStageSize(target);
  const candidate = await readCandidateFiles();
  const compiledCss = await buildCandidateCss(candidate.html, candidate.css);
  const previewDocument = buildPreviewDocument({
    candidateHtml: candidate.html,
    compiledCss,
    stage
  });

  const targetBuffer = await readFile(target.absolutePath);
  const targetDataUrl = `data:${target.contentType || mimeFromFileName(target.fileName)};base64,${targetBuffer.toString("base64")}`;

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: {
        width: Math.max(stage.width + 96, 1280),
        height: Math.max(stage.height + 96, 960)
      },
      deviceScaleFactor: 1
    });

    await page.setContent(previewDocument, { waitUntil: "load" });
    await page.locator("#candidate-root").waitFor();
    await page.evaluate(async () => {
      if ("fonts" in document) {
        await document.fonts.ready;
      }
    });
    await page.waitForTimeout(80);
    await page.addScriptTag({ content: BROWSER_DIFF_SCRIPT });

    const candidatePng = await page.locator("#candidate-root").screenshot({
      animations: "disabled"
    });
    const candidateDataUrl = `data:image/png;base64,${candidatePng.toString("base64")}`;
    const diffPayload = JSON.stringify({
      candidateDataUrl,
      targetDataUrl,
      width: stage.width,
      height: stage.height
    });

    await page.addScriptTag({
      content: `
        window.__PI_VISUAL_DIFF_RESULT = null;
        window.__PI_VISUAL_DIFF_ERROR = null;
        window.__PI_VISUAL_DIFF(${diffPayload})
          .then((result) => {
            window.__PI_VISUAL_DIFF_RESULT = result;
          })
          .catch((error) => {
            window.__PI_VISUAL_DIFF_ERROR = error instanceof Error ? error.message : String(error);
          });
      `
    });

    await page.waitForFunction(
      "window.__PI_VISUAL_DIFF_RESULT !== null || window.__PI_VISUAL_DIFF_ERROR !== null"
    );

    const diffError = await page.evaluate("window.__PI_VISUAL_DIFF_ERROR");
    if (typeof diffError === "string" && diffError) {
      throw new Error(diffError);
    }

    const diffResult = (await page.evaluate(
      "window.__PI_VISUAL_DIFF_RESULT"
    )) as BrowserDiffResult;

    const score = Number(diffResult.score.toFixed(4));
    const report: EvaluationReport = {
      score,
      difference: Number((100 - score).toFixed(4)),
      evaluationMs: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
      target: {
        fileName: target.fileName,
        originalName: target.originalName,
        width: target.width,
        height: target.height,
        updatedAt: target.updatedAt
      },
      stage,
      detectedBackgroundColor: diffResult.detectedBackgroundColor,
      stats: {
        effectivePixels: diffResult.effectivePixels,
        skippedPixels: diffResult.skippedPixels
      },
      artifacts: {
        candidate: "/artifacts/candidate.png",
        diff: "/artifacts/diff.png",
        maskedCandidate: "/artifacts/masked-candidate.png",
        maskedTarget: "/artifacts/masked-target.png",
        target: "/api/target/current"
      }
    };

    await writeFile(join(ARTIFACTS_DIR, "candidate.png"), candidatePng);
    await writeDataUrlToFile(diffResult.diffDataUrl, "diff.png");
    await writeDataUrlToFile(diffResult.maskedCandidateDataUrl, "masked-candidate.png");
    await writeDataUrlToFile(diffResult.maskedTargetDataUrl, "masked-target.png");
    await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));

    return report;
  } finally {
    await browser.close();
  }
}
