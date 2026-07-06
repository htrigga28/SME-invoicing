import { PublicReceiptPage } from "@/features/receipts/public-receipt-page";

export default async function PublicReceiptRoute({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicReceiptPage token={token} />;
}
