import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync
} from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arenaDir = resolve(root, "arena");
const arenaSkillsDir = resolve(arenaDir, ".pi", "skills");
const agentDir = resolve(root, ".pi", "agent");
const sessionsDir = resolve(root, ".pi", "sessions");
const extensionsDir = resolve(root, ".pi", "extensions");
const runtimeDir = resolve(root, ".pi", "runtime");
const runtimeStatusPath = resolve(runtimeDir, "status.json");
const extensionArgs = readdirSync(extensionsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
  .sort((left, right) => left.name.localeCompare(right.name))
  .flatMap((entry) => ["--extension", resolve(extensionsDir, entry.name)]);

mkdirSync(agentDir, { recursive: true });
mkdirSync(arenaDir, { recursive: true });
mkdirSync(arenaSkillsDir, { recursive: true });
mkdirSync(sessionsDir, { recursive: true });
mkdirSync(runtimeDir, { recursive: true });

function defaultRuntimeStatus() {
  return {
    version: 1,
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

function readRuntimeStatus() {
  try {
    const raw = JSON.parse(readFileSync(runtimeStatusPath, "utf8"));
    return {
      ...defaultRuntimeStatus(),
      ...raw,
      pi: {
        ...defaultRuntimeStatus().pi,
        ...(raw.pi ?? {})
      },
      skill: {
        ...defaultRuntimeStatus().skill,
        ...(raw.skill ?? {})
      },
      experiment: {
        ...defaultRuntimeStatus().experiment,
        ...(raw.experiment ?? {})
      }
    };
  } catch {
    return defaultRuntimeStatus();
  }
}

function writeRuntimeStatus(update) {
  const current = readRuntimeStatus();
  const next = {
    ...current,
    ...update,
    pi: {
      ...current.pi,
      ...(update.pi ?? {})
    },
    skill: {
      ...current.skill,
      ...(update.skill ?? {})
    },
    experiment: {
      ...current.experiment,
      ...(update.experiment ?? {})
    },
    updatedAt: new Date().toISOString()
  };
  const tempPath = `${runtimeStatusPath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(next, null, 2));
  renameSync(tempPath, runtimeStatusPath);
}

const args = [
  "exec",
  "pi",
  "--no-skills",
  "--skill",
  arenaSkillsDir,
  "--no-extensions",
  ...extensionArgs,
  "--session-dir",
  sessionsDir,
  ...process.argv.slice(2)
];

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(command, args, {
  cwd: arenaDir,
  stdio: "inherit",
  env: {
    ...process.env,
    PI_CODING_AGENT_DIR: agentDir
  }
});

const startedAt = new Date().toISOString();
writeRuntimeStatus({
  pi: {
    state: "starting",
    pid: child.pid ?? null,
    startedAt,
    heartbeatAt: startedAt,
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
});

const heartbeatTimer = setInterval(() => {
  writeRuntimeStatus({
    pi: {
      state: "running",
      pid: child.pid ?? null,
      startedAt,
      heartbeatAt: new Date().toISOString(),
      exitedAt: null
    }
  });
}, 2_500);
heartbeatTimer.unref();

writeRuntimeStatus({
  pi: {
    state: "running",
    pid: child.pid ?? null,
    startedAt,
    heartbeatAt: new Date().toISOString(),
    exitedAt: null
  }
});

child.on("error", () => {
  clearInterval(heartbeatTimer);
  writeRuntimeStatus({
    pi: {
      state: "stopped",
      pid: child.pid ?? null,
      startedAt,
      heartbeatAt: null,
      exitedAt: new Date().toISOString()
    },
    experiment: {
      state: "idle",
      startedAt: null
    }
  });
});

child.on("exit", (code, signal) => {
  clearInterval(heartbeatTimer);
  writeRuntimeStatus({
    pi: {
      state: "stopped",
      pid: child.pid ?? null,
      startedAt,
      heartbeatAt: null,
      exitedAt: new Date().toISOString()
    },
    experiment: {
      state: "idle",
      startedAt: null
    }
  });
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
