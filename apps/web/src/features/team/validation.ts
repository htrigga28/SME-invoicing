import type { FormErrors } from "@/features/auth/validation";
import type { InviteRole } from "./types";

export type InvitationFields = "email" | "role";
export type AcceptInviteFields = "name" | "password";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateInvitationForm(input: { email: string; role: InviteRole | "" }) {
  const errors: FormErrors<InvitationFields> = {};

  if (!emailPattern.test(input.email.trim())) errors.email = "A valid email is required.";
  if (!["admin", "accountant", "viewer"].includes(input.role)) {
    errors.role = "Select an invitation role.";
  }

  return errors;
}

export function validateAcceptInviteForm(input: { name: string; password: string }) {
  const errors: FormErrors<AcceptInviteFields> = {};

  if (!input.name.trim()) errors.name = "Name is required.";
  if (input.password.length < 8) errors.password = "Password must be at least 8 characters.";

  return errors;
}
