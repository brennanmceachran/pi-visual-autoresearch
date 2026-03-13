import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = resolve(__dirname, "../..");
export const PUBLIC_DIR = join(ROOT_DIR, "public");
export const DATA_DIR = join(ROOT_DIR, "data");
export const TARGETS_DIR = join(DATA_DIR, "targets");
export const TARGET_MANIFEST_PATH = join(TARGETS_DIR, "current.json");
export const ARTIFACTS_DIR = join(ROOT_DIR, ".artifacts", "latest");
export const REPORT_PATH = join(ARTIFACTS_DIR, "report.json");
export const CANDIDATE_HTML_PATH = join(ROOT_DIR, "candidate.html");
export const CANDIDATE_CSS_PATH = join(ROOT_DIR, "candidate.css");
export const AUTORESEARCH_LOG_PATH = join(ROOT_DIR, "autoresearch.jsonl");
export const DEFAULT_STAGE_WIDTH = 960;
export const DEFAULT_STAGE_HEIGHT = 720;

export function ensureRuntimeDirs() {
  mkdirSync(TARGETS_DIR, { recursive: true });
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  mkdirSync(join(ROOT_DIR, ".pi", "agent"), { recursive: true });
  mkdirSync(join(ROOT_DIR, ".pi", "sessions"), { recursive: true });
}

