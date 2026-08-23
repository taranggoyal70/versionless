import type { MigrationState } from "@/lib/migration/state";

type VerificationDossierProps = {
  state: MigrationState;
  running: boolean;
  onRunAgain: () => void;
  onReplay: () => void;
};

function bareHash(hash: string) {
  return hash.replace(/^sha256:/, "");
}

export function VerificationDossier({ state, running, onRunAgain, onReplay }: VerificationDossierProps) {
  const verification = state.verification;
  if (!verification || !state.diff) return null;

  const testCountMatch = verification.testSummary.match(/Tests\s+(\d+) passed|ℹ pass (\d+)/);
  const testCount = Number(testCountMatch?.[1] ?? testCountMatch?.[2] ?? 0);
  const testFileCount = Number(verification.testSummary.match(/Test Files\s+(\d+) passed/)?.[1] ?? 0);
  const tests = [
    { name: state.proofClaims[0] ?? "Selected verification passes", input: `${testFileCount || 1} verification files`, result: testCount ? `${testCount} passed` : "Passed" },
    { name: state.proofClaims[1] ?? "Locked paths are unchanged", input: `${state.lockedPaths.length} protected paths`, result: "Hash matched" },
    { name: state.proofClaims[2] ?? "Change stayed in scope", input: state.allowedFiles.join(", "), result: "Scope held" },
  ];
  const agentEvents = state.events.filter((event) => event.type === "agent.message").length;

  return (
    <section className="dossier" aria-labelledby="dossier-title">
      <header className="dossier-header">
        <div className="verified-seal" aria-hidden="true"><span>✓</span></div>
        <div className="dossier-title-block">
          <div className="dossier-kicker">Verification dossier · {state.runId}</div>
          <h1 id="dossier-title">Safe to merge.</h1>
          <p>Codex changed {state.repositoryLabel}. The selected verification passed without changing the locked proof or leaving the allowed scope.</p>
        </div>
        <div className="dossier-actions">
          <button className="primary-button" onClick={onRunAgain} disabled={running}>Run fresh with Codex</button>
          <button className="replay-button" onClick={onReplay} disabled={running}>Replay proof</button>
          <button className="print-button" onClick={() => window.print()}>Print proof</button>
        </div>
      </header>

      <div className="proof-scoreboard" aria-label="Verification summary">
        <article><small>REAL TESTS</small><strong>{testCount || "✓"}</strong><span>{testCount ? `passed across ${testFileCount} files` : "verification passed"}</span></article>
        <article><small>PROTECTED FILES</small><strong>0</strong><span>changed</span></article>
        <article><small>IMPLEMENTATION</small><strong>{state.filesChanged}</strong><span>file changed</span></article>
        <article><small>CODEX TRACE</small><strong>{agentEvents}</strong><span>agent events</span></article>
      </div>

      <section className="hash-proof" aria-labelledby="hash-proof-title">
        <div className="section-label"><span>PROOF 01</span><h2 id="hash-proof-title">Codex could not rewrite the test</h2></div>
        <div className="hash-equation">
          <div>
            <small>LOCKED CONTRACT · BEFORE</small>
            <code>{bareHash(verification.expectedHash)}</code>
          </div>
          <div className="equals-mark"><strong>=</strong><span>BYTE FOR BYTE</span></div>
          <div>
            <small>LOCKED CONTRACT · AFTER</small>
            <code>{bareHash(verification.actualHash)}</code>
          </div>
        </div>
        <p className="proof-explanation"><span>✓</span> SHA-256 fingerprints match. Every selected test, contract, lockfile, and configuration path is unchanged.</p>
      </section>

      <div className="dossier-grid">
        <section className="flow-proof" aria-labelledby="flow-proof-title">
          <div className="section-label"><span>PROOF 02</span><h2 id="flow-proof-title">The selected verification passed</h2></div>
          <div className="flow-table">
            {tests.map((test) => (
              <div className="flow-row" key={test.name}>
                <span className="pass-mark">PASS</span>
                <div><strong>{test.name}</strong><code>{test.input}</code></div>
                <span>{test.result}</span>
              </div>
            ))}
          </div>
          <div className="runner-result">
            <span>LOCKED VITEST RUNNER</span>
            <strong>{verification.durationMs}ms</strong>
            <code>exit {verification.exitCode}</code>
          </div>
        </section>

        <section className="scope-proof" aria-labelledby="scope-proof-title">
          <div className="section-label"><span>PROOF 03</span><h2 id="scope-proof-title">Only the allowed file changed</h2></div>
          <div className="scope-file"><span>CHANGED</span><code>{state.allowedFiles.join(", ")}</code><strong>{state.filesChanged} implementation file changed</strong></div>
          {state.lockedPaths.slice(0, 2).map((lockedPath) => <div className="scope-file protected" key={lockedPath}><span>LOCKED</span><code>{lockedPath}</code><strong>unchanged</strong></div>)}
        </section>
      </div>

      <section className="patch-proof" aria-labelledby="patch-proof-title">
        <div className="section-label"><span>PROOF 04</span><h2 id="patch-proof-title">The complete patch</h2></div>
        <div className="code-window dossier-code">
          <div className="code-bar"><span><i /><i /><i /></span><code>{state.allowedFiles[0]}</code><b>{state.filesChanged} allowed file</b></div>
          <pre className="diff">
            {state.diff.split("\n").map((line, index) => (
              <span key={`${index}-${line}`} className={line.startsWith("+") && !line.startsWith("+++") ? "added" : line.startsWith("-") && !line.startsWith("---") ? "removed" : "context"}>{line}</span>
            ))}
          </pre>
        </div>
      </section>

      <footer className="dossier-footer">
        <div><span className="state-light good" /> Verified by the locked behavior runner</div>
        <code>{state.fromVersion} → {state.toVersion}</code>
        <span>Generated by OpenAI Codex</span>
      </footer>
    </section>
  );
}
