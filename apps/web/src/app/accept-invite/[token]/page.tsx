import { AcceptInvitePage } from "@/features/team/accept-invite-page";

export default async function AcceptInviteRoute({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="flex min-h-screen items-start justify-center bg-[var(--canvas-warm)] px-4 py-10 text-[var(--text-primary)] sm:items-center sm:px-6">
      <AcceptInvitePage token={token} />
    </main>
  );
}
