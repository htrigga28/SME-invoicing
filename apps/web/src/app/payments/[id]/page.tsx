import { PaymentDetailPage } from "@/features/payments/payment-detail-page";

export default async function PaymentDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaymentDetailPage paymentId={id} />;
}
