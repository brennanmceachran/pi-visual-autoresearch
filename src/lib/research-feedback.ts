import type { ImageContent, TextContent } from "@mariozechner/pi-ai";
import {
  formatDimensionNote,
  resizeImage
} from "@mariozechner/pi-coding-agent/dist/utils/image-resize.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ARTIFACTS_DIR } from "./paths.js";
import { readCurrentTarget } from "./target.js";

async function makeImageBlock(input: {
  label: string;
  absolutePath: string;
  mimeType: string;
}): Promise<(TextContent | ImageContent)[]> {
  const buffer = await readFile(input.absolutePath);
  const resized = await resizeImage(
    {
      type: "image",
      data: buffer.toString("base64"),
      mimeType: input.mimeType
    },
    {
      maxWidth: 1024,
      maxHeight: 1024,
      maxBytes: 180_000,
      jpegQuality: 80
    }
  );

  const note = formatDimensionNote(resized);

  return [
    {
      type: "text",
      text: note ? `${input.label}\n${note}` : input.label
    },
    {
      type: "image",
      data: resized.data,
      mimeType: resized.mimeType
    }
  ];
}

export async function buildScoreFeedbackBlocks() {
  const target = await readCurrentTarget();
  if (!target) return null;

  const blocks: (TextContent | ImageContent)[] = [
    {
      type: "text",
      text:
        "Visual feedback from the scorer is attached below. Use the target, candidate capture, and diff heatmap to guide the next honest reconstruction."
    }
  ];

  blocks.push(
    ...(await makeImageBlock({
      label: `Target image: ${target.originalName}`,
      absolutePath: target.absolutePath,
      mimeType: target.contentType
    }))
  );

  for (const artifact of [
    {
      label: "Candidate capture",
      fileName: "candidate.png"
    },
    {
      label: "Diff heatmap",
      fileName: "diff.png"
    }
  ]) {
    blocks.push(
      ...(await makeImageBlock({
        label: artifact.label,
        absolutePath: join(ARTIFACTS_DIR, artifact.fileName),
        mimeType: "image/png"
      }))
    );
  }

  return blocks;
}
