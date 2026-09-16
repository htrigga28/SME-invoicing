import { CustomerFormPage } from "@/features/customers/customer-form-page";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <CustomerFormPage customerId={id} mode="edit" />;
}
