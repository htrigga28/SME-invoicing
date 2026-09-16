import { AuthCard } from "@/features/auth/auth-card";
import { RegisterForm } from "@/features/auth/register-form";
import { OnboardingProgress } from "@/features/onboarding/onboarding-progress";

export default function RegisterPage() {
  return (
    <AuthCard
      title="Create your workspace"
      description="Register directly to create your internal organisation and start business profile setup."
    >
      <div className="space-y-6">
        <OnboardingProgress currentStep={1} />
        <RegisterForm />
      </div>
    </AuthCard>
  );
}
