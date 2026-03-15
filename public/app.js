const POLL_INTERVAL_MS = 4000;

const state = {
  appState: null,
  busy: false,
  requestInFlight: false,
  diffView: "compare",
  compareX: 58,
  compareY: 44,
  lastScore: null,
  lastDifference: null,
  lastTargetKey: null,
  lastReportKey: null,
  pollTimer: null
};

const elements = {
  uploadForm: document.querySelector("#upload-form"),
  targetInput: document.querySelector("#target-input"),
  selectedFile: document.querySelector("#selected-file"),
  uploadButton: document.querySelector("#upload-button"),
  evaluateButton: document.querySelector("#evaluate-button"),
  headerState: document.querySelector("#header-state"),
  targetCheckMeta: document.querySelector("#target-check-meta"),
  piCheckMeta: document.querySelector("#pi-check-meta"),
  skillCheckMeta: document.querySelector("#skill-check-meta"),
  checkTarget: document.querySelector("#upload-form"),
  checkPi: document.querySelector("#check-pi"),
  checkSkill: document.querySelector("#check-skill"),
  scoreValue: document.querySelector("#score-value"),
  scoreDelta: document.querySelector("#score-delta"),
  differenceValue: document.querySelector("#difference-value"),
  bestDifferenceValue: document.querySelector("#best-difference-value"),
  bestScoreValue: document.querySelector("#best-score-value"),
  evalValue: document.querySelector("#eval-value"),
  statusValue: document.querySelector("#status-value"),
  targetDimensions: document.querySelector("#target-dimensions"),
  previewMeta: document.querySelector("#preview-meta"),
  diffMeta: document.querySelector("#diff-meta"),
  feedback: document.querySelector("#feedback"),
  runCount: document.querySelector("#run-count"),
  targetImage: document.querySelector("#target-image"),
  targetPlaceholder: document.querySelector("#target-placeholder"),
  diffImage: document.querySelector("#diff-image"),
  diffPlaceholder: document.querySelector("#diff-placeholder"),
  previewFrame: document.querySelector("#preview-frame"),
  previewPlaceholder: document.querySelector("#preview-placeholder"),
  compareView: document.querySelector("#compare-view"),
  compareStage: document.querySelector("#compare-stage"),
  compareBaseImage: document.querySelector("#compare-base-image"),
  compareOverlayImage: document.querySelector("#compare-overlay-image"),
  diffToggleButtons: Array.from(document.querySelectorAll("[data-diff-view]")),
  historyList: document.querySelector("#history-list"),
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
  elements.uploadButton.disabled = nextBusy;

  if (nextBusy) {
    elements.headerState.textContent = "Running evaluator";
  } else if (state.appState) {
    renderLaunch(state.appState);
  }
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

function formatRelativeAge(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return "No capture yet";
  }

  const elapsedMs = Date.now() - timestamp;
  if (elapsedMs < 45_000) {
    return "just now";
  }

  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) {
    return `${Math.max(minutes, 1)}m ago`;
  }

  const hours = Math.floor(elapsedMs / 3_600_000);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(elapsedMs / 86_400_000);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);
  return `${Math.max(weeks, 1)}w ago`;
}

function setLaunchStepState(element, nextState) {
  element.classList.remove("is-done", "is-next");
  if (nextState) {
    element.classList.add(nextState);
  }
}

function renderSelectedFileChip(appState = state.appState) {
  const pendingFile = elements.targetInput.files?.[0];

  if (pendingFile) {
    elements.selectedFile.textContent = `queued: ${pendingFile.name}`;
    elements.selectedFile.classList.remove("is-empty");
    return;
  }
  elements.selectedFile.textContent = "";
  elements.selectedFile.classList.add("is-empty");
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

function setFrameAspect(target) {
  const next = target ? String(target.width / target.height) : "0.8";
  document.documentElement.style.setProperty("--frame-aspect", next);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setComparePosition(x, y) {
  state.compareX = clamp(x, 0, 100);
  state.compareY = clamp(y, 0, 100);
  elements.compareStage.style.setProperty("--compare-x", state.compareX.toFixed(2));
  elements.compareStage.style.setProperty("--compare-y", state.compareY.toFixed(2));
}

function updateCompareFromPointer(event) {
  const rect = elements.compareStage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  setComparePosition(x, y);
}

function setDiffView(nextView) {
  state.diffView = nextView;

  for (const button of elements.diffToggleButtons) {
    const active = button.dataset.diffView === nextView;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
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
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const hasVariation = rawMax - rawMin > 0.0001;
  const padding = hasVariation ? Math.max((rawMax - rawMin) * 0.18, 0.25) : 1;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x =
      values.length === 1
        ? (width - left - right) / 2 + left
        : left + ((width - left - right) * index) / (values.length - 1);
    const y = top + ((max - value) / range) * (height - top - bottom);
    return { x, y, value, index };
  });

  const pathData =
    points.length > 1
      ? points
          .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
          .join(" ")
      : "";

  const areaData =
    points.length > 1 && hasVariation
      ? `${pathData} L ${points[points.length - 1].x.toFixed(2)} ${(height - bottom).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height - bottom).toFixed(2)} Z`
      : "";

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
  const targetUrl = target?.url ? `${target.url}?${cacheBust}` : "";
  const previewUrl = target ? `/api/preview?${cacheBust}` : "";
  const candidateUrl = report?.artifacts?.candidate ? `${report.artifacts.candidate}?${cacheBust}` : "";
  const diffUrl = report?.artifacts?.diff ? `${report.artifacts.diff}?${cacheBust}` : "";

  setFrameAspect(target);

  if (options.force || state.lastTargetKey !== targetKey) {
    setFrameVisibility(elements.targetImage, elements.targetPlaceholder, targetUrl);
    elements.targetDimensions.textContent = target
      ? `${target.width}x${target.height}`
      : "No target";
    state.lastTargetKey = targetKey;
  }

  setFrameVisibility(elements.previewFrame, elements.previewPlaceholder, previewUrl);

  if (options.force || state.lastReportKey !== reportKey) {
    if (targetUrl) {
      elements.compareBaseImage.src = targetUrl;
    } else {
      elements.compareBaseImage.removeAttribute("src");
    }

    if (candidateUrl) {
      elements.compareOverlayImage.src = candidateUrl;
    } else {
      elements.compareOverlayImage.removeAttribute("src");
    }

    if (diffUrl) {
      elements.diffImage.src = diffUrl;
    } else {
      elements.diffImage.removeAttribute("src");
    }

    state.lastReportKey = reportKey;
  }

  const hasComparison = Boolean(targetUrl && candidateUrl);
  const hasHeatmap = Boolean(diffUrl);
  const showCompare = state.diffView === "compare";

  elements.compareView.hidden = !showCompare || !hasComparison;
  elements.diffImage.hidden = showCompare || !hasHeatmap;

  if (showCompare) {
    elements.diffPlaceholder.classList.toggle("hidden", hasComparison);
    elements.diffPlaceholder.textContent = hasComparison
      ? ""
      : "Run the evaluator to compare the stored capture against the target.";
  } else {
    elements.diffPlaceholder.classList.toggle("hidden", hasHeatmap);
    elements.diffPlaceholder.textContent = hasHeatmap
      ? ""
      : "Diff heatmap appears after the first evaluation.";
  }

  elements.previewMeta.textContent = target
    ? "Locked to target frame"
    : "Preview available after target upload";
  elements.diffMeta.textContent = report
    ? formatRelativeAge(report.generatedAt)
    : "No capture yet";
}

function renderHistory(appState) {
  const history = appState.history;
  const runs = history.runs ?? [];
  elements.historyName.textContent = history.name ?? "No loop started yet";
  elements.runCount.textContent = String(runs.length);

  if (!runs.length) {
    elements.historyList.innerHTML = `
      <article class="history-item history-item-empty">No experiment history yet.</article>
    `;
    return;
  }

  elements.historyList.innerHTML = runs
    .slice()
    .reverse()
    .map((run, index) => {
      const runNumber = runs.length - index;
      const timestamp = run.timestamp ? new Date(run.timestamp).toLocaleString() : "";
      const description = run.description || "No description";
      return `
        <article class="history-item" title="${timestamp}">
          <div class="history-item-top">
            <div class="history-item-run">#${runNumber}</div>
            <code>${run.commit}</code>
            <div class="history-item-score">${formatMetric(run.metric, history.metricUnit || "")}</div>
            <span class="status-chip ${run.status}">${run.status}</span>
          </div>
          <p class="history-item-description">${description}</p>
          <div class="history-item-time">${timestamp}</div>
        </article>
      `;
    })
    .join("");
}

function renderLaunch(appState) {
  const target = appState.target;
  const hasTarget = Boolean(target);
  const hasReport = Boolean(appState.report);

  setLaunchStepState(elements.checkTarget, hasTarget ? "is-done" : "is-next");
  setLaunchStepState(elements.checkPi, hasTarget ? "is-next" : "");
  setLaunchStepState(elements.checkSkill, hasTarget ? "is-next" : "");

  elements.targetCheckMeta.textContent = hasTarget
    ? `${target.originalName} · ${target.width}x${target.height}`
    : "No target loaded";
  elements.piCheckMeta.textContent = hasTarget
    ? "pnpm pi"
    : "waiting for target";
  elements.skillCheckMeta.textContent = hasTarget
    ? "/skill:visual-diff-autoresearch"
    : "waiting for Pi";
  elements.uploadButton.textContent = hasTarget
    ? "Replace target"
    : "Upload target";
  renderSelectedFileChip(appState);

  elements.headerState.textContent = hasTarget
    ? hasReport
      ? "Target locked. Pi can iterate while you watch the diff fall."
      : "Target loaded. Start Pi, then run the local skill."
    : "Load a target to start a new battleground session.";
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
  state.appState = appState;
  renderLaunch(appState);
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
    renderSelectedFileChip(payload.state);
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : String(error), true);
  } finally {
    setBusy(false);
  }
});

elements.targetInput.addEventListener("change", () => {
  renderSelectedFileChip();
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

for (const button of elements.diffToggleButtons) {
  button.addEventListener("click", () => {
    setDiffView(button.dataset.diffView || "compare");
    if (state.appState) {
      renderImages(state.appState, { force: true });
    }
  });
}

elements.compareStage.addEventListener("pointerdown", (event) => {
  updateCompareFromPointer(event);
  elements.compareStage.setPointerCapture(event.pointerId);
});

elements.compareStage.addEventListener("pointermove", (event) => {
  if (!elements.compareStage.hasPointerCapture(event.pointerId)) {
    return;
  }

  updateCompareFromPointer(event);
});

elements.compareStage.addEventListener("pointerup", (event) => {
  if (elements.compareStage.hasPointerCapture(event.pointerId)) {
    elements.compareStage.releasePointerCapture(event.pointerId);
  }
});

elements.compareStage.addEventListener("pointercancel", (event) => {
  if (elements.compareStage.hasPointerCapture(event.pointerId)) {
    elements.compareStage.releasePointerCapture(event.pointerId);
  }
});

state.pollTimer = window.setInterval(() => {
  if (document.hidden || state.busy) {
    return;
  }

  refreshState({ silent: true });
}, POLL_INTERVAL_MS);

setDiffView(state.diffView);
setComparePosition(state.compareX, state.compareY);

refreshState({ force: true }).catch((error) => {
  setFeedback(error instanceof Error ? error.message : String(error), true);
});
