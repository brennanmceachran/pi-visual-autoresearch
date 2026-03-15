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
  pollTimer: null,
  curveChart: null
};

const elements = {
  uploadForm: document.querySelector("#upload-form"),
  targetInput: document.querySelector("#target-input"),
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
  totalTimeValue: document.querySelector("#total-time-value"),
  currentRunTimeValue: document.querySelector("#current-run-time-value"),
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
  curveShell: document.querySelector(".curve-shell"),
  curveCanvas: document.querySelector("#curve-canvas"),
  curveTooltip: document.querySelector("#curve-tooltip")
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

function formatDurationCompact(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "--";
  }

  const totalSeconds = Math.max(Math.round(value / 1000), 0);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (totalHours > 0) {
    return `${totalHours}h ${minutes}m`;
  }

  if (totalMinutes > 0) {
    return `${totalMinutes}m ${seconds}s`;
  }

  return `${totalSeconds}s`;
}

function formatSummaryTimestamp(value) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return "Waiting for first evaluation.";
  }

  const now = new Date();
  const sameDay = timestamp.toDateString() === now.toDateString();
  const formatted = sameDay
    ? timestamp.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      })
    : timestamp.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });

  return `Updated ${formatted}`;
}

function setLaunchStepState(element, nextState) {
  element.classList.remove("is-done", "is-next");
  if (nextState) {
    element.classList.add(nextState);
  }
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

function buildCurveRuns(appState) {
  const runs = appState.history?.runs ?? [];
  const curveRuns = runs.map((run, index) => ({
    runIndex: index,
    x: index,
    score: Number(run.metric.toFixed(4)),
    diff: Number((100 - run.metric).toFixed(4)),
    y: Number((100 - run.metric).toFixed(4)),
    status: run.status || "discard",
    description: run.description || "No description",
    commit: run.commit || "",
    timestamp: typeof run.timestamp === "number" ? run.timestamp : null,
    label: `Run ${index}`
  }));

  const report = appState.report;
  if (report) {
    const currentDiff = Number(report.difference.toFixed(4));
    const last = curveRuns[curveRuns.length - 1];
    const lastDiff = last ? last.diff : null;

    if (lastDiff === null || Math.abs(lastDiff - currentDiff) > 0.0001) {
      curveRuns.push({
        runIndex: curveRuns.length,
        x: curveRuns.length,
        score: Number(report.score.toFixed(4)),
        diff: currentDiff,
        y: currentDiff,
        status: "current",
        description: "Current evaluation",
        commit: "live",
        timestamp: new Date(report.generatedAt).getTime(),
        label: `Run ${curveRuns.length}`
      });
    }
  }

  const bestDiff = curveRuns.length ? Math.min(...curveRuns.map((run) => run.diff)) : null;
  return curveRuns.map((run) => ({
    ...run,
    isBest: bestDiff !== null && Math.abs(run.diff - bestDiff) < 0.0001
  }));
}

function buildKeepStepPath(keepRuns) {
  if (!keepRuns.length) {
    return [];
  }

  const path = [{ x: keepRuns[0].x, y: keepRuns[0].y }];

  for (let index = 1; index < keepRuns.length; index += 1) {
    const previous = keepRuns[index - 1];
    const current = keepRuns[index];

    path.push({
      x: current.x,
      y: previous.y
    });
    path.push({
      x: current.x,
      y: current.y
    });
  }

  return path;
}

function formatCurvePercentTick(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "";
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)}%`;
}

function setCurveTooltip(context) {
  const tooltip = context.tooltip;
  if (!tooltip || tooltip.opacity === 0 || !tooltip.dataPoints.length) {
    elements.curveTooltip.hidden = true;
    return;
  }

  const point = tooltip.dataPoints[0].raw;
  if (!point) {
    elements.curveTooltip.hidden = true;
    return;
  }

  const statusLabel =
    point.status === "keep" ? "Keep" : point.status === "discard" ? "Discard" : "Current";
  const timeLabel = point.timestamp ? new Date(point.timestamp).toLocaleString() : "No timestamp";
  const note = point.description ? point.description : "No notes for this run.";
  const commitLabel = point.commit ? point.commit : "No commit";

  elements.curveTooltip.innerHTML = `
    <p class="curve-tooltip-run">${point.label} · ${statusLabel}</p>
    <p class="curve-tooltip-meta">${point.score.toFixed(4)}% match · ${point.diff.toFixed(4)}% diff</p>
    <p class="curve-tooltip-meta">${commitLabel} · ${timeLabel}</p>
    <p class="curve-tooltip-note">${note}</p>
  `;

  const { chart } = context;
  const shellRect = elements.curveShell.getBoundingClientRect();
  elements.curveTooltip.hidden = false;
  const tooltipRect = elements.curveTooltip.getBoundingClientRect();
  let left = tooltip.caretX + 16;
  let top = tooltip.caretY - tooltipRect.height - 14;

  if (left + tooltipRect.width > chart.width - 8) {
    left = tooltip.caretX - tooltipRect.width - 16;
  }

  if (top < 8) {
    top = tooltip.caretY + 16;
  }

  left = Math.max(8, Math.min(left, shellRect.width - tooltipRect.width - 8));
  top = Math.max(8, Math.min(top, shellRect.height - tooltipRect.height - 8));

  elements.curveTooltip.style.left = `${left}px`;
  elements.curveTooltip.style.top = `${top}px`;
}

function createCurveChart() {
  if (state.curveChart || !elements.curveCanvas || !window.Chart) {
    return;
  }

  state.curveChart = new window.Chart(elements.curveCanvas, {
    type: "scatter",
    data: {
      datasets: []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        padding: {
          top: 2,
          right: 0,
          bottom: 2,
          left: 2
        }
      },
      interaction: {
        mode: "nearest",
        axis: "xy",
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false,
          external: setCurveTooltip
        }
      },
      scales: {
        x: {
          type: "linear",
          display: true,
          min: -0.12,
          grid: {
            display: true,
            color: "rgba(17, 17, 17, 0.045)",
            drawBorder: false
          },
          ticks: {
            display: true,
            color: "rgba(17, 17, 17, 0.56)",
            font: {
              family: "Geist Mono, IBM Plex Mono, monospace",
              size: 10,
              weight: "500"
            },
            maxTicksLimit: 8,
            autoSkip: true,
            padding: 6,
            callback(value) {
              if (!Number.isInteger(value) || value < 0) {
                return "";
              }

              return value;
            }
          },
          title: {
            display: true,
            text: "Runs",
            color: "rgba(17, 17, 17, 0.48)",
            align: "end",
            padding: {
              top: 6
            },
            font: {
              family: "Geist Mono, IBM Plex Mono, monospace",
              size: 10,
              weight: "600"
            }
          },
          border: {
            display: false
          }
        },
        y: {
          display: true,
          grace: "8%",
          grid: {
            color: "rgba(17, 17, 17, 0.05)",
            drawBorder: false
          },
          ticks: {
            display: true,
            color: "rgba(17, 17, 17, 0.56)",
            font: {
              family: "Geist Mono, IBM Plex Mono, monospace",
              size: 10,
              weight: "500"
            },
            maxTicksLimit: 6,
            padding: 4,
            callback(value) {
              return formatCurvePercentTick(value);
            }
          },
          title: {
            display: false
          },
          border: {
            display: false
          }
        }
      }
    }
  });

  window.__curveChart = state.curveChart;
}

function drawCurve(appState) {
  const curveRuns = buildCurveRuns(appState);
  createCurveChart();

  if (!state.curveChart) {
    return;
  }

  if (!curveRuns.length) {
    state.curveChart.data.datasets = [];
    state.curveChart.update("none");
    elements.curveTooltip.hidden = true;
    return;
  }

  const allLoggedRuns = curveRuns.filter((run) => run.status !== "current");
  const keepRuns = curveRuns.filter((run, index) => run.status === "keep" || index === 0);
  const keepPath = buildKeepStepPath(keepRuns);
  const currentRuns = curveRuns.filter((run) => run.status === "current");
  const maxRunIndex = Math.max(...curveRuns.map((run) => run.runIndex), 0);

  state.curveChart.options.scales.x.max = Math.max(maxRunIndex + 0.02, 1);
  state.curveChart.data.datasets = [
    {
      type: "scatter",
      data: allLoggedRuns,
      parsing: false,
      pointRadius: 3.6,
      pointHoverRadius: 5.8,
      pointBorderWidth: 0,
      pointBackgroundColor: "rgba(17, 17, 17, 0.18)",
      pointBorderColor: "rgba(17, 17, 17, 0.18)"
    },
    {
      type: "line",
      data: keepPath,
      parsing: false,
      pointRadius: 0,
      pointHoverRadius: 0,
      pointHitRadius: 0,
      borderColor: "#0a7b44",
      borderWidth: 2.5,
      borderCapStyle: "round",
      borderJoinStyle: "round",
      fill: false
    },
    {
      type: "scatter",
      data: keepRuns,
      parsing: false,
      pointRadius(context) {
        return context.raw?.isBest ? 6.4 : 5.4;
      },
      pointHoverRadius(context) {
        return context.raw?.isBest ? 8 : 7;
      },
      pointBorderWidth: 2.5,
      pointBackgroundColor(context) {
        return context.raw?.isBest ? "#0a7b44" : "#ffffff";
      },
      pointBorderColor: "#0a7b44"
    },
    {
      type: "scatter",
      data: currentRuns,
      parsing: false,
      pointRadius: 6.2,
      pointHoverRadius: 7.2,
      pointBorderWidth: 2,
      pointBackgroundColor: "#0a7b44",
      pointBorderColor: "#ffffff"
    }
  ];

  state.curveChart.update("none");
  window.__curveChart = state.curveChart;
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
    ? "ready"
    : "no target set";
  elements.piCheckMeta.textContent = hasTarget
    ? "pnpm pi"
    : "waiting for target";
  elements.skillCheckMeta.textContent = hasTarget
    ? "/skill:visual-diff-autoresearch"
    : "waiting for Pi";
  elements.uploadButton.textContent = hasTarget
    ? "Replace"
    : "Upload target";
  elements.uploadForm.classList.toggle("is-empty", !hasTarget);

  elements.headerState.textContent = hasTarget
    ? hasReport
      ? "Live target locked. Pi can keep iterating while the curve settles."
      : "Target loaded. Start Pi and run the skill."
    : "Upload a target to start a new battleground session.";
}

function renderSummary(appState) {
  const report = appState.report;
  const runs = appState.history?.runs ?? [];
  const target = appState.target;
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

  const latestRun = runs[runs.length - 1] ?? null;
  const reportTimestamp = report ? new Date(report.generatedAt).getTime() : null;
  const targetTimestamp = target ? new Date(target.updatedAt).getTime() : null;
  const lastRunTimestamp = latestRun?.timestamp ?? null;
  const lastRunMetric = latestRun?.metric ?? null;
  const hasUnloggedCurrentRun =
    typeof currentScore === "number" &&
    typeof lastRunMetric === "number" &&
    Math.abs(currentScore - lastRunMetric) > 0.0001;
  const totalTimeMs =
    targetTimestamp !== null && reportTimestamp !== null
      ? Math.max(reportTimestamp - targetTimestamp, 0)
      : targetTimestamp !== null
        ? Math.max(Date.now() - targetTimestamp, 0)
        : null;
  const currentRunMs =
    hasUnloggedCurrentRun && reportTimestamp !== null && lastRunTimestamp !== null
      ? Math.max(reportTimestamp - lastRunTimestamp, 0)
      : typeof report?.evaluationMs === "number"
        ? report.evaluationMs
        : null;

  elements.totalTimeValue.textContent = formatDurationCompact(totalTimeMs);
  elements.currentRunTimeValue.textContent = formatDurationCompact(currentRunMs);

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
    ? formatSummaryTimestamp(report.generatedAt)
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

async function uploadSelectedTarget() {
  const file = elements.targetInput.files?.[0];
  if (!file) {
    setFeedback("", false);
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
}

elements.uploadButton.addEventListener("click", () => {
  if (state.busy) return;
  elements.targetInput.click();
});

elements.targetInput.addEventListener("change", () => {
  void uploadSelectedTarget();
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
