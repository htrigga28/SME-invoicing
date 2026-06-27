import { AuthCard } from "@/features/auth/auth-card";
import { RegisterForm } from "@/features/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your workspace"
      description="Register directly to create your internal organisation and start business profile setup."
    >
      <RegisterForm />
    </AuthCard>
  );
}
