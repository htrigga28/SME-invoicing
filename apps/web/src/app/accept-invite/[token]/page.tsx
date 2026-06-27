import { AcceptInvitePage } from "@/features/team/accept-invite-page";

export default async function AcceptInviteRoute({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <AcceptInvitePage token={token} />
    </main>
  );
}
