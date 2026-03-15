import express from "express";
import multer from "multer";
import { join } from "node:path";

import { buildPreviewDocument, buildStageSize, readCandidateFiles } from "../lib/candidate.js";
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
  try {
    const [target, candidate] = await Promise.all([readCurrentTarget(), readCandidateFiles()]);
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
    response.status(500).type("html").send(`<pre>${stateErrorMessage(error)}</pre>`);
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
