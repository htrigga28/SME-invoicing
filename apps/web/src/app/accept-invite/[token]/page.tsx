import { AcceptInvitePage } from "@/features/team/accept-invite-page";

export default async function AcceptInviteRoute({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 text-[var(--text-primary)] sm:px-6">
      <AcceptInvitePage token={token} />
    </main>
  );
}
