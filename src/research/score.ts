import { evaluateCurrentTarget } from "../lib/evaluator.js";

async function main() {
  const report = await evaluateCurrentTarget();

  console.log(`Target: ${report.target.originalName} (${report.stage.width}x${report.stage.height})`);
  console.log(`Score: ${report.score.toFixed(4)}%`);
  console.log(`Difference: ${report.difference.toFixed(4)}%`);
  console.log(`Evaluation: ${report.evaluationMs}ms`);
  console.log(`Artifacts: ${report.artifacts.candidate}, ${report.artifacts.diff}`);
  console.log(`METRIC similarity=${report.score.toFixed(4)}`);
  console.log(`METRIC difference=${report.difference.toFixed(4)}`);
  console.log(`METRIC evaluation_ms=${report.evaluationMs}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Evaluation failed: ${message}`);
  process.exitCode = 1;
});
