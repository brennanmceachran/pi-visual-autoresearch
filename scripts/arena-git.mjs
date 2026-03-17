import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

function hasHead(arenaDir) {
  try {
    execFileSync("git", ["-C", arenaDir, "rev-parse", "--verify", "HEAD"], {
      stdio: "pipe"
    });
    return true;
  } catch {
    return false;
  }
}

function runGit(arenaDir, args) {
  execFileSync("git", ["-C", arenaDir, ...args], { stdio: "pipe" });
}

export function ensureArenaGitWorkspace(arenaDir) {
  const gitDir = join(arenaDir, ".git");
  const justInitialized = !existsSync(gitDir);

  if (justInitialized) {
    execFileSync("git", ["init", "-b", "main", arenaDir], { stdio: "pipe" });
    runGit(arenaDir, ["config", "user.name", "Pi Battleground"]);
    runGit(arenaDir, ["config", "user.email", "pi-battleground@local.invalid"]);
  }

  if (!hasHead(arenaDir)) {
    runGit(arenaDir, ["add", "-A"]);
    try {
      runGit(arenaDir, ["diff", "--cached", "--quiet"]);
    } catch {
      runGit(arenaDir, ["commit", "-m", "Initialize battleground workspace"]);
    }
  }
}
