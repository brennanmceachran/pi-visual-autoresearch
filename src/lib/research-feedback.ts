import type { ImageContent, TextContent } from "@mariozechner/pi-ai";
import {
  formatDimensionNote,
  resizeImage
} from "../../node_modules/@mariozechner/pi-coding-agent/dist/utils/image-resize.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ARTIFACTS_DIR } from "./paths.js";
import { readLatestReport } from "./evaluator.js";
import { readCurrentTarget } from "./target.js";

async function makeImageBlock(input: {
  label: string;
  absolutePath: string;
  mimeType: string;
}): Promise<(TextContent | ImageContent)[]> {
  const buffer = await readFile(input.absolutePath);
  const base64 = buffer.toString("base64");
  const resized = await resizeImage(
    {
      type: "image",
      data: base64,
      mimeType: input.mimeType
    },
    {
      maxWidth: 1400,
      maxHeight: 1400,
      maxBytes: 300_000,
      jpegQuality: 76
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

export async function buildScoreFeedbackBlocks(input?: {
  minGeneratedAt?: number;
}) {
  const [target, report] = await Promise.all([
    readCurrentTarget(),
    readLatestReport()
  ]);

  if (!target || !report) return null;
  if (report.target.updatedAt !== target.updatedAt) return null;

  const reportGeneratedAt = new Date(report.generatedAt).getTime();
  if (
    input?.minGeneratedAt !== undefined &&
    (!Number.isFinite(reportGeneratedAt) || reportGeneratedAt < input.minGeneratedAt)
  ) {
    return null;
  }

  const blocks: (TextContent | ImageContent)[] = [
    {
      type: "text",
      text:
        "Visual feedback from this successful scorer run is attached below. Use the target, candidate capture, and diff heatmap to guide the next honest reconstruction. Lower diff is better. Diff heatmap reminder: transparent means no visible penalty, blue and green mean smaller penalties, yellow and red mean larger penalties. Fix the hottest red regions first; if the whole frame is noisy, fix layout, scale, and alignment first."
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
