"use client";

import { useMemo, useReducer, useState } from "react";

import { VerificationDossier } from "@/components/verification-dossier";
import { initialMigrationState, reduceMigrationEvent, type MigrationPhase } from "@/lib/migration/state";
import type { MigrationEvent } from "@/lib/migration/types";

const steps = [
  { key: "impact", number: "01", label: "Find the gap", detail: "Trace unvalidated audit data into Warrant." },
  { key: "lock", number: "02", label: "Lock the proof", detail: "Hash 51 tests and generated protocol first." },
  { key: "patch", number: "03", label: "Repair with Codex", detail: "Change only the affected implementation." },
  { key: "verify", number: "04", label: "Replay the behavior", detail: "Run the same Warrant suite against the patch." },
  { key: "evidence", number: "05", label: "Ship the proof", detail: "Package the diff, run, and integrity result." },
] as const;

const eventLabels: Record<MigrationEvent["type"], string> = {
  "run.started": "Migration opened",
  "contract.loaded": "Stripe release loaded",
  "impact.found": "Breaking callsite found",
  "integrity.locked": "Behavior contract locked",
  "baseline.failed": "Break reproduced",
  "agent.started": "Codex started",
  "agent.message": "Codex activity",
  "patch.ready": "Patch created",
  "verification.started": "Behavior replay started",
  "verification.completed": "Behavior replay finished",
  "evidence.ready": "Evidence bundle ready",
  "run.completed": "Migration complete",
  "run.failed": "Migration stopped",
};

function stepState(step: (typeof steps)[number]["key"], phase: MigrationPhase, hasImpact: boolean) {
  const active: Record<typeof step, boolean> = {
    impact: phase === "analyzing",
    lock: phase === "broken",
    patch: phase === "migrating",
    verify: phase === "verifying",
    evidence: phase === "verified" || phase === "rejected",
  };
  const complete: Record<typeof step, boolean> = {
    impact: hasImpact,
    lock: ["broken", "migrating", "verifying", "verified", "rejected"].includes(phase),
    patch: ["verifying", "verified", "rejected"].includes(phase),
    verify: ["verified", "rejected"].includes(phase),
    evidence: phase === "verified",
  };
  return complete[step] ? "complete" : active[step] ? "active" : "waiting";
}

function phaseCopy(phase: MigrationPhase) {
  switch (phase) {
    case "idle":
      return "Ready to inspect";
    case "analyzing":
      return "Reading the contract";
    case "broken":
      return "Break reproduced";
    case "migrating":
      return "Codex is repairing";
    case "verifying":
      return "Replaying locked behavior";
    case "verified":
      return "Safe to upgrade";
    case "rejected":
      return "Patch rejected";
    case "failed":
      return "Run stopped";
  }
}

function compactHash(hash: string | null) {
  if (!hash) return "Waiting for lock";
  return `${hash.slice(0, 15)}…${hash.slice(-8)}`;
}

function ProductNavigation() {
  return (
    <nav className="topbar" aria-label="Product navigation">
      <a className="brand" href="#top" aria-label="Versionless home">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span>versionless</span>
      </a>
      <div className="repo-pill">
        <span className="repo-dot" />
        taranggoyal70 / warrant
      </div>
      <div className="top-status"><span>Migration runtime</span><strong>local only</strong></div>
    </nav>
  );
}

export function ControlRoom() {
  const [state, dispatch] = useReducer(reduceMigrationEvent, initialMigrationState);
  const [running, setRunning] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const progress = useMemo(() => {
    if (state.phase === "verified" || state.phase === "rejected") return 100;
    if (state.phase === "verifying") return 82;
    if (state.phase === "migrating") return 58;
    if (state.phase === "broken") return 38;
    if (state.phase === "analyzing") return 16;
    return 4;
  }, [state.phase]);

  async function startMigration(mode: "codex" | "replay") {
    setRunning(true);
    setStreamError(null);
    try {
      const response = await fetch("/api/migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!response.ok || !response.body) throw new Error("The migration service did not start.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) dispatch(JSON.parse(line) as MigrationEvent);
        }
      }
      if (buffer.trim()) dispatch(JSON.parse(buffer) as MigrationEvent);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The event stream stopped unexpectedly.";
      setStreamError(message);
      dispatch({ type: "run.failed", runId: state.runId ?? "client", error: message, at: new Date().toISOString() });
    } finally {
      setRunning(false);
    }
  }

  const verified = state.phase === "verified";
  const broken = state.baselineBroken && !verified;

  if (verified && state.verification && state.diff) {
    return (
      <main className="shell proof-shell">
        <ProductNavigation />
        <VerificationDossier
          state={state}
          running={running}
          onRunAgain={() => startMigration("codex")}
          onReplay={() => startMigration("replay")}
        />
      </main>
    );
  }

  return (
    <main className="shell">
      <ProductNavigation />

      <section className="hero" id="top">
        <div className="eyebrow"><span>Live repository</span> Warrant security hardening</div>
        <div className="hero-grid">
          <div>
            <h1>Can Codex change security code<br /><em>without changing the proof?</em></h1>
            <p className="lede">Versionless clones the real Warrant repository, locks its full test contract, gives Codex one allowed file, then proves every security invariant still holds.</p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => startMigration("codex")} disabled={running}>
                <span>{running ? "Migration running" : verified ? "Run again with Codex" : "Repair with Codex"}</span>
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4" /></svg>
              </button>
              <button className="replay-button" onClick={() => startMigration("replay")} disabled={running}>
                Replay verified run
              </button>
            </div>
            <p className="fallback-note">Live Codex is the main path. Replay is the on-stage fallback.</p>
          </div>

          <div className={`contract-bridge ${verified ? "is-fixed" : ""}`} aria-label="Warrant contract hardening">
            <div className="version-card old"><small>CURRENT</small><strong>{state.fromVersion}</strong><span>approvedAt accepted raw</span></div>
            <div className="bridge-line"><span className="pulse" /><b>{verified ? "VERIFIED" : "BREAKING"}</b></div>
            <div className="version-card target"><small>TARGET</small><strong>{state.toVersion}</strong><span>canonical UTC only</span></div>
          </div>
        </div>
      </section>

      <section className="run-header" aria-live="polite">
        <div><span className={`state-light ${verified ? "good" : broken ? "bad" : ""}`} />{phaseCopy(state.phase)}</div>
        <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        <code>{state.runId ?? "new migration"}</code>
      </section>

      <section className="workbench">
        <aside className="pipeline-panel">
          <div className="panel-kicker">Migration pipeline</div>
          <ol className="step-list">
            {steps.map((step) => {
              const status = stepState(step.key, state.phase, state.impacts.length > 0);
              return (
                <li key={step.key} className={status}>
                  <span className="step-number">{status === "complete" ? "✓" : step.number}</span>
                  <div><strong>{step.label}</strong><p>{step.detail}</p></div>
                </li>
              );
            })}
          </ol>
          <div className="integrity-card">
            <div className="lock-icon" aria-hidden="true">⌁</div>
            <div><small>LOCKED CONTRACT</small><code>{compactHash(state.lockedHash)}</code></div>
            <strong>{state.verification?.integrity === "unchanged" ? "UNCHANGED" : state.lockedHash ? "SEALED" : "PENDING"}</strong>
          </div>
        </aside>

        <div className="evidence-panel">
          <div className="panel-tabs">
            <span className="active">Contract impact</span>
            <span>Evidence {state.artifactCount ? `(${state.artifactCount})` : ""}</span>
            <div className="review-handoff">Greptile review <b>after repo push</b></div>
          </div>

          <div className="impact-summary">
            <div><small>{state.impacts.length ? "AUDIT INTEGRITY GAP" : "REAL REPOSITORY PREVIEW"}</small><h2>Unvalidated timestamps enter signed approval records</h2></div>
            <span className={verified ? "resolved-badge" : "risk-badge"}>{verified ? "RESOLVED" : state.impacts.length ? "HIGH IMPACT" : "NOT SCANNED"}</span>
          </div>

          <div className="code-window">
            <div className="code-bar"><span><i /><i /><i /></span><code>src/gate.ts</code><b>{state.impacts.length} {state.impacts.length === 1 ? "boundary" : "boundaries"}</b></div>
            {state.diff ? (
              <pre className="diff" aria-label="Generated migration diff">
                {state.diff.split("\n").map((line, index) => (
                  <span key={`${index}-${line}`} className={line.startsWith("+") && !line.startsWith("+++") ? "added" : line.startsWith("-") && !line.startsWith("---") ? "removed" : "context"}>{line}</span>
                ))}
              </pre>
            ) : (
              <div className="source-preview">
                <div><span>97</span><code>{"const { artifact, approver, policy, approvedAt } = input;"}</code></div>
                <div><span>98</span><code>{"if (!approver.trim()) throw new Error(…);"}</code></div>
                <div className="danger-line"><span>99</span><code><mark>approvedAt is never validated</mark></code><b>UNTRUSTED</b></div>
                <div><span>100</span><code>{"return { digest: artifact.digest, approvedAt, … };"}</code></div>
              </div>
            )}
          </div>

          <div className="proof-grid">
            <article className={state.baselineBroken ? "proof-card failed-proof" : "proof-card"}>
              <small>BEFORE CODEX</small><strong>{state.baselineBroken ? "4 attack cases failed" : "Waiting for isolated run"}</strong><p>Malformed timestamps entered the audit record.</p>
            </article>
            <article className={verified ? "proof-card passed-proof" : "proof-card"}>
              <small>AFTER CODEX</small><strong>{verified ? "51 security tests passed" : "Locked suite waiting"}</strong><p>{verified ? `Passed in ${state.verification?.durationMs ?? 0}ms. Test hash matched.` : "The same Warrant suite will run after Codex."}</p>
            </article>
            <article className="proof-card agent-proof">
              <small>{state.agentName ?? "OPENAI CODEX"}</small><strong>{state.filesChanged ? `${state.filesChanged} file changed` : "Constrained repair"}</strong><p>{state.agentMessages.at(-1) ?? "Can edit src/gate.ts. Cannot edit the proof."}</p>
            </article>
          </div>

          {(state.events.length > 0 || streamError || state.error) && (
            <div className="event-log">
              <div className="event-log-title"><span>Live flight recorder</span><b>{state.events.length} events</b></div>
              <div className="event-scroll">
                {state.events.slice(-7).map((event, index) => (
                  <div key={`${event.at}-${event.type}-${index}`}><time>{new Date(event.at).toLocaleTimeString([], { hour12: false })}</time><span>{eventLabels[event.type]}</span></div>
                ))}
                {(streamError || state.error) && <div className="log-error"><time>ERROR</time><span>{streamError ?? state.error}</span></div>}
              </div>
            </div>
          )}
        </div>
      </section>

      <footer>
        <span>Built with Codex as the migration runtime</span>
        <span>Behavior first. Diff second.</span>
      </footer>
    </main>
  );
}
