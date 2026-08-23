import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <Link className="brand auth-brand" href="/"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>versionless</span></Link>
        <div><span className="auth-kicker">CREATE A PROOF WORKSPACE</span><h1>Move fast.<br /><em>Keep the rules fixed.</em></h1><p>Bring a repository, choose what Codex may change, and lock the behavior that must survive.</p></div>
        <ul className="auth-list"><li><span>✓</span>Isolated repository clone</li><li><span>✓</span>Constrained Codex patch</li><li><span>✓</span>Fresh-clone verification</li></ul>
      </section>
      <section className="auth-panel"><SignUp appearance={{ elements: { rootBox: "clerk-root", cardBox: "clerk-card-box" } }} /></section>
    </main>
  );
}
