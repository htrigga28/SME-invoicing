import React from "react";
import type { InvoiceStatus } from "@sme-invoicing/shared";

import { formatDate, formatMoney, InvoiceStatusBadge } from "./invoice-ui";

export type CustomerVisibleLineItem = {
  description: string;
  quantity: number;
  unitPriceKobo: number;
  lineTotalKobo: number;
};

export type CustomerVisibleParty = {
  name: string;
  email?: string | null;
  phone?: string | null;
  billingAddress?: string | null;
};

export type CustomerVisibleBusiness = {
  businessName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type InvoiceDocumentProps = {
  invoiceNumber: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  customerReference?: string | null;
  customerMemo?: string | null;
  subtotalKobo: number;
  discountKobo: number;
  taxKobo: number;
  totalKobo: number;
  balanceDueKobo?: number;
  business?: CustomerVisibleBusiness | null;
  customer: CustomerVisibleParty;
  lineItems: CustomerVisibleLineItem[];
  compact?: boolean;
};

/**
 * Customer-visible invoice document. This contract intentionally excludes
 * internal-only fields: organisation IDs, public tokens, audit metadata,
 * provider references, payment internals, and any internal notes.
 */
export function InvoiceDocument({
  balanceDueKobo,
  business,
  compact = false,
  customer,
  customerMemo,
  customerReference,
  discountKobo,
  dueDate,
  invoiceNumber,
  issueDate,
  lineItems,
  status,
  subtotalKobo,
  taxKobo,
  totalKobo
}: InvoiceDocumentProps) {
  return (
    <article
      aria-label={`Invoice ${invoiceNumber}`}
      className="overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-950 print:rounded-none print:border-slate-400 print:shadow-none"
    >
      <div className="border-b border-slate-200 bg-slate-50/60 p-5 print:bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {business ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {business.businessName}
              </p>
            ) : null}
            <h2 className="mt-1 break-words text-2xl font-bold tracking-tight">{invoiceNumber}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Issued {formatDate(issueDate)} · Due {formatDate(dueDate)}
            </p>
            {customerReference ? (
              <p className="mt-1 break-words text-sm text-slate-700">
                <span className="font-semibold">Reference:</span> {customerReference}
              </p>
            ) : null}
          </div>
          <InvoiceStatusBadge status={status} />
        </div>

        <div className={`mt-4 grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
          {business ? (
            <div className="rounded-md border border-slate-200 bg-white p-3 print:border-slate-300">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">From</p>
              <p className="mt-1 text-sm font-semibold">{business.businessName}</p>
              {[business.email, business.phone, business.address]
                .filter(Boolean)
                .map((line) => (
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-600" key={line}>
                    {line}
                  </p>
                ))}
            </div>
          ) : null}
          <div className="rounded-md border border-slate-200 bg-white p-3 print:border-slate-300">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bill to</p>
            <p className="mt-1 text-sm font-semibold">{customer.name}</p>
            {[customer.email, customer.phone, customer.billingAddress]
              .filter(Boolean)
              .map((line) => (
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-600" key={line}>
                  {line}
                </p>
              ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 text-right font-semibold">Qty</th>
              <th className="hidden px-4 py-3 text-right font-semibold sm:table-cell">Unit</th>
              <th className="px-5 py-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lineItems.map((item, index) => (
              <tr className="break-inside-avoid" key={`${item.description}-${index}`}>
                <td className="max-w-[28rem] whitespace-pre-wrap break-words px-5 py-3 font-medium">
                  {item.description}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-600">{item.quantity}</td>
                <td className="hidden px-4 py-3 text-right tabular-nums text-slate-600 sm:table-cell">
                  {formatMoney(item.unitPriceKobo)}
                </td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums">
                  {formatMoney(item.lineTotalKobo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 border-t border-slate-200 p-5 sm:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          {customerMemo ? (
            <div className="rounded-md bg-slate-50 p-3 print:border print:border-slate-300 print:bg-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Customer memo
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                {customerMemo}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No additional memo.</p>
          )}
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(subtotalKobo)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">Discount</dt>
            <dd className="tabular-nums">{formatMoney(discountKobo)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">Tax</dt>
            <dd className="tabular-nums">{formatMoney(taxKobo)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(totalKobo)}</dd>
          </div>
          {balanceDueKobo !== undefined ? (
            <div className="flex justify-between gap-4 text-sm font-semibold">
              <dt className="text-slate-700">Balance due</dt>
              <dd className="tabular-nums">{formatMoney(balanceDueKobo)}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </article>
  );
}
