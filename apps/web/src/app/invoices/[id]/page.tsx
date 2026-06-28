import { InvoiceDetailPage } from "@/features/invoices/invoice-detail-page";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <InvoiceDetailPage invoiceId={id} />;
}
