# SME Invoicing Design System

## Product Personality

The interface is a modern financial operations command center: precise, energetic, trustworthy, dense, and data-focused. It should feel operational rather than decorative.

## Semantic Color Tokens

Tokens live in `apps/web/src/app/globals.css` as CSS custom properties and Tailwind v4 inline theme values.

- Backgrounds: `--background`, `--background-deep`, `--surface`, `--surface-card`, `--surface-raised`, `--surface-elevated`, `--surface-overlay`.
- Text: `--text-primary`, `--text-secondary`, `--text-muted`, `--text-inverse`.
- Borders: `--border-subtle`, `--border-default`, `--border-strong`.
- Accent: `--accent`, `--accent-hover`, `--accent-muted`, `--accent-glow`, `--accent-foreground`.
- State: `--success`, `--success-muted`, `--warning`, `--warning-muted`, `--danger`, `--danger-muted`, `--neutral-state`, `--neutral-state-muted`.
- Charts: `--chart-gross`, `--chart-net`, `--chart-refund`, `--chart-grid`.

Dark mode is the product identity. There is no light theme switcher.

## Typography

Hanken Grotesk is loaded through `next/font/google` and is the primary interface font. JetBrains Mono is loaded through `next/font/google` for money, references, dates, timestamps, and tabular values.

Reusable typography primitives:

- `DisplayMetric`
- `PageTitle`
- `SectionTitle`
- `Body`
- `MutedText`
- `MetadataLabel`
- `DataValue`
- `ReferenceText`
- `MoneyText`

Financial and reference text uses tabular numerals.

## Spacing and Surfaces

The authenticated app uses a fixed 80px desktop rail, sticky 64px topbar, and a centered content canvas with a `1440px` maximum width. General page padding is `16px` on mobile and `24px` on large screens.

Surface hierarchy:

- App background: `--background`.
- Rail background: `--background-deep`.
- Standard cards: `--surface-card`.
- Raised/active cards: `--surface-raised`.
- Dialogs/popovers: `--surface-overlay`.

Cards use an 8px radius and subtle borders.

## Buttons

Authoritative button variants are implemented in `components/ui/button.tsx` and mirrored by legacy action constants in `components/ui/styles.ts`.

- Primary: lime background, near-black text, reserved for the main action.
- Secondary: low-emphasis lime surface and lime text.
- Outline: subtle border and white text.
- Ghost: transparent, used for low-emphasis actions.
- Destructive: red state styling and never visually confused with primary.

Loading buttons disable interaction and show a spinner with loading text.

## Form Controls

Shared controls live in `components/ui/form.tsx` and `components/ui/select.tsx`.

- Dark raised surface.
- 8px radius.
- Subtle border.
- Lime focus border/glow.
- Muted placeholders.
- Disabled state.
- Selects use a custom inset chevron and fixed right padding so text and caret do not collide.

Shared filter layouts live in `components/ui/filter-bar.tsx`:

- `FilterBar`
- `FilterGrid`
- `FilterActions`

Use these for search/filter forms on list and reporting pages. Controls should stack naturally on mobile and align to a compact grid on large screens.

Segmented mode switches live in `components/ui/segmented-control.tsx` and render as accessible tablists. Use them for compact view modes such as Payments: Reconciliation, All attempts, and Needs review.

## Status Mapping

`components/ui/status-badge.tsx` centralizes status presentation:

- Success: paid, successful, active, processed, matched, resolved.
- Warning: pending, partially paid, verification delayed, review required, resolution in progress.
- Danger: overdue, failed, overpaid.
- Neutral: sent, viewed, draft, superseded, abandoned, disabled, void/cancelled.

Badges always render text labels; state is not communicated by color only.

## Cards and Tables

Shared card primitives live in `components/ui/card.tsx`.

Shared table primitives live in `components/ui/data-table.tsx`:

- `DataTableContainer`
- `DataTableToolbar`
- `DataTable`
- `TableHeaderCell`
- `MobileDataCard`
- `Pagination`

Table styling uses dark card surfaces, subtle separators, sticky headers, hover rows, mono/tabular financial columns where feature markup applies them, and mobile card or horizontal overflow strategies depending on data density.

Customers, Invoices, Payments, Receipts, and Audit Logs now use these shared table/filter primitives for their primary list surfaces. Audit Logs keeps a horizontal overflow table because the metadata columns are dense; payment and receipt/customer/invoice lists use mobile card fallbacks.

## Shells

Authenticated shell:

- `AppShell`
- fixed desktop `Sidebar` rail
- sticky `Topbar`
- grouped Main and Settings navigation
- RBAC-filtered routes
- accessible icon labels/tooltips
- route-aware Create Invoice quick action for non-viewer users

Public/auth shell:

- No authenticated navigation.
- Centered document or form panel.
- Shared dark brand language.
- Print overrides produce white pages with dark readable text.

## Recharts

Dashboard Recharts components remain in use. Chart grid, gross/net/refund colors, ticks, legends, and tooltips read from semantic CSS variables.

## Responsive Rules

- Desktop: fixed rail and multi-column page layouts.
- Tablet: reduced columns and wrapping filters.
- Mobile: no persistent desktop rail; topbar menu opens grouped navigation; forms stack; touch targets are at least 40-44px.

## Accessibility

- Visible focus states use the accent token.
- Icon-only controls require accessible labels.
- Navigation tooltips are available on hover and focus.
- Dialogs render semantic `role="dialog"` with title/description IDs.
- Reduced-motion preference disables long transitions.
- Critical financial information remains textual even when charts are present.
