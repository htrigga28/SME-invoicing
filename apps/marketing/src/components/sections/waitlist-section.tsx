"use client";

import { CheckCircle2, ChevronDown, LockKeyhole, Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { MarketingButton } from "@/components/ui/marketing-button";
import { waitlist } from "@/content/site-copy";
import { submitWaitlistEntry, type WaitlistUtm } from "@/lib/waitlist-api";

type FormState = "idle" | "submitting" | "success" | "validation-error" | "server-error";

type FormValues = {
  email: string;
  fullName: string;
  companyName: string;
  role: string;
  website: string;
};

const initialValues: FormValues = {
  email: "",
  fullName: "",
  companyName: "",
  role: "",
  website: ""
};

const waitlistSources = new Set(["nav", "hero", "feature", "final_cta"]);

export function WaitlistSection() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [formState, setFormState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [source, setSource] = useState("waitlist");
  const [utm, setUtm] = useState<WaitlistUtm>({});
  const [referrer, setReferrer] = useState<string | null>(null);

  const emailError = useMemo(() => {
    if (!values.email.trim()) return "Work email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return "Enter a valid work email.";
    return "";
  }, [values.email]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incomingSource = params.get("waitlist_source");
    if (incomingSource && waitlistSources.has(incomingSource)) setSource(incomingSource);
    setUtm({
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      utm_content: params.get("utm_content"),
      utm_term: params.get("utm_term")
    });
    setReferrer(document.referrer || null);

    const onSource = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) setSource(detail);
    };

    window.addEventListener("lumina:waitlist-source", onSource);
    return () => window.removeEventListener("lumina:waitlist-source", onSource);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emailError) {
      setFormState("validation-error");
      setMessage(emailError);
      return;
    }

    setFormState("submitting");
    setMessage("");

    try {
      await submitWaitlistEntry({
        email: values.email,
        fullName: values.fullName || null,
        companyName: values.companyName || null,
        role: values.role || null,
        source,
        utm,
        referrer,
        website: values.website || null
      });
      setFormState("success");
      setMessage(waitlist.successCopy);
    } catch (error) {
      setFormState("server-error");
      setMessage(error instanceof Error ? error.message : "We could not join the waitlist right now. Please try again.");
    }
  }

  return (
    <section className="waitlist-section" id="waitlist">
      <div aria-hidden="true" className="waitlist-route"><span /><span /></div>
      <div className="shell-container waitlist-layout">
        <div className="waitlist-copy">
          <span className="waitlist-mark"><Sparkles aria-hidden="true" /></span>
          <p className="section-signal">Early access</p>
          <h2>{waitlist.heading}</h2>
          <p>{waitlist.copy}</p>
          <div className="waitlist-boundary">
            <LockKeyhole aria-hidden="true" />
            <span>Waitlist details are used only to manage early-access interest and referral context.</span>
          </div>
        </div>

        <form className="waitlist-form" noValidate onSubmit={onSubmit}>
          <div className="form-heading">
            <span className="data-label">YOUR PLACE ON THE TRAIL</span>
            <strong>Start with your work email.</strong>
          </div>

          <div className="email-field">
            <label htmlFor="waitlist-email">Work email</label>
            <input
              aria-describedby="waitlist-email-error"
              aria-invalid={formState === "validation-error" && Boolean(emailError)}
              id="waitlist-email"
              inputMode="email"
              name="email"
              onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
              placeholder="you@business.com"
              type="email"
              value={values.email}
            />
            <p id="waitlist-email-error">{formState === "validation-error" ? emailError : ""}</p>
          </div>

          <details className="optional-details">
            <summary><span>Add business details (optional)</span><ChevronDown aria-hidden="true" /></summary>
            <div className="optional-fields">
              <TextField id="waitlist-name" label="Name" name="fullName" onChange={(value) => setValues((current) => ({ ...current, fullName: value }))} placeholder="Ada Okonkwo" value={values.fullName} />
              <TextField id="waitlist-company" label="Business name" name="companyName" onChange={(value) => setValues((current) => ({ ...current, companyName: value }))} placeholder="Lagos Bright Prints" value={values.companyName} />
              <div className="role-field">
                <label htmlFor="waitlist-role">Role</label>
                <select id="waitlist-role" name="role" onChange={(event) => setValues((current) => ({ ...current, role: event.target.value }))} value={values.role}>
                  <option value="">Select a role</option>
                  {waitlist.roles.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
            </div>
          </details>

          <div aria-hidden="true" className="waitlist-honeypot" hidden>
            <label htmlFor="waitlist-website">Website</label>
            <input autoComplete="off" id="waitlist-website" name="website" onChange={(event) => setValues((current) => ({ ...current, website: event.target.value }))} tabIndex={-1} type="text" value={values.website} />
          </div>

          <MarketingButton className="w-full" isLoading={formState === "submitting"} loadingLabel="Joining..." size="lg" type="submit">
            Join the waitlist
          </MarketingButton>

          {formState === "success" ? (
            <div className="form-message is-success" role="status">
              <CheckCircle2 aria-hidden="true" />
              <div><strong>{waitlist.successTitle}</strong><p>{message}</p></div>
            </div>
          ) : null}
          {formState === "server-error" ? <p className="form-message is-error" role="alert">{message}</p> : null}
        </form>
      </div>
    </section>
  );
}

function TextField({ id, label, name, onChange, placeholder, value }: { id: string; label: string; name: string; onChange: (value: string) => void; placeholder: string; value: string }) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type="text" value={value} />
    </div>
  );
}
