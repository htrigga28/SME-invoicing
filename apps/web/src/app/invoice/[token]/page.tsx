import { PublicInvoicePage } from "@/features/public-invoices/public-invoice-page";

export default async function PublicInvoiceRoute({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <PublicInvoicePage token={token} />;
}
