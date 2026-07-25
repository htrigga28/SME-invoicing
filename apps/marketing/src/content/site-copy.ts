export type ProductMenuItem = {
  id: "trail" | "outcomes" | "operations";
  href: "#payment-trail" | "#outcomes" | "#operations";
  label: string;
  title: string;
  detail: string;
  preview: string;
};

export type TrailStage = {
  id: "invoice" | "checkout" | "confirmation" | "match" | "receipt";
  label: string;
  title: string;
  copy: string;
  meta: string;
};

export type OutcomeScenario = {
  id: "matched" | "review" | "refunded";
  label: string;
  eyebrow: string;
  heading: string;
  copy: string;
  amount: string;
  amountLabel: string;
  status: string;
  tone: "success" | "warning" | "neutral";
  reference: string;
  invoice: string;
  nextAction: string;
  events: Array<{ label: string; value: string }>;
};

export type CapabilityGroup = {
  id: "collect" | "understand" | "resolve" | "control";
  label: string;
  heading: string;
  copy: string;
  points: string[];
};

export type TrustNode = {
  id: string;
  label: string;
  detail: string;
};

export const siteConfig = {
  brandName: "Lumina",
  descriptor: "Invoice payment clarity for Nigerian SMEs",
  positioning:
    "Lumina connects invoices, Paystack payments, payout routing, refunds, and receipts so Nigerian SMEs can see what is settled, what is due, and what needs attention.",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@lumina.example"
};

export const navigation: {
  productLabel: string;
  productItems: ProductMenuItem[];
  links: Array<{ href: "#trust" | "#faq"; label: string }>;
  signInLabel: string;
  waitlistLabel: string;
} = {
  productLabel: "Product",
  productItems: [
    {
      id: "trail",
      href: "#payment-trail",
      label: "Payment trail",
      title: "Follow money from invoice to receipt",
      detail: "See every provider-confirmed step in one connected operational record.",
      preview: "INV-000184 → T8129-4F3A-90LX → RCT-000241"
    },
    {
      id: "outcomes",
      href: "#outcomes",
      label: "Outcomes",
      title: "Know what happened and what to do next",
      detail: "Separate matched payments from genuine review and refund states.",
      preview: "Matched · Needs review · Refund confirmed"
    },
    {
      id: "operations",
      href: "#operations",
      label: "Operations",
      title: "Run the day from financial truth",
      detail: "Collect, understand, resolve, and control invoice payment work.",
      preview: "₦132,850 net collected · 2 items need review"
    }
  ],
  links: [
    { href: "#trust", label: "Trust" },
    { href: "#faq", label: "FAQ" }
  ],
  signInLabel: "Sign In",
  waitlistLabel: "Join Waitlist"
};

export const hero = {
  eyebrow: "INVOICE PAYMENT CLARITY FOR NIGERIAN SMEs",
  title: "Know what got paid—without the spreadsheet chase.",
  copy: "Lumina connects every invoice, Paystack payment, payout route, refund, and receipt, so you always know what is settled, what is due, and what needs attention.",
  primaryCta: "Join the waitlist",
  secondaryCta: "See the payment trail",
  trustNote: "Built for NGN invoices and Paystack settlement flows.",
  previewLabel: "Connected payment trail",
  demoLabel: "Illustrative demo data"
};

export const paymentTrail: TrailStage[] = [
  {
    id: "invoice",
    label: "Invoice",
    title: "Create and share",
    copy: "Issue a customer invoice with server-calculated totals and one secure public link.",
    meta: "INV-000184 · ₦78,400"
  },
  {
    id: "checkout",
    label: "Checkout",
    title: "Customer pays",
    copy: "The customer pays the outstanding balance through Paystack without opening an account.",
    meta: "Paystack checkout"
  },
  {
    id: "confirmation",
    label: "Provider truth",
    title: "Confirm the money",
    copy: "Signed webhooks and server-side verification confirm what actually moved.",
    meta: "T8129-4F3A-90LX"
  },
  {
    id: "match",
    label: "Reconciliation",
    title: "Match automatically",
    copy: "Lumina connects the payment reference to the right invoice, customer, and payout route.",
    meta: "Matched · verified"
  },
  {
    id: "receipt",
    label: "Receipt",
    title: "Close the trail",
    copy: "The confirmed payment updates the balance and receives its own permanent receipt.",
    meta: "RCT-000241 · issued"
  }
];

export const outcomes: OutcomeScenario[] = [
  {
    id: "matched",
    label: "Matched",
    eyebrow: "PAYMENT UNDERSTOOD",
    heading: "The payment lands where it belongs.",
    copy: "Lumina verifies the provider event, matches the reference, updates the invoice, and issues a receipt without a manual reference check.",
    amount: "₦42,000",
    amountLabel: "Confirmed payment",
    status: "Matched",
    tone: "success",
    reference: "T8129-4F3A-90LX",
    invoice: "INV-000184",
    nextAction: "Receipt RCT-000241 issued",
    events: [
      { label: "Provider", value: "Verified" },
      { label: "Invoice balance", value: "₦36,400 due" },
      { label: "Payout route", value: "Active" }
    ]
  },
  {
    id: "review",
    label: "Needs review",
    eyebrow: "REAL EXCEPTION",
    heading: "The noise clears. The exception stays.",
    copy: "Retries remain in history, while a genuine excess payment is surfaced with the context an owner needs to resolve it.",
    amount: "₦12,000",
    amountLabel: "Excess received",
    status: "Needs review",
    tone: "warning",
    reference: "T8129-7D6C-11QZ",
    invoice: "INV-000184",
    nextAction: "Owner or admin can initiate refund",
    events: [
      { label: "Invoice balance", value: "₦0 due" },
      { label: "Payment history", value: "2 confirmed" },
      { label: "Review reason", value: "Overpayment" }
    ]
  },
  {
    id: "refunded",
    label: "Refund confirmed",
    eyebrow: "PROVIDER CONFIRMED",
    heading: "The resolution becomes financial truth.",
    copy: "A requested refund does not rewrite the invoice early. Lumina updates the financial trail only after Paystack confirms processing.",
    amount: "₦12,000",
    amountLabel: "Processed refund",
    status: "Resolved",
    tone: "neutral",
    reference: "RFD-8129-4F3A",
    invoice: "INV-000184",
    nextAction: "Original receipt remains immutable",
    events: [
      { label: "Refund", value: "Processed" },
      { label: "Net received", value: "₦78,400" },
      { label: "Review state", value: "Resolved" }
    ]
  }
];

export const capabilityGroups: CapabilityGroup[] = [
  {
    id: "collect",
    label: "Collect",
    heading: "Send an invoice that is ready to be paid.",
    copy: "Create the invoice, activate the business payout route, and share one public payment link.",
    points: ["Paystack account resolution", "Public invoice links", "Partial and full payments"]
  },
  {
    id: "understand",
    label: "Understand",
    heading: "Read the business position, not a pile of attempts.",
    copy: "Separate current financial truth from retries, abandoned checkout, and historical noise.",
    points: ["Net collected", "Outstanding and overdue", "Latest meaningful state"]
  },
  {
    id: "resolve",
    label: "Resolve",
    heading: "Keep real exceptions visible until they are finished.",
    copy: "Investigate excess payments and follow refunds through provider-confirmed completion.",
    points: ["Needs Review queue", "Excess refund initiation", "Resolution history"]
  },
  {
    id: "control",
    label: "Control",
    heading: "Take the operational record with you.",
    copy: "Issue payment-specific receipts, export safe CSV data, and retain role-scoped audit history.",
    points: ["Immutable receipts", "Formula-safe CSV", "Owner/Admin audit logs"]
  }
];

export const trustNodes: TrustNode[] = [
  {
    id: "custody",
    label: "No wallet balances",
    detail: "Invoice payments use the organisation's configured Paystack payout setup."
  },
  {
    id: "keys",
    label: "No merchant secret keys",
    detail: "Businesses never paste their own Paystack secret keys into Lumina."
  },
  {
    id: "server",
    label: "Server-derived amounts",
    detail: "The backend determines payment amounts and the organisation payout route."
  },
  {
    id: "provider",
    label: "Provider-confirmed status",
    detail: "Signed webhooks lead; server-side verification supplies the fallback."
  },
  {
    id: "masked",
    label: "Masked payout details",
    detail: "Operational views do not expose full bank account numbers."
  },
  {
    id: "access",
    label: "Tenant isolation and RBAC",
    detail: "Organisation scope and role permissions are enforced server-side."
  }
];

export const faq = [
  {
    question: "Does Lumina hold my business funds?",
    answer:
      "No. Lumina does not provide wallet balances or withdrawals. Invoice payments use the organisation's configured Paystack payout setup."
  },
  {
    question: "Do I need to provide my Paystack secret key?",
    answer:
      "No. Lumina uses its own server-side Paystack integration and organisation-level subaccounts. Businesses do not paste merchant Paystack secret keys into the product."
  },
  {
    question: "How does Lumina know an invoice was paid?",
    answer:
      "Payment status is confirmed from Paystack. Signed webhooks are the primary confirmation path, with server-side transaction verification as a fallback."
  },
  {
    question: "What happens if a customer pays twice?",
    answer:
      "Confirmed payments determine the financial result. If successful payments exceed the invoice total, Lumina flags the excess for review. Owners and admins can initiate an excess refund, and the state changes after provider confirmation."
  },
  {
    question: "Can a customer view and pay an invoice without an account?",
    answer:
      "Yes. Public invoice links can be opened without signing in. Online payment is available when the business has active Payment Setup."
  },
  {
    question: "Is Lumina accounting software?",
    answer:
      "No. Lumina focuses on customer invoices, online payment collection, reconciliation, refunds, receipts, and operational reporting. It is not full bookkeeping, payroll, inventory, or tax-filing software."
  },
  {
    question: "Which countries and currencies are supported?",
    answer:
      "The initial product is designed around Nigerian businesses, Nigerian bank accounts, NGN invoices, and Paystack."
  }
];

export const waitlist = {
  heading: "Make every invoice payment easier to understand.",
  copy: "Join the Lumina early-access list. We will let you know when a payment operations workspace built for Nigerian SMEs is ready for you.",
  successTitle: "You're on the list.",
  successCopy: "We'll let you know when Lumina early access opens.",
  roles: ["Founder / Owner", "Finance / Accounting", "Operations", "Developer / Technical", "Other"]
};

export const footer = {
  heading: "From invoice sent to payment understood.",
  descriptor: "Invoice payment clarity for Nigerian SMEs.",
  boundaryNote: "Lumina does not hold funds or provide wallet balances."
};
