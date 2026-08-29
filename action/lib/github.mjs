import { appendFile } from "node:fs/promises";

export async function writeStepSummary(summaryPath, markdown) {
  assertFilePath(summaryPath, "GITHUB_STEP_SUMMARY");
  await appendFile(summaryPath, markdown, "utf8");
}

export async function writeActionOutputs(outputPath, outputs) {
  assertFilePath(outputPath, "GITHUB_OUTPUT");
  const lines = Object.entries(outputs).map(([key, value]) => {
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key)) throw new TypeError(`Invalid GitHub output name: ${key}`);
    const serialized = String(value);
    if (/[\r\n]/.test(serialized)) throw new TypeError(`GitHub output ${key} must be a single line.`);
    return `${key}=${serialized}`;
  });
  await appendFile(outputPath, `${lines.join("\n")}\n`, "utf8");
}

function assertFilePath(path, variableName) {
  if (typeof path !== "string" || path.length === 0) {
    throw new TypeError(`${variableName} must contain a runner file path.`);
  }
}
