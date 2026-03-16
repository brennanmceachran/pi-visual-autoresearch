import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arenaDir = join(root, "arena");
const artifactsDir = join(root, ".artifacts", "latest");
const sessionsDir = join(root, ".pi", "sessions");
const runtimeStatusPath = join(root, ".pi", "runtime", "status.json");
const privateTargetsDir = join(root, ".pi", "private", "targets");
const legacyTargetsDir = join(root, "data", "targets");
const targetInfoPath = join(root, "data", "target.json");
const resettableFiles = [
  join(root, "autoresearch.jsonl"),
  join(root, "autoresearch.md"),
  join(arenaDir, "autoresearch.jsonl"),
  join(arenaDir, "autoresearch.md"),
  join(root, "autoresearch.sh"),
  join(root, "autoresearch.ideas.md"),
  join(arenaDir, "autoresearch.ideas.md"),
  targetInfoPath,
  runtimeStatusPath
];
const defaultCandidateHtml = `<main class="frame" aria-label="candidate surface"></main>
`;
const defaultCandidateCss = `/* The evaluator already provides the full target-sized stage. Fill it directly. */
* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  width: 100%;
  height: 100%;
}

body {
  overflow: hidden;
  background: #ffffff;
  color: #111111;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.frame {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #ffffff;
}
`;

async function clearDirectory(directory, keep = []) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => !keep.includes(entry.name))
        .map((entry) => rm(join(directory, entry.name), { force: true, recursive: true }))
    );
  } catch {
    // Ignore missing directories.
  }
}

await Promise.all(resettableFiles.map((path) => rm(path, { force: true })));
await mkdir(arenaDir, { recursive: true });
await Promise.all([
  writeFile(join(arenaDir, "candidate.html"), defaultCandidateHtml),
  writeFile(join(arenaDir, "candidate.css"), defaultCandidateCss)
]);
await Promise.all([
  clearDirectory(artifactsDir, [".gitkeep"]),
  clearDirectory(sessionsDir),
  clearDirectory(privateTargetsDir),
  clearDirectory(legacyTargetsDir)
]);

console.log(
  "Battleground reset: cleared target, candidate DOM, experiments, artifacts, and Pi sessions."
);
