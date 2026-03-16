import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { RUNTIME_STATUS_PATH } from "./paths.js";

const RUNTIME_STATUS_VERSION = 2;
const PI_STALE_AFTER_MS = 12_000;

export type RuntimeStatus = {
  version: number;
  updatedAt: string | null;
  pi: {
    state: "waiting" | "starting" | "running" | "stopped";
    pid: number | null;
    startedAt: string | null;
    heartbeatAt: string | null;
    exitedAt: string | null;
  };
  skill: {
    state: "waiting" | "active";
    activatedAt: string | null;
    lastEventAt: string | null;
    eventName: string | null;
  };
  experiment: {
    state: "idle" | "running";
    startedAt: string | null;
    lastCompletedAt: string | null;
    lastDurationMs: number | null;
  };
};

export type LaunchSetupState = "waiting" | "loading" | "ready";

export type LaunchSetup = {
  headline: string;
  server: {
    state: LaunchSetupState;
    meta: string;
  };
  target: {
    state: LaunchSetupState;
    meta: string;
  };
  pi: {
    state: LaunchSetupState;
    meta: string;
  };
  skill: {
    state: LaunchSetupState;
    meta: string;
  };
};

function createDefaultRuntimeStatus(): RuntimeStatus {
  return {
    version: RUNTIME_STATUS_VERSION,
    updatedAt: null,
    pi: {
      state: "waiting",
      pid: null,
      startedAt: null,
      heartbeatAt: null,
      exitedAt: null
    },
    skill: {
      state: "waiting",
      activatedAt: null,
      lastEventAt: null,
      eventName: null
    },
    experiment: {
      state: "idle",
      startedAt: null,
      lastCompletedAt: null,
      lastDurationMs: null
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readNumberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeRuntimeStatus(input: unknown): RuntimeStatus {
  const defaults = createDefaultRuntimeStatus();
  if (!isRecord(input)) {
    return defaults;
  }

  const pi = isRecord(input.pi) ? input.pi : {};
  const skill = isRecord(input.skill) ? input.skill : {};
  const experiment = isRecord(input.experiment) ? input.experiment : {};
  const piState =
    pi.state === "waiting" ||
    pi.state === "starting" ||
    pi.state === "running" ||
    pi.state === "stopped"
      ? pi.state
      : defaults.pi.state;
  const skillState =
    skill.state === "waiting" || skill.state === "active"
      ? skill.state
      : defaults.skill.state;
  const experimentState =
    experiment.state === "idle" || experiment.state === "running"
      ? experiment.state
      : defaults.experiment.state;

  return {
    version: RUNTIME_STATUS_VERSION,
    updatedAt: readStringOrNull(input.updatedAt),
    pi: {
      state: piState,
      pid: readNumberOrNull(pi.pid),
      startedAt: readStringOrNull(pi.startedAt),
      heartbeatAt: readStringOrNull(pi.heartbeatAt),
      exitedAt: readStringOrNull(pi.exitedAt)
    },
    skill: {
      state: skillState,
      activatedAt: readStringOrNull(skill.activatedAt),
      lastEventAt: readStringOrNull(skill.lastEventAt),
      eventName: readStringOrNull(skill.eventName)
    },
    experiment: {
      state: experimentState,
      startedAt: readStringOrNull(experiment.startedAt),
      lastCompletedAt: readStringOrNull(experiment.lastCompletedAt),
      lastDurationMs: readNumberOrNull(experiment.lastDurationMs)
    }
  };
}

export async function readRuntimeStatus() {
  try {
    const raw = await readFile(RUNTIME_STATUS_PATH, "utf8");
    return normalizeRuntimeStatus(JSON.parse(raw));
  } catch {
    return createDefaultRuntimeStatus();
  }
}

export async function writeRuntimeStatus(nextStatus: RuntimeStatus) {
  const normalized = normalizeRuntimeStatus(nextStatus);
  normalized.updatedAt = new Date().toISOString();

  await mkdir(dirname(RUNTIME_STATUS_PATH), { recursive: true });
  const tempPath = `${RUNTIME_STATUS_PATH}.tmp`;
  await writeFile(tempPath, JSON.stringify(normalized, null, 2));
  await rename(tempPath, RUNTIME_STATUS_PATH);

  return normalized;
}

export async function updateRuntimeStatus(
  updater: (current: RuntimeStatus) => RuntimeStatus
) {
  const current = await readRuntimeStatus();
  const next = updater(current);
  return writeRuntimeStatus(next);
}

export async function clearRuntimeStatus() {
  await rm(RUNTIME_STATUS_PATH, { force: true });
}

function readTimestamp(value: string | null) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function buildLaunchSetup(input: {
  host: string;
  port: number;
  target: {
    fileName: string;
    width: number;
    height: number;
  } | null;
  runtime: RuntimeStatus;
}): LaunchSetup {
  const hasTarget = Boolean(input.target);
  const now = Date.now();
  const heartbeatAt = readTimestamp(input.runtime.pi.heartbeatAt);
  const piFresh =
    heartbeatAt !== null && now - heartbeatAt <= PI_STALE_AFTER_MS;
  const piReady = input.runtime.pi.state === "running" && piFresh;
  const piLoading = hasTarget && input.runtime.pi.state === "starting" && piFresh;
  const skillReady = piReady && input.runtime.skill.state === "active";
  const skillLoading = piReady && !skillReady;
  const piStopped = hasTarget && input.runtime.pi.state === "stopped";

  const headline = !hasTarget
    ? "Upload a target to start a new battleground session."
    : skillReady
      ? "Live target locked. Pi can keep iterating while the curve settles."
      : piReady
        ? "Pi is running. Start the local skill to begin the loop."
        : piStopped
          ? "Pi stopped. Run it again to continue the loop."
          : "Target loaded. Start Pi to begin the loop.";

  return {
    headline,
    server: {
      state: "ready",
      meta: `${input.host}:${input.port}`
    },
    target: {
      state: hasTarget ? "ready" : "waiting",
      meta: hasTarget ? "ready" : "waiting for upload"
    },
    pi: {
      state: !hasTarget ? "waiting" : piReady ? "ready" : piLoading ? "loading" : "waiting",
      meta: !hasTarget
        ? "waiting for target"
        : piReady
          ? "running"
          : piLoading
            ? "starting…"
            : piStopped
              ? "stopped"
              : "pnpm pi"
    },
    skill: {
      state: !hasTarget ? "waiting" : skillReady ? "ready" : skillLoading ? "loading" : "waiting",
      meta: !hasTarget
        ? "waiting for target"
        : !piReady
          ? piStopped
            ? "idle"
            : "waiting for Pi"
          : skillReady
            ? "active"
            : "/skill:visual-diff-autoresearch"
    }
  };
}
