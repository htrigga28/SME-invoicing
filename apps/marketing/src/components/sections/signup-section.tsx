import { Building2, Landmark, ShieldCheck, UserRoundPlus } from "lucide-react";

import { SignupAnchor } from "@/components/ui/signup-anchor";
import { signup } from "@/content/site-copy";
import { getAppLoginUrl } from "@/lib/urls";

const signupSteps = [
  {
    icon: UserRoundPlus,
    label: "Account",
    title: "Create your owner account",
    copy: "Use your name, email, and password to create a secure Lumina workspace."
  },
  {
    icon: Building2,
    label: "Business",
    title: "Add invoice details",
    copy: "Set the business identity customers will see on invoices and receipts."
  },
  {
    icon: Landmark,
    label: "Payments",
    title: "Connect your payout account",
    copy: "Resolve and confirm the Nigerian bank account used for Paystack settlements."
  }
] as const;

export function SignupSection() {
  return (
    <section className="signup-section" id="get-started">
      <div aria-hidden="true" className="signup-route">
        <span />
        <span />
      </div>
      <div className="shell-container signup-layout">
        <div className="signup-copy">
          <span className="signup-mark">
            <UserRoundPlus aria-hidden="true" />
          </span>
          <p className="section-signal">Create your workspace</p>
          <h2>{signup.heading}</h2>
          <p>{signup.copy}</p>
          <div className="signup-boundary">
            <ShieldCheck aria-hidden="true" />
            <span>
              Your payout account is resolved through Paystack. Lumina stores only the masked
              account details needed to operate your payment trail.
            </span>
          </div>
        </div>

        <div className="signup-trail">
          <div className="signup-trail-heading">
            <span className="data-label">YOUR PATH INTO LUMINA</span>
            <strong>Three connected steps. One working payment trail.</strong>
          </div>
          <ol>
            {signupSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.label}>
                  <span className="signup-step-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <div>
                    <span>{`${index + 1} · ${step.label}`}</span>
                    <h3>{step.title}</h3>
                    <p>{step.copy}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="signup-actions">
            <SignupAnchor className="w-full" size="lg">
              Create account
            </SignupAnchor>
            <a className="signup-signin" href={getAppLoginUrl()}>
              Already have a workspace? Sign in
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
