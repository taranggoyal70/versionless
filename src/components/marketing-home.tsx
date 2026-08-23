import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";

function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Versionless home">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
      <span>versionless</span>
    </Link>
  );
}

export function MarketingHome() {
  return (
    <div className="launch-page">
      <header className="launch-nav">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#why">Why Versionless</a>
          <a href="#proof">Proof model</a>
          <a href="#how">How it works</a>
        </nav>
        <div className="launch-account">
          <Show when="signed-out">
            <Link className="nav-login" href="/sign-in">Sign in</Link>
            <Link className="nav-cta" href="/sign-up">Protect your first change</Link>
          </Show>
          <Show when="signed-in">
            <Link className="nav-cta" href="/workspace">Open workspace</Link>
            <UserButton />
          </Show>
        </div>
      </header>

      <main>
        <section className="launch-hero">
          <div className="launch-copy">
            <div className="launch-eyebrow"><span>Proof layer for coding agents</span><b>Live on Warrant</b></div>
            <h1>Let agents change your code.<br /><em>Make them prove it.</em></h1>
            <p>Versionless locks your tests before Codex starts, limits what it may change, then verifies the patch in a second clean repository.</p>
            <div className="launch-actions">
              <Show when="signed-out"><Link className="launch-primary" href="/sign-up">Protect your first change <span>→</span></Link></Show>
              <Show when="signed-in"><Link className="launch-primary" href="/workspace">Open the Warrant run <span>→</span></Link></Show>
              <a className="launch-secondary" href="#proof">See the real proof</a>
            </div>
            <div className="launch-facts"><span>51 real tests</span><span>1 allowed file</span><span>0 protected files changed</span></div>
          </div>

          <div className="hero-proof" aria-label="Example proof dossier">
            <div className="hero-proof-top"><span>VERIFICATION DOSSIER</span><b>SAFE TO MERGE</b></div>
            <div className="hero-proof-repo"><small>REAL REPOSITORY</small><strong>taranggoyal70 / warrant</strong><code>src/gate.ts</code></div>
            <div className="hero-hash">
              <div><small>BEFORE</small><code>a2c372886d50...202e</code></div>
              <strong>=</strong>
              <div><small>AFTER</small><code>a2c372886d50...202e</code></div>
            </div>
            <div className="hero-proof-row"><span>✓</span><div><strong>51 / 51 tests passed</strong><small>6 locked test files</small></div><b>1.78s</b></div>
            <div className="hero-proof-row"><span>✓</span><div><strong>Proof stayed byte-identical</strong><small>SHA-256 verified</small></div><b>LOCKED</b></div>
          </div>
        </section>

        <section className="trust-ribbon">
          <span>BUILT WITH OPENAI CODEX</span><i />
          <span>VERIFIED ON A REAL SECURITY PRODUCT</span><i />
          <span>FRESH-CLONE REPLAY</span>
        </section>

        <section className="story-section" id="why">
          <div className="story-heading"><span>THE TRUST GAP</span><h2>A green check is not proof when the agent can edit the test.</h2></div>
          <div className="story-grid">
            <article><b>01</b><h3>Agents grade their own work</h3><p>The same process that writes a patch can weaken a test, change a script, or hide behavior in another file.</p></article>
            <article><b>02</b><h3>CI trusts what it receives</h3><p>CI checks the repository after the change. It does not prove the definition of success stayed fixed.</p></article>
            <article><b>03</b><h3>Versionless separates worker and proof</h3><p>Codex writes the allowed patch. A clean verifier owns the locked contract and decides if it ships.</p></article>
          </div>
        </section>

        <section className="case-section" id="proof">
          <div className="case-copy"><span>REAL CASE 001</span><h2>We ran it on Warrant, not a toy repository.</h2><p>Warrant protects agent approvals. Versionless found that malformed timestamps could enter its audit record, gave Codex one file to repair, and replayed every invariant from clean state.</p><Link href="/workspace">Open the complete evidence dossier →</Link></div>
          <div className="case-ledger">
            <div><span>Baseline</span><strong>4 attack cases fail</strong></div>
            <div><span>Codex scope</span><strong>src/gate.ts only</strong></div>
            <div><span>Final suite</span><strong>51 tests pass</strong></div>
            <div><span>Integrity</span><strong className="case-good">Exact hash match</strong></div>
          </div>
        </section>

        <section className="how-section" id="how">
          <div className="story-heading"><span>THE RUN</span><h2>One task in. Proof out.</h2></div>
          <ol>
            <li><b>Freeze</b><p>Clone the repository and hash the tests, lockfile, generated contracts, and configuration.</p></li>
            <li><b>Constrain</b><p>Give Codex the exact task and the only files it may change.</p></li>
            <li><b>Replay</b><p>Apply the patch to a second clean clone and run the original proof.</p></li>
            <li><b>Decide</b><p>Ship only when behavior passes, scope holds, and both hashes match.</p></li>
          </ol>
        </section>

        <section className="launch-final">
          <span>YOUR AGENTS ARE FAST ENOUGH.</span>
          <h2>Now make their work provable.</h2>
          <Show when="signed-out"><Link href="/sign-up">Create your workspace →</Link></Show>
          <Show when="signed-in"><Link href="/workspace">Open Versionless →</Link></Show>
        </section>
      </main>

      <footer className="launch-footer"><Brand /><span>Proof for every agent-written change.</span><span>Built at YC with OpenAI Codex.</span></footer>
    </div>
  );
}
