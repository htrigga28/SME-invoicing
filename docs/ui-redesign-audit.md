# T017 UI Redesign Audit

## Route Inventory

Public and auth routes:

- `/`
- `/login`
- `/register`
- `/accept-invite/[token]`
- `/invoice/[token]`
- `/receipt/[token]`

Onboarding:

- `/onboarding/business`

Authenticated operations:

- `/dashboard`
- `/customers`
- `/customers/new`
- `/customers/[id]`
- `/customers/[id]/edit`
- `/invoices`
- `/invoices/new`
- `/invoices/[id]`
- `/invoices/[id]/edit`
- `/payments`
- `/payments/[id]`
- `/receipts`
- `/receipts/[id]`
- `/exports`
- `/audit-logs`

Settings:

- `/settings/team`
- `/settings/payment-setup`

No `/audit-logs/[id]` route is present; audit detail is rendered inside the audit logs page.

## Existing Reusable Components

- Layout: `AppShell`, `Sidebar`, `Topbar`, `ComingSoonPage`, navigation route helpers.
- UI: `Select`, `ConfirmDialog`, `AppToaster`, action class constants in `components/ui/styles.ts`.
- Domain UI wrappers: page headers, status panels, status badges, retry buttons, detail links, date/money helpers in customer, invoice, payment, and receipt feature modules.
- Dashboard charts: Recharts-based cashflow, invoice status, and outstanding aging components.

## Duplicated UI Patterns

- Buttons: repeated primary/secondary/destructive Tailwind classes and direct route-local button styling.
- Cards: many independent `rounded-lg border border-slate-200 bg-white p-*` surfaces.
- Form controls: native inputs, textareas, dates, and selects with repeated `border-slate-300` styling.
- Selects: shared `Select` exists, but select field wrappers and native form controls remain page-local.
- Status badges: invoices, customers, payments, reconciliation, receipts, and payment setup each define local color maps.
- Tables: customers, invoices, payments, receipts, audit logs, public invoice line items, and detail histories all repeat table containers, headers, row separators, mobile/card fallback, and pagination styles.
- Filter bars: customers, invoices, payments, receipts, exports, dashboard dates, and audit logs each define local search/filter control layouts.
- Empty/loading/error states: page-local panels and messages rather than shared skeleton/empty/error components.
- Dialogs: shared confirm dialog exists, but it uses the old light surface system.
- Page widths/spacing: authenticated pages rely on shell padding plus local `max-w-*`, `space-y-*`, and `gap-*` choices; public/auth/onboarding pages use separate centered layouts.
- Print: receipt print support exists; global print tokens/styles are not centralized.

## Breakpoints, Fonts, Icons, Charts, Print

- Breakpoints currently used: Tailwind `sm`, `md`, `lg`, and `xl`, with no custom breakpoint configuration.
- Font setup: global CSS uses system/Inter fallback only; no production `next/font` integration exists.
- Icon library: `apps/web/components.json` declares `lucide`, but `lucide-react` was not installed before T017.
- Charts: Recharts is used only in dashboard chart components and should remain.
- Print styles: route-local `print:*` classes exist for shell hiding and receipt printing; no semantic global print layer exists.

## Component Migration Map

- Design foundations: add semantic CSS tokens in `globals.css`, wire Tailwind v4 usage to those tokens, and load Hanken Grotesk plus JetBrains Mono via `next/font/google`.
- Layout: refactor `AppShell`, `Sidebar`, and `Topbar` into the dark command-center shell with slim rail, grouped icon navigation, accessible tooltips, mobile navigation, and route-aware create-invoice action.
- Actions: replace action constants with an authoritative button system and add `Button`/`IconButton` primitives.
- Forms: restyle the shared `Select`, add shared input/textarea/date field primitives, and rely on global form-control compatibility styles for existing native controls during migration.
- Surfaces: add shared `Card`, `SectionCard`, `MetricCard`, and status banner primitives; map existing card-like surfaces to semantic dark tokens.
- Status: add a central `StatusBadge` mapping for success, warning, danger, and neutral states; adapt domain badge wrappers to use it.
- Data: add table container/header/pagination/mobile card primitives and global table compatibility styles, then migrate feature tables incrementally around the shared presentation language.
- Feedback: add shared empty, error, loading skeleton, and alert components; replace the most visible local panels and rely on global compatibility where route-local structure remains.
- Public/auth shells: standardize auth/onboarding/public document surfaces without authenticated navigation.
- Charts: restyle Recharts components with chart semantic tokens and dark tooltips.
- Documentation/tests: document the design system, update task board status, and add focused tests for primitives, navigation, RBAC visibility, table/empty/error states, and regression-sensitive behavior.

## Migration Progress

- Shared primitives added: buttons, cards, typography, status badges, feedback states, form controls, filter bars, segmented controls, and data tables.
- Primary list pages migrated to shared filters, feedback, table containers, pagination, and mobile/data-density handling: Customers, Invoices, Payments, Receipts, and Audit Logs.
- Domain wrappers now route page headers, alerts, status badges, retry buttons, and primary actions through shared primitives.
- Dashboard charts and summary surfaces use semantic tokens and dark operational styling.
- Auth, onboarding, public invoice, public receipt, Payment Setup, and shell navigation have been restyled without changing backend, payment, reconciliation, auth, tenant, or RBAC logic.
