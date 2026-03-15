import { readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = join(root, ".artifacts", "latest");
const sessionsDir = join(root, ".pi", "sessions");
const privateTargetsDir = join(root, ".pi", "private", "targets");
const legacyTargetsDir = join(root, "data", "targets");
const targetInfoPath = join(root, "data", "target.json");
const resettableFiles = [
  join(root, "autoresearch.jsonl"),
  join(root, "autoresearch.md"),
  join(root, "autoresearch.sh"),
  join(root, "autoresearch.ideas.md"),
  targetInfoPath
];

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
await Promise.all([
  writeFile(join(root, "candidate.html"), "\n"),
  writeFile(join(root, "candidate.css"), "\n")
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
