import { RecurringFormPage } from "@/features/recurring/recurring-form-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecurringFormPage scheduleId={id} />;
}
