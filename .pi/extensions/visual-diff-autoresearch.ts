import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";

import { ROOT_DIR } from "../../src/lib/paths.js";
import { buildScoreFeedbackBlocks } from "../../src/lib/research-feedback.js";
import {
  getProtectedPathReason,
  getRunExperimentReason,
  getWritablePathReason,
  pathMayTraverseProtected,
  resolveProjectPath
} from "../../src/lib/research-guard.js";

function applyActiveTools(pi: ExtensionAPI) {
  const activeToolNames = pi
    .getAllTools()
    .map((tool) => tool.name)
    .filter((name) => name !== "bash");

  pi.setActiveTools(activeToolNames);
}

function block(reason: string) {
  return {
    block: true as const,
    reason
  };
}

export default function visualDiffAutoresearchExtension(pi: ExtensionAPI) {
  pi.on("session_start", async () => {
    applyActiveTools(pi);
  });

  pi.on("session_switch", async () => {
    applyActiveTools(pi);
  });

  pi.on("tool_call", async (event, ctx) => {
    if (isToolCallEventType("read", event)) {
      const absolutePath = resolveProjectPath(event.input.path, ctx.cwd);
      const reason = getProtectedPathReason(absolutePath);
      if (reason) {
        return block(`Read blocked: ${reason}.`);
      }
      return;
    }

    if (isToolCallEventType("write", event) || isToolCallEventType("edit", event)) {
      const absolutePath = resolveProjectPath(event.input.path, ctx.cwd);
      const writeReason = getWritablePathReason(absolutePath);
      if (writeReason) {
        return block(writeReason);
      }
      return;
    }

    if (isToolCallEventType("ls", event)) {
      const absolutePath = resolveProjectPath(event.input.path ?? ".", ctx.cwd);
      const reason = getProtectedPathReason(absolutePath);
      if (reason) {
        return block(`Listing blocked: ${reason}.`);
      }
      if (absolutePath !== ROOT_DIR && pathMayTraverseProtected(absolutePath)) {
        return block("Listing directories that contain protected battleground paths is blocked.");
      }
      return;
    }

    if (isToolCallEventType("find", event) || isToolCallEventType("grep", event)) {
      const requestedPath = event.input.path ?? ".";
      const absolutePath = resolveProjectPath(requestedPath, ctx.cwd);
      const reason = getProtectedPathReason(absolutePath);
      if (reason) {
        return block(`Search blocked: ${reason}.`);
      }
      if (pathMayTraverseProtected(absolutePath)) {
        return block(
          "Searches must target explicit safe paths. Do not scan directories that contain scorer state, uploaded targets, or session files."
        );
      }
      return;
    }

    if (event.toolName === "run_experiment" && typeof event.input.command === "string") {
      const reason = getRunExperimentReason(event.input.command);
      if (reason) {
        return block(reason);
      }
    }
  });

  pi.on("tool_result", async (event) => {
    if (event.toolName !== "run_experiment") return;
    if (typeof event.input.command !== "string") return;
    if (event.input.command.trim() !== "pnpm research:score") return;
    if (event.isError) return;

    try {
      const feedbackBlocks = await buildScoreFeedbackBlocks();
      if (!feedbackBlocks) return;

      return {
        content: [...event.content, ...feedbackBlocks]
      };
    } catch {
      return;
    }
  });
}
