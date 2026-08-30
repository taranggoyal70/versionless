export function createSkippedVerification() {
  return {
    passed: false,
    skipped: true,
    exitCode: null,
    signal: null,
    timedOut: false,
    stdout: "",
    stderr: "",
    stdoutTruncated: false,
    stderrTruncated: false,
    durationMs: 0,
  };
}
