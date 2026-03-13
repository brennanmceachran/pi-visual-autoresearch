import { readFile } from "node:fs/promises";

import { AUTORESEARCH_LOG_PATH } from "./paths.js";

interface ConfigLine {
  type: "config";
  name?: string;
  metricName?: string;
  metricUnit?: string;
  bestDirection?: "lower" | "higher";
}

interface ResultLine {
  commit?: string;
  metric?: number;
  metrics?: Record<string, number>;
  status?: "keep" | "discard" | "crash";
  description?: string;
  timestamp?: number;
}

export interface HistoryRun {
  id: string;
  commit: string;
  metric: number;
  metrics: Record<string, number>;
  status: "keep" | "discard" | "crash";
  description: string;
  timestamp: number;
}

export interface HistorySnapshot {
  name: string | null;
  metricName: string;
  metricUnit: string;
  bestDirection: "lower" | "higher";
  runs: HistoryRun[];
}

export async function readHistory(limit = 16): Promise<HistorySnapshot> {
  try {
    const raw = await readFile(AUTORESEARCH_LOG_PATH, "utf8");
    const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);

    let latestConfig: ConfigLine | null = null;
    let segment = 0;
    const runs: Array<HistoryRun & { segment: number }> = [];

    for (const line of lines) {
      const parsed = JSON.parse(line) as ConfigLine | ResultLine;

      if ((parsed as ConfigLine).type === "config") {
        if (runs.length > 0) {
          segment += 1;
        }
        latestConfig = parsed as ConfigLine;
        continue;
      }

      const result = parsed as ResultLine;
      runs.push({
        id: `${segment}-${runs.length + 1}`,
        commit: result.commit ?? "-------",
        metric: result.metric ?? 0,
        metrics: result.metrics ?? {},
        status: result.status ?? "keep",
        description: result.description ?? "",
        timestamp: result.timestamp ?? 0,
        segment
      });
    }

    const latestSegment = runs.length > 0 ? runs[runs.length - 1]!.segment : segment;
    const segmentRuns = runs.filter((run) => run.segment === latestSegment);

    return {
      name: latestConfig?.name ?? null,
      metricName: latestConfig?.metricName ?? "similarity",
      metricUnit: latestConfig?.metricUnit ?? "%",
      bestDirection: latestConfig?.bestDirection ?? "higher",
      runs: segmentRuns.slice(-limit).map(({ segment: _segment, ...run }) => run)
    };
  } catch {
    return {
      name: null,
      metricName: "similarity",
      metricUnit: "%",
      bestDirection: "higher",
      runs: []
    };
  }
}

