import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4242;
const SERVER_MARKERS = [root, "src/server/index.ts"];

function listListeningPids() {
  try {
    const output = execFileSync(
      "lsof",
      ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN", "-t"],
      { encoding: "utf8" }
    ).trim();

    if (!output) return [];
    return output
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function readCommand(pid) {
  try {
    return execFileSync("ps", ["-p", pid, "-o", "command="], {
      encoding: "utf8"
    }).trim();
  } catch {
    return "";
  }
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForExit(pid, timeoutMs = 3000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (!processExists(pid)) return true;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }

  return !processExists(pid);
}

const matchingPids = listListeningPids().filter((pid) => {
  const command = readCommand(pid);
  return SERVER_MARKERS.every((marker) => command.includes(marker));
});

if (matchingPids.length === 0) {
  console.log(`Battleground stop: no matching server is listening on port ${PORT}.`);
  process.exit(0);
}

for (const pidText of matchingPids) {
  const pid = Number(pidText);
  process.kill(pid, "SIGTERM");
  const stopped = await waitForExit(pid);

  if (!stopped) {
    console.error(`Battleground stop: process ${pid} did not exit after SIGTERM.`);
    process.exitCode = 1;
    continue;
  }

  console.log(`Battleground stop: stopped PID ${pid}.`);
}
