export type FormErrors<TFields extends string> = Partial<Record<TFields, string>>;

export type RegisterFields = "name" | "email" | "password";
export type LoginFields = "email" | "password";
export type BusinessProfileFields = "businessName" | "email" | "phone" | "address";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegisterForm(input: Record<RegisterFields, string>) {
  const errors: FormErrors<RegisterFields> = {};

  if (!input.name.trim()) errors.name = "Name is required.";
  if (!emailPattern.test(input.email.trim())) errors.email = "A valid email is required.";
  if (input.password.length < 8) errors.password = "Password must be at least 8 characters.";

  return errors;
}

export function validateLoginForm(input: Record<LoginFields, string>) {
  const errors: FormErrors<LoginFields> = {};

  if (!emailPattern.test(input.email.trim())) errors.email = "A valid email is required.";
  if (!input.password) errors.password = "Password is required.";

  return errors;
}

export function validateBusinessProfileForm(input: Record<BusinessProfileFields, string>) {
  const errors: FormErrors<BusinessProfileFields> = {};

  if (!input.businessName.trim()) errors.businessName = "Business name is required.";
  if (!emailPattern.test(input.email.trim())) errors.email = "A valid email is required.";
  if (!input.phone.trim()) errors.phone = "Phone is required.";
  if (!input.address.trim()) errors.address = "Address is required.";

  return errors;
}

export function isSubmitDisabled(isSubmitting: boolean) {
  return isSubmitting;
}
