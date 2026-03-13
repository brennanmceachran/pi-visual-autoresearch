const POLL_INTERVAL_MS = 4000;

const state = {
  busy: false,
  requestInFlight: false,
  lastScore: null,
  lastDifference: null,
  lastTargetKey: null,
  lastReportKey: null,
  pollTimer: null
};

const elements = {
  uploadForm: document.querySelector("#upload-form"),
  targetInput: document.querySelector("#target-input"),
  evaluateButton: document.querySelector("#evaluate-button"),
  headerState: document.querySelector("#header-state"),
  scoreValue: document.querySelector("#score-value"),
  scoreDelta: document.querySelector("#score-delta"),
  differenceValue: document.querySelector("#difference-value"),
  bestDifferenceValue: document.querySelector("#best-difference-value"),
  bestScoreValue: document.querySelector("#best-score-value"),
  evalValue: document.querySelector("#eval-value"),
  statusValue: document.querySelector("#status-value"),
  targetMeta: document.querySelector("#target-meta"),
  targetDimensions: document.querySelector("#target-dimensions"),
  previewMeta: document.querySelector("#preview-meta"),
  captureMeta: document.querySelector("#capture-meta"),
  diffMeta: document.querySelector("#diff-meta"),
  feedback: document.querySelector("#feedback"),
  runCount: document.querySelector("#run-count"),
  targetImage: document.querySelector("#target-image"),
  targetPlaceholder: document.querySelector("#target-placeholder"),
  candidateImage: document.querySelector("#candidate-image"),
  candidatePlaceholder: document.querySelector("#candidate-placeholder"),
  diffImage: document.querySelector("#diff-image"),
  diffPlaceholder: document.querySelector("#diff-placeholder"),
  previewFrame: document.querySelector("#preview-frame"),
  previewPlaceholder: document.querySelector("#preview-placeholder"),
  historyBody: document.querySelector("#history-body"),
  historyName: document.querySelector("#history-name"),
  curvePath: document.querySelector("#curve-path"),
  curveArea: document.querySelector("#curve-area"),
  curvePoints: document.querySelector("#curve-points"),
  curveStartLabel: document.querySelector("#curve-start-label"),
  curveEndLabel: document.querySelector("#curve-end-label")
};

function setBusy(nextBusy) {
  state.busy = nextBusy;
  elements.evaluateButton.disabled = nextBusy;
  elements.uploadForm.querySelector("button").disabled = nextBusy;
  elements.headerState.textContent = nextBusy
    ? "Running evaluator"
    : "Watching for new evaluations";
}

function setFeedback(message, isError = false) {
  elements.feedback.textContent = message;
  elements.feedback.style.color = isError ? "#a63f2a" : "";
}

function formatMetric(value, suffix = "") {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  return `${value.toFixed(4)}${suffix}`;
}

function pulse(element) {
  if (!element) return;
  element.classList.remove("is-updating");
  requestAnimationFrame(() => {
    element.classList.add("is-updating");
  });
}

function setFrameVisibility(node, placeholder, src) {
  if (src) {
    node.src = src;
    node.style.visibility = "visible";
    placeholder.classList.add("hidden");
    return;
  }

  node.removeAttribute("src");
  node.style.visibility = "hidden";
  placeholder.classList.remove("hidden");
}

function buildCurveValues(appState) {
  const values = [];

  for (const run of appState.history?.runs ?? []) {
    values.push(Number((100 - run.metric).toFixed(4)));
  }

  if (appState.report) {
    const current = Number(appState.report.difference.toFixed(4));
    const last = values[values.length - 1];
    if (typeof last !== "number" || Math.abs(last - current) > 0.0001) {
      values.push(current);
    }
  }

  return values;
}

function drawCurve(appState) {
  const values = buildCurveValues(appState);

  if (!values.length) {
    elements.curvePath.setAttribute("d", "");
    elements.curveArea.setAttribute("d", "");
    elements.curvePoints.innerHTML = "";
    elements.curveStartLabel.textContent = "Run 1";
    elements.curveEndLabel.textContent = "Waiting for data";
    return;
  }

  const width = 420;
  const height = 180;
  const left = 10;
  const right = 12;
  const top = 12;
  const bottom = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x =
      values.length === 1
        ? (width - left - right) / 2 + left
        : left + ((width - left - right) * index) / (values.length - 1);
    const y = top + ((max - value) / range) * (height - top - bottom);
    return { x, y, value, index };
  });

  if (points.length === 1) {
    points.push({
      x: width - right,
      y: points[0].y,
      value: points[0].value,
      index: 1
    });
  }

  const pathData = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const areaData = `${pathData} L ${points[points.length - 1].x.toFixed(2)} ${(height - bottom).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height - bottom).toFixed(2)} Z`;

  elements.curvePath.setAttribute("d", pathData);
  elements.curveArea.setAttribute("d", areaData);

  const bestValue = Math.min(...values);
  elements.curvePoints.innerHTML = points
    .map((point, index) => {
      const classes = ["curve-point"];
      if (Math.abs(point.value - bestValue) < 0.0001) {
        classes.push("best");
      }
      if (index === points.length - 1) {
        classes.push("current");
      }
      return `<circle class="${classes.join(" ")}" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${index === points.length - 1 ? 4.5 : 3.5}"></circle>`;
    })
    .join("");

  elements.curveStartLabel.textContent =
    values.length > 1 ? `Run 1 · ${values[0].toFixed(2)}% diff` : "Current frame";
  elements.curveEndLabel.textContent = `Latest · ${values[values.length - 1].toFixed(2)}% diff`;
}

function renderImages(appState, options = {}) {
  const target = appState.target;
  const report = appState.report;
  const targetKey = target ? `${target.fileName}:${target.updatedAt}` : null;
  const reportKey = report ? `${report.generatedAt}:${report.target.updatedAt}` : null;
  const cacheBust = `ts=${Date.now()}`;

  if (options.force || state.lastTargetKey !== targetKey) {
    const targetUrl = target?.url ? `${target.url}?${cacheBust}` : "";
    setFrameVisibility(elements.targetImage, elements.targetPlaceholder, targetUrl);
    elements.targetDimensions.textContent = target
      ? `${target.width}x${target.height}`
      : "No target";
    state.lastTargetKey = targetKey;
  }

  const previewUrl = target ? `/api/preview?${cacheBust}` : "";
  setFrameVisibility(elements.previewFrame, elements.previewPlaceholder, previewUrl);

  if (options.force || state.lastReportKey !== reportKey) {
    const candidateUrl = report?.artifacts?.candidate
      ? `${report.artifacts.candidate}?${cacheBust}`
      : "";
    const diffUrl = report?.artifacts?.diff ? `${report.artifacts.diff}?${cacheBust}` : "";
    setFrameVisibility(elements.candidateImage, elements.candidatePlaceholder, candidateUrl);
    setFrameVisibility(elements.diffImage, elements.diffPlaceholder, diffUrl);
    state.lastReportKey = reportKey;
  }

  elements.previewMeta.textContent = target
    ? "Auto-refresh every 4s"
    : "Preview available after target upload";
  elements.captureMeta.textContent = report
    ? `Captured ${new Date(report.generatedAt).toLocaleTimeString()}`
    : "Last evaluated frame";
  elements.diffMeta.textContent = report
    ? `Background rgb(${report.detectedBackgroundColor.r}, ${report.detectedBackgroundColor.g}, ${report.detectedBackgroundColor.b})`
    : "Misses should shrink over time";
}

function renderHistory(appState) {
  const history = appState.history;
  const runs = history.runs ?? [];
  elements.historyName.textContent = history.name ?? "No loop started yet";
  elements.runCount.textContent = String(runs.length);

  if (!runs.length) {
    elements.historyBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">No experiment history yet.</td>
      </tr>
    `;
    return;
  }

  elements.historyBody.innerHTML = runs
    .slice()
    .reverse()
    .map((run, index) => {
      const runNumber = runs.length - index;
      const timestamp = run.timestamp ? new Date(run.timestamp).toLocaleString() : "";
      return `
        <tr title="${timestamp}">
          <td>${runNumber}</td>
          <td><code>${run.commit}</code></td>
          <td>${formatMetric(run.metric, history.metricUnit || "")}</td>
          <td><span class="status-chip ${run.status}">${run.status}</span></td>
          <td>${run.description || "No description"}</td>
        </tr>
      `;
    })
    .join("");
}

function renderSummary(appState) {
  const report = appState.report;
  const runs = appState.history?.runs ?? [];
  const currentScore = report?.score ?? null;
  const currentDifference = report?.difference ?? null;
  const baselineScore = runs.length ? runs[0].metric : currentScore;
  const bestScore = Math.max(...runs.map((run) => run.metric), currentScore ?? 0);
  const bestDifference =
    currentDifference === null
      ? runs.length
        ? Math.min(...runs.map((run) => 100 - run.metric))
        : null
      : Math.min(currentDifference, ...runs.map((run) => 100 - run.metric));

  elements.scoreValue.textContent =
    typeof currentScore === "number" ? currentScore.toFixed(4) : "--";
  elements.differenceValue.textContent = formatMetric(currentDifference, "%");
  elements.bestDifferenceValue.textContent = formatMetric(bestDifference, "%");
  elements.bestScoreValue.textContent = bestScore > 0 ? formatMetric(bestScore, "%") : "--";
  elements.evalValue.textContent =
    typeof report?.evaluationMs === "number" ? `${report.evaluationMs}ms` : "--";
  elements.targetMeta.textContent = appState.target
    ? `${appState.target.originalName} · ${appState.target.width}x${appState.target.height}`
    : "No target loaded";

  if (typeof currentScore === "number" && typeof baselineScore === "number") {
    const delta = Number((currentScore - baselineScore).toFixed(4));
    elements.scoreDelta.className = "score-delta";

    if (delta > 0.0001) {
      elements.scoreDelta.classList.add("positive");
      elements.scoreDelta.textContent = `+${delta.toFixed(4)} points from baseline`;
    } else if (delta < -0.0001) {
      elements.scoreDelta.classList.add("negative");
      elements.scoreDelta.textContent = `${delta.toFixed(4)} points from baseline`;
    } else {
      elements.scoreDelta.classList.add("flat");
      elements.scoreDelta.textContent = "No change from baseline yet";
    }
  } else {
    elements.scoreDelta.className = "score-delta";
    elements.scoreDelta.textContent = "Upload a target to start the run.";
  }

  elements.statusValue.textContent = report
    ? `Latest evaluation: ${new Date(report.generatedAt).toLocaleString()}`
    : "Waiting for first evaluation.";

  if (state.lastScore !== currentScore && currentScore !== null) {
    pulse(elements.scoreValue);
    pulse(elements.scoreDelta);
    state.lastScore = currentScore;
  }

  if (state.lastDifference !== currentDifference && currentDifference !== null) {
    pulse(elements.differenceValue);
    pulse(elements.bestDifferenceValue);
    state.lastDifference = currentDifference;
  }
}

function renderState(appState, options = {}) {
  renderSummary(appState);
  renderImages(appState, options);
  renderHistory(appState);
  drawCurve(appState);
}

async function requestJSON(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

async function refreshState(options = {}) {
  if (state.requestInFlight) {
    return;
  }

  state.requestInFlight = true;

  try {
    const appState = await requestJSON("/api/state");
    renderState(appState, options);
  } catch (error) {
    if (!options.silent) {
      setFeedback(error instanceof Error ? error.message : String(error), true);
    }
  } finally {
    state.requestInFlight = false;
  }
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
    renderState(payload.state, { force: true });
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
    renderState(payload.state, { force: true });
    setFeedback("Evaluation complete.");
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : String(error), true);
  } finally {
    setBusy(false);
  }
});

state.pollTimer = window.setInterval(() => {
  if (document.hidden || state.busy) {
    return;
  }

  refreshState({ silent: true });
}, POLL_INTERVAL_MS);

refreshState({ force: true }).catch((error) => {
  setFeedback(error instanceof Error ? error.message : String(error), true);
});
