import { isAbsolute, relative, resolve } from "node:path";

import {
  ARTIFACTS_DIR,
  CANDIDATE_CSS_PATH,
  CANDIDATE_HTML_PATH,
  ROOT_DIR,
  SESSIONS_DIR,
  TARGET_INFO_PATH,
  PRIVATE_TARGETS_DIR
} from "./paths.js";

const PROTECTED_PATHS = new Map([[TARGET_INFO_PATH, "target metadata"]]);
const WRITABLE_PATHS = new Set([
  CANDIDATE_HTML_PATH,
  CANDIDATE_CSS_PATH,
  resolve(ROOT_DIR, "autoresearch.md"),
  resolve(ROOT_DIR, "autoresearch.ideas.md")
]);

const PROTECTED_DIRECTORIES = [
  {
    label: "uploaded target images",
    path: PRIVATE_TARGETS_DIR
  },
  {
    label: "Pi session history",
    path: SESSIONS_DIR
  },
  {
    label: "score artifact images",
    path: ARTIFACTS_DIR
  }
] as const;

function isWithin(parent: string, child: string) {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function resolveProjectPath(inputPath: string, cwd = ROOT_DIR) {
  return resolve(cwd, inputPath);
}

export function getWritablePathReason(absolutePath: string) {
  if (WRITABLE_PATHS.has(absolutePath)) return null;
  return "Only candidate.html, candidate.css, autoresearch.md, and autoresearch.ideas.md are writable in this battleground.";
}

export function getProtectedPathReason(absolutePath: string) {
  const protectedPathReason = PROTECTED_PATHS.get(absolutePath);
  if (protectedPathReason) {
    return protectedPathReason;
  }

  for (const directory of PROTECTED_DIRECTORIES) {
    if (isWithin(directory.path, absolutePath)) {
      return directory.label;
    }
  }

  return null;
}

export function pathMayTraverseProtected(absolutePath: string) {
  return (
    PROTECTED_DIRECTORIES.some((directory) =>
      isWithin(absolutePath, directory.path)
    ) ||
    [...PROTECTED_PATHS.keys()].some((protectedPath) =>
      isWithin(absolutePath, protectedPath)
    )
  );
}

function normalizedShell(command: string) {
  return command.replace(/\\/g, "/");
}

export function getBlockedShellReason(command: string) {
  const normalized = normalizedShell(command);

  if (
    normalized.includes("/api/target/current") ||
    normalized.includes("127.0.0.1:4242/api/target/current") ||
    normalized.includes("localhost:4242/api/target/current")
  ) {
    return "The target image API is private to the scorer.";
  }

  if (
    normalized.includes("/artifacts/candidate.png") ||
    normalized.includes("/artifacts/diff.png") ||
    normalized.includes("/artifacts/masked-target.png") ||
    normalized.includes("/artifacts/masked-candidate.png") ||
    normalized.includes(".artifacts/latest/")
  ) {
    return "Score artifact images are private to the scorer.";
  }

  if (
    normalized.includes(".pi/private/targets") ||
    normalized.includes(".pi/sessions") ||
    normalized.includes("data/targets/")
  ) {
    return "Protected battleground paths cannot be accessed from shell commands.";
  }

  return null;
}

export function getRunExperimentReason(command: string) {
  const normalized = command.trim();

  if (normalized !== "pnpm research:score") {
    return "run_experiment is restricted to `pnpm research:score` in this project.";
  }

  return getBlockedShellReason(normalized);
}
