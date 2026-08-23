import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <Link className="brand auth-brand" href="/"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>versionless</span></Link>
        <div><span className="auth-kicker">RETURN TO THE PROOF</span><h1>Your agent wrote the patch.<br /><em>You still own the decision.</em></h1><p>Sign in to inspect the Warrant run, replay its locked test contract, and review the complete Codex diff.</p></div>
        <div className="auth-proof"><span>LAST VERIFIED RUN</span><strong>51 / 51 tests passed</strong><code>a2c372886d50...202e</code></div>
      </section>
      <section className="auth-panel"><SignIn appearance={{ elements: { rootBox: "clerk-root", cardBox: "clerk-card-box" } }} /></section>
    </main>
  );
}
