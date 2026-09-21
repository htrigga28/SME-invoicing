import type { MeResponse } from "@/features/auth/types";

export const demoMe = {
  user: {
    id: "user-1",
    email: "owner@demo.com",
    name: "Demo Owner"
  },
  activeOrganisation: {
    id: "org-1",
    name: "Akin & Co Creative Services",
    slug: "akin-co-demo",
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z"
  },
  membership: {
    id: "member-1",
    organisationId: "org-1",
    userId: "user-1",
    role: "owner",
    status: "active"
  },
  businessProfile: {
    id: "profile-1",
    organisationId: "org-1",
    businessName: "Akin & Co Creative Services",
    email: "billing@akinco.test",
    phone: "+2348012345678",
    address: "12 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
    logoFileId: null,
    setupCompletedAt: "2026-01-01T00:00:00.000Z"
  },
  onboardingRequired: false,
  onboardingStep: null,
  selectionRequired: false
} satisfies MeResponse;
