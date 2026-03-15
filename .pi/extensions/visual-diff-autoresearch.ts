import type { ImageContent, TextContent } from "@mariozechner/pi-ai";
import type {
  ExtensionAPI,
  ToolResultEvent
} from "@mariozechner/pi-coding-agent";
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

function appendToolResultNote(
  content: (TextContent | ImageContent)[],
  note: string
) {
  const nextContent = [...content];
  const firstBlock = nextContent[0];

  if (firstBlock?.type === "text") {
    const updatedFirstBlock: TextContent = {
      ...firstBlock,
      text: `${firstBlock.text}\n\n${note}`
    };
    nextContent[0] = updatedFirstBlock;
    return nextContent;
  }

  const noteBlock: TextContent = { type: "text", text: note };
  return [noteBlock, ...nextContent];
}

type ToolResultPatch = {
  content?: (TextContent | ImageContent)[];
  details?: unknown;
  isError?: boolean;
};

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

  const handleToolResult = async (
    event: ToolResultEvent
  ): Promise<ToolResultPatch | undefined> => {
    if (event.toolName !== "run_experiment") return;
    if (typeof event.input.command !== "string") return;
    if (event.input.command.trim() !== "pnpm research:score") return;
    if (event.isError) return;

    try {
      const feedbackBlocks = await buildScoreFeedbackBlocks();
      if (!feedbackBlocks) return;

      return {
        content: [
          ...appendToolResultNote(
            event.content,
            "Scorer images attached below: target, candidate capture, and diff heatmap."
          ),
          ...feedbackBlocks
        ]
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: appendToolResultNote(
          event.content,
          `Failed to attach scorer images: ${message}`
        )
      };
    }
  };

  pi.on("tool_result", handleToolResult);
}
