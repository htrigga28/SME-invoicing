import { describe, expect, it } from "vitest";

import { validateAcceptInviteForm, validateInvitationForm } from "./validation";

describe("team validation", () => {
  it("validates invitation email and role", () => {
    expect(validateInvitationForm({ email: "bad", role: "" })).toEqual({
      email: "A valid email is required.",
      role: "Select an invitation role."
    });
  });

  it("validates new invited user fields", () => {
    expect(validateAcceptInviteForm({ name: "", password: "short" })).toEqual({
      name: "Name is required.",
      password: "Password must be at least 8 characters."
    });
  });
});
