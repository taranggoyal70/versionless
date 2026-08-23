"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { ControlRoom } from "@/components/control-room";
import type { MigrationTargetRequest } from "@/lib/migration/types";

function values(text: string) {
  return text.split(",").map((value) => value.trim()).filter(Boolean);
}

export function WorkspaceShell() {
  const [target, setTarget] = useState<MigrationTargetRequest | null>(null);

  function configureLocal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setTarget({
      type: "local",
      repositoryPath: String(form.get("repositoryPath")),
      task: String(form.get("task")),
      allowedFiles: values(String(form.get("allowedFiles"))),
      lockedPaths: values(String(form.get("lockedPaths"))),
      verificationCommand: {
        executable: String(form.get("executable")),
        args: values(String(form.get("args"))),
      },
    });
  }

  if (target) {
    const label = target.type === "warrant" ? "taranggoyal70 / warrant" : target.repositoryPath;
    return (
      <div className="selected-workspace">
        <div className="target-switcher"><Link href="/">versionless</Link><span>Repository</span><strong>{label}</strong><button onClick={() => setTarget(null)}>Change repository</button></div>
        <ControlRoom targetRequest={target} />
      </div>
    );
  }

  return (
    <main className="repo-onboarding">
      <header className="repo-onboarding-nav"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>versionless</span></Link><span>New verification run</span></header>
      <section className="repo-onboarding-intro"><span>CHOOSE THE CODE</span><h1>What should Codex change?</h1><p>Start with the proven Warrant case, or point Versionless at another local Git repository with a failing acceptance test.</p></section>
      <div className="repo-choice-grid">
        <article className="repo-choice featured">
          <div className="repo-choice-tag">PROVEN CASE · READY NOW</div>
          <div className="repo-choice-head"><span className="repo-avatar">W</span><div><strong>taranggoyal70 / warrant</strong><small>TypeScript · 51 tests</small></div></div>
          <h2>Harden signed audit timestamps</h2>
          <p>Codex may change one security file. Versionless locks the complete Warrant proof contract and generated protocol.</p>
          <ul><li>src/gate.ts only</li><li>51 locked tests</li><li>Deterministic stage replay</li></ul>
          <button onClick={() => setTarget({ type: "warrant" })}>Open Warrant run <span>→</span></button>
        </article>

        <form className="repo-choice local-choice" onSubmit={configureLocal}>
          <div className="repo-choice-tag">LOCAL REPOSITORY · LIVE CODEX</div>
          <h2>Configure another repository</h2>
          <p>The verification command must fail before Codex starts and pass after the requested change.</p>
          <label>Repository path<input name="repositoryPath" required placeholder="/Users/you/project" /></label>
          <label>Task<textarea name="task" required placeholder="Describe the exact behavior Codex must add or repair." /></label>
          <div className="repo-form-pair"><label>Allowed files<input name="allowedFiles" required placeholder="src/auth.ts" /></label><label>Locked paths<input name="lockedPaths" required placeholder="test, package.json" /></label></div>
          <div className="repo-form-pair"><label>Test executable<input name="executable" required placeholder="npm" /></label><label>Arguments, comma separated<input name="args" required placeholder="test" /></label></div>
          <button type="submit">Use this repository <span>→</span></button>
          <small>Runs only on your local Versionless runtime. Paths never leave this machine.</small>
        </form>
      </div>
    </main>
  );
}
