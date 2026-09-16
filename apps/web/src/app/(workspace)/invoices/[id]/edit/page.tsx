import { InvoiceFormPage } from "@/features/invoices/invoice-form-page";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <InvoiceFormPage invoiceId={id} mode="edit" />;
}
