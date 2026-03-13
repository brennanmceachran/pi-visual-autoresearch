import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const agentDir = resolve(root, ".pi", "agent");
const sessionsDir = resolve(root, ".pi", "sessions");

mkdirSync(agentDir, { recursive: true });
mkdirSync(sessionsDir, { recursive: true });

const args = [
  "exec",
  "pi",
  "--no-skills",
  "--skill",
  resolve(root, ".pi", "skills"),
  "--no-extensions",
  "--extension",
  resolve(root, ".pi", "extensions", "pi-autoresearch.ts"),
  "--session-dir",
  sessionsDir,
  ...process.argv.slice(2)
];

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(command, args, {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    PI_CODING_AGENT_DIR: agentDir
  }
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
