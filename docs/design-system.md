# SME Invoicing Design System

## Product Personality

The interface is a light, calm, precise financial workspace: trustworthy, quiet, dense where it helps, and approachable for SMEs while deep enough for finance teams. See `docs/lumina-v2/06_APP_DESIGN_OVERHAUL.md` (authoritative for `apps/web`).

## Semantic Color Tokens

Tokens live in `apps/web/src/app/globals.css` as CSS custom properties and Tailwind v4 inline theme values. Light mode is canonical; the token architecture stays future-compatible with a dark theme but no toggle ships in this pass.

- Backgrounds: `--background` (#F6F7F4 canvas), `--canvas-warm` (#FAFAF7), `--surface` / `--surface-card` (#FFFFFF working surfaces), `--surface-raised` (#F8F9F7 subtle), `--surface-elevated` (#F0F2EF), `--surface-overlay` (#FFFFFF popovers), `--surface-selected` (#F0F6F2), `--background-deep` (#FFFFFF sidebar).
- Text: `--text-primary` (#17211C), `--text-secondary` (#4F5F56), `--text-muted` (#768078), `--text-inverse` (#FFFFFF).
- Borders: `--border-subtle` (#E8EBE6), `--border-default` (#DCE2DC), `--border-strong` (#C7D0C8).
- Brand: `--accent` (#245C46 deep-green primary), `--accent-hover` (#1B4A38), `--accent-muted` (#EAF3ED soft), `--accent-border` / `--accent-border-subtle` (#C9DDD0), `--accent-border-strong` (#245C46), `--accent-foreground` (#FFFFFF), `--accent-glow` (restrained 12% focus tint), `--signal-lime` (#C1FF72 rare highlight only).
- State (independent from brand): `--success` (#237A57) / `--success-muted` (#E9F6EF) / `--success-border`; `--warning` (#956800) / muted / border; `--danger` (#B54747) / muted / border; `--info` (#2F6F9F) / `--info-muted` (#EAF2F8) / `--info-border`; `--neutral-state` (#5F6B63) / `--neutral-state-muted` (#F0F2EF).
- Charts: `--chart-gross` (#245C46 primary), `--chart-net` (#5E9B7F secondary sage), `--chart-refund` (#B54747), `--chart-grid` (#E8EBE6), `--chart-secondary` (#C9DDD0).
- Shadows (restrained, overlays only): `--shadow-menu`, `--shadow-dialog`, `--shadow-document`. Depth otherwise comes from borders, not shadows.
- Focus: `--focus-ring` (22% brand). Topbar: `--topbar-background` (white 86% + blur). Dialogs: `--dialog-backdrop` (ink 45%).

The old dark `@media not print` utility remapper has been removed. Routes use semantic tokens/primitives directly.

## Typography

Hanken Grotesk is loaded through `next/font/google` and is the primary interface font, including money values (with `tabular-nums`). JetBrains Mono is reserved for identifiers/references (invoice/receipt numbers, payment references).

Reusable typography primitives:

- `DisplayMetric` (Hanken, 28–40px, tabular — not mono)
- `PageTitle` (28–32px, 600)
- `SectionTitle` (16–20px)
- `Body`
- `MutedText`
- `MetadataLabel` (quiet, reduced uppercase)
- `DataValue`
- `ReferenceText` (mono, identifiers only)
- `MoneyText` (Hanken semibold + tabular, not mono)

Page titles 28–32px; body/table 14px; secondary metadata 12–13px.

## Spacing and Surfaces

The authenticated app uses a 240px expanded / 80px collapsed white sidebar (subtle right border, no glow; active = soft green surface + deep-green text + small indicator), sticky 64px light topbar, and a centered working canvas (`max-w-[1280px]`, 16px mobile / 24–32px desktop padding).

Surface hierarchy:

- App canvas: `--background`.
- Sidebar/topbar/dialogs: `--surface` / `--surface-overlay`.
- Working surfaces (tables, documents, panels): `--surface`.
- Secondary/selected: `--surface-raised` / `--surface-selected`.
- Overlays/menus/drawers: `--surface-overlay` + restrained shadow.

Cards: 10–12px radius. Controls: 8–10px. Documents: 4–8px. Status chips: pill where appropriate. One dominant working surface per page; not every group is a card.

## Buttons

Authoritative button variants are implemented in `components/ui/button.tsx` and mirrored by action constants in `components/ui/styles.ts`.

- Primary: deep-green fill, white text, reserved for the one contextual action.
- Secondary: soft-green fill, deep-green text.
- Outline: white surface, neutral border.
- Ghost: borderless, neutral text.
- Destructive: restrained red (white surface, red border/text, red-soft hover).

No glow. 120–220ms transitions. Lime is never a button fill.

Loading buttons disable interaction and show a spinner with loading text.

## Form Controls

Shared controls live in `components/ui/form.tsx` and `components/ui/select.tsx`.

- White surface.
- Neutral border.
- 40–44px minimum height.
- Clear labels, muted hints, red errors.
- Brand focus ring (`--focus-ring`).
- Subtle disabled state.
- Selects use a custom inset chevron and fixed right padding so text and caret do not collide.
- Date inputs use tabular numerals, not mono.

Shared filter layouts: `components/ui/filter-bar.tsx` (`FilterBar`, `FilterGrid`, `FilterActions`) is kept only for genuine multi-field forms. Data-heavy lists use the compact `components/ui/data-toolbar.tsx` pattern (`DataToolbar`, `DataToolbarSearch/Filters/Actions`, `StatusTabs`, `Tabs`): search + status tabs/segmented + filter selects + Clear, with export/action on the right.

Segmented mode switches live in `components/ui/segmented-control.tsx` and render as accessible tablists (e.g. Payments: Reconciliation, All attempts, Needs review; dashboard period 7/30/90D + Custom).

## Status Mapping

`components/ui/status-badge.tsx` centralizes status presentation (tone `success | warning | danger | neutral | info`):

- Success: paid, successful, active, processed, matched, resolved.
- Warning: pending, partially paid, verification delayed, review required, resolution in progress.
- Danger: overdue, failed, overpaid.
- Info: explicit opt-in (e.g. pending-confirmation rows).
- Neutral: sent, viewed, draft, superseded, abandoned, disabled, void/cancelled.

Success is independent from brand green. Badges use soft light fills with strong text contrast and always render text labels; state is not communicated by color only.

## Cards and Tables

Shared card primitives live in `components/ui/card.tsx` (`Card`, `SectionCard`, `MetricCard` — glow emphasis removed).

Shared table primitives live in `components/ui/data-table.tsx`:

- `DataTableContainer`
- `DataTableToolbar`
- `DataTable`
- `TableHeaderCell` (quiet 12px medium, sentence case, sticky)
- `MobileDataCard`
- `Pagination`

Plus `components/ui/menu.tsx` (`TableRowActionMenu`, `DropdownMenu`) and `components/ui/drawer.tsx` (`Drawer`, `Sheet`).

Table rules: white shell, subtle separators, 44–52px rows, soft selected/hover tint, money right-aligned tabular (Hanken), references mono, whole-row navigation where accessible, `…` overflow for secondary/destructive actions (no permanent View clusters), purpose-built mobile record cards (never squeezed desktop tables).

## Shells

Authenticated shell:

- `AppShell`
- White quiet `Sidebar` (Overview / Receivables / Operations / Settings grouping, RBAC-filtered, Lucide icons, collapsible 240/80px, mobile drawer)
- Light utility `Topbar` (mobile menu + business/section breadcrumb + jump search + account avatar menu; role/logout inside the menu, no fake notifications)
- Page header pattern: Title + operational description + contextual primary action (secondaries in overflow)
- Mobile-only New-invoice CTA; desktop uses contextual header actions

Public/auth shell:

- No authenticated navigation.
- Warm canvas (`--canvas-warm`), merchant-led document + payment split, deep-green Pay CTA, Lumina as secondary infrastructure branding.
- Auth: centered intentional card, one clear action, calm 3-step Account → Business → Payments progress trail.
- Registration compact; business profile may widen; required Payment Setup uses focused `max-w-4xl` surface without workspace navigation.
- Print overrides produce white pages with dark readable text.

## Recharts

Dashboard Recharts components remain in use: neutral gridlines, deep-green primary collections series, sage secondary, red reserved for refunds/problems, white tooltip overlay, titles that state what the chart answers. Donut/pie avoided where ranked lists/bars act better. No decorative gradients.

## Responsive Rules

- 1440px+: persistent sidebar, split editor/preview and document/trail views, full table columns.
- 1024–1280px: sidebar narrows/collapses, columns reduce, rails become drawers, preview stays usable.
- 768px: drawer nav, record lists replace tables, two-column forms collapse, preview becomes toggle/sheet.
- ~390px: one task per viewport, 44px targets, sticky bottom action only when helpful, public amount/Pay CTA visible early.

## Motion

Product motion is functional (120–220ms): menus, drawers, row selection, preview updates, save success, small state changes. No marketing scroll animation in `apps/web`; GSAP removed from product interactions where CSS suffices. `prefers-reduced-motion` honored.

## Accessibility

- Visible focus states use the accent token.
- Icon-only controls require accessible labels.
- Navigation tooltips are available on hover and focus.
- Dialogs/drawers render semantic `role="dialog"` with title/description IDs and Escape/backdrop close.
- Reduced-motion preference disables long transitions.
- Critical financial information remains textual even when charts are present.
