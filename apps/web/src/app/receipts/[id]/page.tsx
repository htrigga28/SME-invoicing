import { ReceiptDetailPage } from "@/features/receipts/receipt-detail-page";

export default async function ReceiptDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReceiptDetailPage receiptId={id} />;
}
