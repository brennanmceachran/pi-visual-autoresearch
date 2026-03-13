const state = {
  busy: false
};

const elements = {
  uploadForm: document.querySelector("#upload-form"),
  targetInput: document.querySelector("#target-input"),
  evaluateButton: document.querySelector("#evaluate-button"),
  scoreValue: document.querySelector("#score-value"),
  differenceValue: document.querySelector("#difference-value"),
  evalValue: document.querySelector("#eval-value"),
  statusValue: document.querySelector("#status-value"),
  targetMeta: document.querySelector("#target-meta"),
  feedback: document.querySelector("#feedback"),
  targetImage: document.querySelector("#target-image"),
  candidateImage: document.querySelector("#candidate-image"),
  diffImage: document.querySelector("#diff-image"),
  previewFrame: document.querySelector("#preview-frame"),
  historyBody: document.querySelector("#history-body"),
  historyName: document.querySelector("#history-name")
};

function setBusy(nextBusy) {
  state.busy = nextBusy;
  elements.evaluateButton.disabled = nextBusy;
  elements.uploadForm.querySelector("button").disabled = nextBusy;
}

function setFeedback(message, isError = false) {
  elements.feedback.textContent = message;
  elements.feedback.style.color = isError ? "#8e1c1c" : "";
}

function formatMetric(value, suffix = "") {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  return `${value.toFixed(4)}${suffix}`;
}

function renderImages(appState) {
  const targetUrl = appState.target?.url ?? "";
  const report = appState.report;
  const cacheBust = `ts=${Date.now()}`;

  elements.targetImage.src = targetUrl ? `${targetUrl}?${cacheBust}` : "";
  elements.targetImage.style.visibility = targetUrl ? "visible" : "hidden";

  elements.previewFrame.src = `${appState.previewUrl}`;

  const candidateUrl = report?.artifacts?.candidate ? `${report.artifacts.candidate}?${cacheBust}` : "";
  const diffUrl = report?.artifacts?.diff ? `${report.artifacts.diff}?${cacheBust}` : "";

  elements.candidateImage.src = candidateUrl;
  elements.candidateImage.style.visibility = candidateUrl ? "visible" : "hidden";
  elements.diffImage.src = diffUrl;
  elements.diffImage.style.visibility = diffUrl ? "visible" : "hidden";
}

function renderHistory(appState) {
  const history = appState.history;
  elements.historyName.textContent = history.name ?? "No loop started yet";

  if (!history.runs.length) {
    elements.historyBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">No experiment history yet.</td>
      </tr>
    `;
    return;
  }

  elements.historyBody.innerHTML = history.runs
    .map((run, index) => {
      const runNumber = history.runs.length - index;
      const timestamp = run.timestamp ? new Date(run.timestamp).toLocaleString() : "";

      return `
        <tr title="${timestamp}">
          <td>${runNumber}</td>
          <td><code>${run.commit}</code></td>
          <td>${formatMetric(run.metric, history.metricUnit || "")}</td>
          <td>
            <span class="status-chip ${run.status}">${run.status}</span>
          </td>
          <td>${run.description || "No description"}</td>
        </tr>
      `;
    })
    .join("");
}

function renderState(appState) {
  const report = appState.report;
  const target = appState.target;

  elements.scoreValue.textContent = report ? formatMetric(report.score, "%") : "--";
  elements.differenceValue.textContent = report ? formatMetric(report.difference, "%") : "--";
  elements.evalValue.textContent = report ? `${report.evaluationMs}ms` : "--";
  elements.statusValue.textContent = report
    ? `Latest evaluation: ${new Date(report.generatedAt).toLocaleString()}`
    : "Waiting for first evaluation";
  elements.targetMeta.textContent = target
    ? `${target.originalName} · ${target.width}×${target.height}`
    : "No image uploaded yet.";

  renderImages(appState);
  renderHistory(appState);
}

async function requestJSON(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

async function refreshState() {
  const appState = await requestJSON("/api/state");
  renderState(appState);
}

elements.uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = elements.targetInput.files?.[0];
  if (!file) {
    setFeedback("Choose an image to upload first.", true);
    return;
  }

  const formData = new FormData();
  formData.set("target", file);

  try {
    setBusy(true);
    setFeedback(`Uploading ${file.name} and running the evaluator...`);
    const payload = await requestJSON("/api/target", {
      method: "POST",
      body: formData
    });
    renderState(payload.state);
    setFeedback("Target uploaded and score refreshed.");
    elements.targetInput.value = "";
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : String(error), true);
  } finally {
    setBusy(false);
  }
});

elements.evaluateButton.addEventListener("click", async () => {
  try {
    setBusy(true);
    setFeedback("Running evaluator...");
    const payload = await requestJSON("/api/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
    renderState(payload.state);
    setFeedback("Evaluation complete.");
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : String(error), true);
  } finally {
    setBusy(false);
  }
});

refreshState().catch((error) => {
  setFeedback(error instanceof Error ? error.message : String(error), true);
});
