export const marketingDemo = {
  business: "Adebayo Studio",
  customer: "Northstar Projects",
  invoiceNumber: "INV-000184",
  total: "₦78,400",
  providerReference: "T8129-4F3A-90LX",
  receiptNumber: "RCT-000241",
  dueDate: "30 July 2026",
  customerReference: "NORTH-2026-041"
} as const;

export type ProductMenuItem = {
  id: "invoicing" | "reconciliation" | "trust";
  href: "#invoicing" | "#reconciliation" | "#trust";
  label: string;
  title: string;
  detail: string;
};

export type StoryStep = {
  id: "create" | "share" | "pay" | "verify" | "match" | "know";
  index: string;
  label: string;
  title: string;
  copy: string;
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

export type TrustRow = {
  id: string;
  title: string;
  detail: string;
};

export const siteConfig = {
  brandName: "Lumina",
  descriptor: "Receivables for growing businesses",
  positioning:
    "Lumina helps growing businesses create professional invoices, collect Paystack payments, reconcile what arrived, and know exactly what needs attention.",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@lumina.example"
};

export const navigation: {
  productLabel: string;
  productItems: ProductMenuItem[];
  links: Array<{ href: "#how-it-works" | "#trust" | "#faq"; label: string }>;
  signInLabel: string;
  signupLabel: string;
} = {
  productLabel: "Product",
  productItems: [
    {
      id: "invoicing",
      href: "#invoicing",
      label: "Invoicing",
      title: "Compose the invoice once",
      detail: "Reusable catalogue, payment terms, and live customer preview."
    },
    {
      id: "reconciliation",
      href: "#reconciliation",
      label: "Payments & reconciliation",
      title: "Know what happened after checkout",
      detail: "Matched payments stay simple. Real exceptions stay visible."
    },
    {
      id: "trust",
      href: "#trust",
      label: "Receipts & control",
      title: "Financial clarity without becoming your bank",
      detail: "Provider-confirmed truth, masked payout context, audit history."
    }
  ],
  links: [
    { href: "#how-it-works", label: "How it works" },
    { href: "#trust", label: "Trust" },
    { href: "#faq", label: "FAQ" }
  ],
  signInLabel: "Sign in",
  signupLabel: "Create account"
};

export const hero = {
  eyebrow: "RECEIVABLES FOR GROWING BUSINESSES",
  title: "Turn every invoice into predictable cash.",
  copy: "Create professional invoices, collect payments, reconcile what arrived, and know exactly what needs attention.",
  primaryCta: "Create account",
  secondaryCta: "See how it works",
  secondaryHref: "#how-it-works" as const,
  trustNote: "Built for NGN invoicing and Paystack payment flows.",
  demoLabel: "Illustrative demo data"
};

export const audienceBridge = {
  heading: "For the people who turn finished work into cash.",
  groups: [
    {
      title: "Growing businesses",
      copy: "Send one clear invoice and see exactly what is due, overdue, and paid."
    },
    {
      title: "Agencies & professional services",
      copy: "Bill project work with line items your customer can actually understand."
    },
    {
      title: "Finance & receivables teams",
      copy: "Keep invoice, payment, receipt, and review state in one operating view."
    }
  ]
};

export const storySteps: StoryStep[] = [
  {
    id: "create",
    index: "01",
    label: "CREATE",
    title: "Create",
    copy: "Build the invoice with the details your customer actually needs."
  },
  {
    id: "share",
    index: "02",
    label: "SHARE",
    title: "Share",
    copy: "Send one clear document instead of another email attachment chain."
  },
  {
    id: "pay",
    index: "03",
    label: "PAY",
    title: "Pay",
    copy: "Your customer sees what is due and has one clear next step."
  },
  {
    id: "verify",
    index: "04",
    label: "VERIFY",
    title: "Verify",
    copy: "Lumina waits for provider-confirmed payment truth."
  },
  {
    id: "match",
    index: "05",
    label: "MATCH",
    title: "Match",
    copy: "The payment resolves against the invoice instead of becoming another mystery transfer."
  },
  {
    id: "know",
    index: "06",
    label: "KNOW",
    title: "Know",
    copy: "The invoice, payment, receipt, and business position stay connected."
  }
];

export const storyIntro = {
  eyebrow: "HOW IT WORKS",
  heading: "One invoice, from creation to financial truth.",
  copy: "Follow INV-000184 as it moves from an Adebayo Studio draft to a matched, receipted payment from Northstar Projects. No new object appears mid-story."
};

export const invoicingChapter = {
  id: "invoicing",
  eyebrow: "PROFESSIONAL INVOICING",
  heading: "Compose the invoice once. Let the customer see exactly what you meant.",
  body: "Build from reusable products and services or add an item on the fly. Set payment terms, add a customer reference, and preview the customer-facing invoice before it leaves your workspace."
};

export const reconciliationSection = {
  id: "reconciliation",
  eyebrow: "PAYMENTS & RECONCILIATION",
  heading: "Know what happened after checkout.",
  support: "Matched payments stay simple. Real exceptions stay visible until they are resolved."
};

export const outcomes: OutcomeScenario[] = [
  {
    id: "matched",
    label: "Matched",
    eyebrow: "PAYMENT UNDERSTOOD",
    heading: "The payment lands where it belongs.",
    copy: "Lumina confirms the Paystack event, matches the reference to INV-000184, updates the balance, and issues RCT-000241 without a manual reference check.",
    amount: "₦78,400",
    amountLabel: "Confirmed payment",
    status: "Matched",
    tone: "success",
    reference: "T8129-4F3A-90LX",
    invoice: "INV-000184",
    nextAction: "Receipt RCT-000241 issued · Balance ₦0 due",
    events: [
      { label: "Provider", value: "Confirmed" },
      { label: "Invoice balance", value: "₦0 due" },
      { label: "Receipt", value: "RCT-000241" }
    ]
  },
  {
    id: "review",
    label: "Needs review",
    eyebrow: "REAL EXCEPTION",
    heading: "The noise clears. The exception stays.",
    copy: "Retries and abandoned checkouts stay in history. A genuine excess payment is surfaced with the context needed to resolve it.",
    amount: "₦12,000",
    amountLabel: "Excess received",
    status: "Needs review",
    tone: "warning",
    reference: "T8129-7D6C-11QZ",
    invoice: "INV-000184",
    nextAction: "Owner or admin can initiate excess refund",
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

export const visibilitySection = {
  id: "visibility",
  eyebrow: "RECEIVABLES VISIBILITY",
  heading: "See what needs attention before it becomes a surprise.",
  body: "Outstanding balances, overdue invoices, confirmed collections, and real reconciliation issues share one operating view.",
  metrics: [
    { id: "outstanding", label: "Outstanding", value: "₦86,400", note: "Across 12 invoices" },
    { id: "overdue", label: "Overdue", value: "₦18,000", note: "3 invoices" },
    { id: "collected", label: "Net collected", value: "₦132,850", note: "Successful less refunds" },
    { id: "attention", label: "Needs attention", value: "2", note: "Real exceptions" }
  ],
  callouts: [
    {
      title: "Current position",
      copy: "Net collected, outstanding, and overdue stay in one hierarchy."
    },
    {
      title: "Real exceptions",
      copy: "Only genuine review items surface. Retries and noise stay in history."
    },
    {
      title: "Complete history",
      copy: "Every matched payment keeps its reference, invoice, and receipt."
    }
  ],
  recentActivity: {
    label: "Latest matched payment",
    title: "T8129-4F3A-90LX matched",
    meta: "INV-000184 · Northstar Projects · ₦78,400",
    time: "Now"
  }
};

export const customerPaymentSection = {
  id: "customer-payment",
  eyebrow: "A BETTER WAY TO GET PAID",
  heading: "Give the customer one clear invoice and one clear next step.",
  body: "Customers can open a public invoice without a Lumina account and pay online when your business payment setup is active."
};

export const trustSection = {
  id: "trust",
  eyebrow: "TRUST & CONTROL",
  heading: "Financial clarity without becoming your bank.",
  body: "Lumina keeps invoice and payment operations connected while Paystack handles the payment flow and your team keeps role-scoped control.",
  rows: [
    {
      id: "provider",
      title: "Provider-confirmed payment status",
      detail: "Payment state follows Paystack confirmation rather than optimistic UI state."
    },
    {
      id: "keys",
      title: "No business secret keys in the app",
      detail: "Businesses do not paste Paystack secret keys into Lumina."
    },
    {
      id: "masked",
      title: "Masked payout context",
      detail: "Operational views avoid exposing full payout account details."
    },
    {
      id: "roles",
      title: "Role-scoped access and audit history",
      detail: "Team roles and audit logs keep sensitive actions accountable."
    }
  ] as TrustRow[]
};

export const faq = [
  {
    question: "Does Lumina hold my funds?",
    answer:
      "No. Lumina does not hold funds or provide wallet balances. Invoice payments use your organisation's configured Paystack payout setup."
  },
  {
    question: "Do I provide my Paystack secret key?",
    answer:
      "No. Lumina uses its own server-side Paystack integration and organisation-level subaccounts. Businesses do not paste Paystack secret keys into the product."
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
    question: "Can customers pay without an account?",
    answer:
      "Yes. Public invoice links open without signing in. Online payment is available when the business has active Payment Setup."
  },
  {
    question: "Is Lumina accounting software?",
    answer:
      "No. Lumina focuses on customer invoices, online payment collection, reconciliation, refunds, receipts, and operational reporting. It is not full bookkeeping, payroll, inventory, or tax-filing software."
  },
  {
    question: "Which country/currency is currently supported?",
    answer:
      "The initial product is designed around Nigerian businesses, Nigerian bank accounts, NGN invoices, and Paystack."
  }
];

export const closingCta = {
  heading: "Turn outstanding invoices into a workflow you can control.",
  copy: "Create your Lumina workspace and send your first professional invoice.",
  primary: "Create account",
  secondary: "Sign in"
};

export const signup = closingCta;

export const footer = {
  heading: "Turn every invoice into predictable cash.",
  descriptor: "Receivables for growing businesses. Invoicing, Paystack payments, and reconciliation in one place.",
  boundaryNote: "Lumina does not hold funds or provide wallet balances."
};
