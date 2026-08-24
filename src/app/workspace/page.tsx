import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace-shell";

export default async function WorkspacePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/workspace");
  return <WorkspaceShell hosted={Boolean(process.env.VERCEL)} />;
}
