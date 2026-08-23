# Three-minute demo

## 0:00-0:30 - The problem

“AI agents can write code fast. But there is one big problem: the same agent can also change the tests. If the code and the proof both changed, a green check means nothing.”

“This is Warrant, my real security product. It protects agent approvals. Right now its audit timestamp enters the signed record without strict validation.”

## 0:25-1:40 - The migration

Click **Repair with Codex**.

“First, Versionless makes an isolated copy. Then it locks 51 tests, the generated Codex protocol, the lockfile, and the TypeScript contract. Codex can change one file: `src/gate.ts`. It cannot change the proof.”

Let the flight recorder move. If the live run is slow or the room network is unstable, use **Replay verified run** and say it is the recorded fallback.

## 1:40-2:35 - The proof

Pause on the diff and green result.

“Codex found the right fix by itself. It changed one file. Then Versionless took that patch and applied it to a second clean clone.”

Point at the scoreboard and hashes.

“All 51 real tests passed across six files. Zero protected files changed. And these two hashes match byte for byte. So Codex did not rewrite the rules to make itself look correct.”

## 2:35-3:00 - The product

“Warrant is the first real repo, but it is not hard-coded. For another repo, I give Versionless the test command, protected files, allowed files, and task. The proof engine stays the same.”

Close with: **“Agents can write code. Versionless makes their work provable.”**

## Q&A anchors

- **Why not CI?** CI trusts the repository it receives. Versionless proves the agent did not change the tests or verifier that define success.
- **How is Codex constrained?** One allowed file, a workspace-write sandbox, locked proof inputs, and verification in a second clean clone.
- **Can it run on another repo?** Yes. A target adapter supplies the repository, test command, protected paths, allowed paths, task, and acceptance contract.
- **Where is Codex?** It built Versionless and performs the live Warrant change. The flight recorder shows its real commands and reasoning.
- **What is real?** The Warrant repository, Codex process, Git diff, 51 tests, fresh-clone verification, and SHA-256 integrity check are all live.
