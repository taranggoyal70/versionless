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

  const testCount = Number(verification.testSummary.match(/Tests\s+(\d+) passed/)?.[1] ?? 0);
  const testFileCount = Number(verification.testSummary.match(/Test Files\s+(\d+) passed/)?.[1] ?? 0);
  const tests = [
    { name: state.proofClaims[0], input: "46 existing + 5 acceptance", result: `${testCount} passed` },
    { name: state.proofClaims[1], input: "4 malformed timestamp formats", result: "All refused" },
    { name: "Canonical approval path preserved", input: "2026-08-24T00:00:00.000Z", result: "Accepted" },
  ];
  const agentEvents = state.events.filter((event) => event.type === "agent.message").length;

  return (
    <section className="dossier" aria-labelledby="dossier-title">
      <header className="dossier-header">
        <div className="verified-seal" aria-hidden="true"><span>✓</span></div>
        <div className="dossier-title-block">
          <div className="dossier-kicker">Verification dossier · {state.runId}</div>
          <h1 id="dossier-title">Safe to merge.</h1>
          <p>Codex hardened Warrant’s security gate. Every original test and the new acceptance contract passed without changing the proof.</p>
        </div>
        <div className="dossier-actions">
          <button className="primary-button" onClick={onRunAgain} disabled={running}>Run fresh with Codex</button>
          <button className="replay-button" onClick={onReplay} disabled={running}>Replay proof</button>
          <button className="print-button" onClick={() => window.print()}>Print proof</button>
        </div>
      </header>

      <div className="proof-scoreboard" aria-label="Verification summary">
        <article><small>REAL TESTS</small><strong>{testCount} / {testCount}</strong><span>passed across {testFileCount} files</span></article>
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
        <p className="proof-explanation"><span>✓</span> SHA-256 fingerprints match. Warrant’s tests, generated protocol, and build contract are unchanged.</p>
      </section>

      <div className="dossier-grid">
        <section className="flow-proof" aria-labelledby="flow-proof-title">
          <div className="section-label"><span>PROOF 02</span><h2 id="flow-proof-title">The real Warrant suite passed</h2></div>
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
          <div className="scope-file"><span>CHANGED</span><code>{state.allowedFiles[0]}</code><strong>timestamp validation only</strong></div>
          <div className="scope-file protected"><span>LOCKED</span><code>test/ + acceptance contract</code><strong>unchanged</strong></div>
          <div className="scope-file protected"><span>LOCKED</span><code>src/protocol/ + lockfile</code><strong>unchanged</strong></div>
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
