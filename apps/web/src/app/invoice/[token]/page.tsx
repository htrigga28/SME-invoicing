import { PublicInvoicePage } from "@/features/public-invoices/public-invoice-page";

export default async function PublicInvoiceRoute({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ payment?: string; reference?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const paymentReferenceProps = query.reference ? { paymentReference: query.reference } : {};

  return (
    <PublicInvoicePage
      paymentCallback={query.payment === "callback" || Boolean(query.reference)}
      token={token}
      {...paymentReferenceProps}
    />
  );
}
