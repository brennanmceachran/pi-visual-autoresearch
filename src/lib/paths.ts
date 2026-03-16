import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = resolve(__dirname, "../..");
export const BATTLEGROUND_DIR = join(ROOT_DIR, "arena");
export const PUBLIC_DIR = join(ROOT_DIR, "public");
export const DATA_DIR = join(ROOT_DIR, "data");
export const TARGET_INFO_PATH = join(DATA_DIR, "target.json");
export const PI_DIR = join(ROOT_DIR, ".pi");
export const RUNTIME_DIR = join(PI_DIR, "runtime");
export const PRIVATE_DIR = join(PI_DIR, "private");
export const PRIVATE_TARGETS_DIR = join(PRIVATE_DIR, "targets");
export const SESSIONS_DIR = join(PI_DIR, "sessions");
export const RUNTIME_STATUS_PATH = join(RUNTIME_DIR, "status.json");
export const ARTIFACTS_DIR = join(ROOT_DIR, ".artifacts", "latest");
export const REPORT_PATH = join(ARTIFACTS_DIR, "report.json");
export const CANDIDATE_HTML_PATH = join(BATTLEGROUND_DIR, "candidate.html");
export const CANDIDATE_CSS_PATH = join(BATTLEGROUND_DIR, "candidate.css");
export const AUTORESEARCH_LOG_PATH = join(BATTLEGROUND_DIR, "autoresearch.jsonl");
export const AUTORESEARCH_NOTES_PATH = join(BATTLEGROUND_DIR, "autoresearch.md");
export const AUTORESEARCH_IDEAS_PATH = join(BATTLEGROUND_DIR, "autoresearch.ideas.md");
export const DEFAULT_STAGE_WIDTH = 960;
export const DEFAULT_STAGE_HEIGHT = 720;

export function ensureRuntimeDirs() {
  mkdirSync(BATTLEGROUND_DIR, { recursive: true });
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(RUNTIME_DIR, { recursive: true });
  mkdirSync(PRIVATE_TARGETS_DIR, { recursive: true });
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  mkdirSync(join(PI_DIR, "agent"), { recursive: true });
  mkdirSync(SESSIONS_DIR, { recursive: true });
}
