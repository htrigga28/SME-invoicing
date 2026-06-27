import { AuthCard } from "@/features/auth/auth-card";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <AuthCard title="Login" description="Access your invoice and payment reconciliation workspace.">
      <LoginForm />
    </AuthCard>
  );
}
