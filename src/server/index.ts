import express from "express";
import multer from "multer";
import { join } from "node:path";

import {
  CandidateValidationError,
  buildPreviewDocument,
  buildStageSize,
  readCandidateFiles
} from "../lib/candidate.js";
import { readLatestReport, evaluateCurrentTarget } from "../lib/evaluator.js";
import { readHistory } from "../lib/history.js";
import { ARTIFACTS_DIR, PUBLIC_DIR, ensureRuntimeDirs } from "../lib/paths.js";
import { buildCandidateCss } from "../lib/tailwind.js";
import { readCurrentTarget, saveUploadedTarget } from "../lib/target.js";

const HOST = "127.0.0.1";
const PORT = 4242;

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

function stateErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function buildPreviewFallbackDocument(input: {
  message: string;
  detail?: string;
}) {
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
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(244, 238, 227, 0.92)),
          radial-gradient(circle at top right, rgba(255, 160, 55, 0.16), transparent 38%);
        font-family: "IBM Plex Sans", sans-serif;
      }

      body {
        display: grid;
        place-items: center;
        padding: 18px;
      }

      .preview-fallback {
        width: min(100%, 560px);
        padding: 18px 20px;
        border: 1px solid rgba(33, 24, 13, 0.12);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.86);
        box-shadow: 0 16px 48px rgba(46, 28, 5, 0.12);
      }

      .preview-fallback h1 {
        margin: 0 0 6px;
        font-size: 1rem;
        font-weight: 700;
        color: #1f1b16;
      }

      .preview-fallback p {
        margin: 0;
        font-size: 0.84rem;
        line-height: 1.45;
        color: #6b6258;
      }

      .preview-fallback p + p {
        margin-top: 8px;
      }
    </style>
  </head>
  <body>
    <div class="preview-fallback">
      <h1>Live preview unavailable</h1>
      <p>${input.message}</p>
      ${input.detail ? `<p>${input.detail}</p>` : ""}
    </div>
  </body>
</html>`;
}

async function getAppState() {
  const [target, report, history] = await Promise.all([
    readCurrentTarget(),
    readLatestReport(),
    readHistory()
  ]);

  return {
    target:
      target === null
        ? null
        : {
            fileName: target.fileName,
            originalName: target.originalName,
            width: target.width,
            height: target.height,
            updatedAt: target.updatedAt,
            url: "/api/target/current"
          },
    report,
    history,
    previewUrl: `/api/preview?ts=${Date.now()}`
  };
}

ensureRuntimeDirs();

app.use(express.json());
app.use(express.static(PUBLIC_DIR));
app.use("/artifacts", express.static(ARTIFACTS_DIR));

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/state", async (_request, response) => {
  try {
    response.json(await getAppState());
  } catch (error) {
    response.status(500).json({ error: stateErrorMessage(error) });
  }
});

app.get("/api/target/current", async (_request, response) => {
  const target = await readCurrentTarget();
  if (!target) {
    response.status(404).json({ error: "No target selected." });
    return;
  }

  response.type(target.contentType);
  response.sendFile(target.absolutePath, { dotfiles: "allow" });
});

app.get("/api/preview", async (_request, response) => {
  const target = await readCurrentTarget();

  if (!target) {
    response.type("html").send(
      buildPreviewFallbackDocument({
        message: "Upload a target image to start the live candidate preview."
      })
    );
    return;
  }

  try {
    const candidate = await readCandidateFiles();
    const stage = buildStageSize(target);
    const compiledCss = await buildCandidateCss(candidate.html, candidate.css);
    const html = buildPreviewDocument({
      candidateHtml: candidate.html,
      compiledCss,
      stage
    });

    response.type("html");
    response.send(html);
  } catch (error) {
    const detail =
      error instanceof CandidateValidationError
        ? "The current candidate was rejected before rendering. Use the latest run output to fix the invalid construct."
        : undefined;
    response
      .status(200)
      .type("html")
      .send(
        buildPreviewFallbackDocument({
          message: "The current candidate could not be rendered in the battleground preview.",
          detail
        })
      );
  }
});

app.post("/api/target", upload.single("target"), async (request, response) => {
  const file = request.file;
  if (!file) {
    response.status(400).json({ error: "Upload a target image first." });
    return;
  }

  try {
    await saveUploadedTarget(file);
    const report = await evaluateCurrentTarget();

    response.json({
      ok: true,
      report,
      state: await getAppState()
    });
  } catch (error) {
    response.status(500).json({ error: stateErrorMessage(error) });
  }
});

app.post("/api/evaluate", async (_request, response) => {
  try {
    const report = await evaluateCurrentTarget();
    response.json({
      ok: true,
      report,
      state: await getAppState()
    });
  } catch (error) {
    response.status(500).json({ error: stateErrorMessage(error) });
  }
});

app.get(/.*/, (_request, response) => {
  response.sendFile(join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, HOST, () => {
  console.log(`Pi visual battleground listening at http://${HOST}:${PORT}`);
});
