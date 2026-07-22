import {
  ArrowDownToLine,
  BanknoteArrowDown,
  Check,
  CircleAlert,
  FileCheck2,
  FileText,
  KeyRound,
  Landmark,
  LockKeyhole,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  UsersRound
} from "lucide-react";

import { capabilityGroups, trustNodes } from "@/content/site-copy";

const capabilityIcons = {
  collect: FileText,
  understand: BanknoteArrowDown,
  resolve: RefreshCcw,
  control: FileCheck2
};

const trustIcons = {
  custody: Landmark,
  keys: KeyRound,
  server: LockKeyhole,
  provider: ShieldCheck,
  masked: ReceiptText,
  access: UsersRound
};

export function OperationsField() {
  return (
    <section className="operations-section" id="operations">
      <div className="shell-container">
        <div className="operations-intro">
          <div>
            <p className="section-signal">The daily operating picture</p>
            <h2>Run the business from what the money actually did.</h2>
          </div>
          <p>
            Lumina keeps collection, understanding, resolution, and control inside one financial
            field—without pretending to be a full accounting system.
          </p>
        </div>

        <div className="operations-field">
          <article className="cash-position" aria-label="Illustrative cash position">
            <div className="cash-position-head">
              <div>
                <span className="data-label">CURRENT POSITION</span>
                <h3>Payment operations</h3>
              </div>
              <span className="demo-label">Illustrative demo data</span>
            </div>
            <div className="position-total">
              <span>Net collected this month</span>
              <strong>₦132,850</strong>
              <small>Successful payments less processed refunds</small>
            </div>
            <div className="position-rows">
              <div><span>Outstanding</span><strong>₦86,400</strong><small>Across 12 invoices</small></div>
              <div><span>Overdue</span><strong>₦18,000</strong><small>3 invoices</small></div>
              <div><span>Needs review</span><strong className="review-value">2</strong><small>Real exceptions</small></div>
            </div>
            <div className="position-event">
              <span className="event-icon"><Check aria-hidden="true" /></span>
              <div><strong>Payment T8129-4F3A-90LX matched</strong><span>INV-000184 · Adebayo Studio · ₦42,000</span></div>
              <time>Now</time>
            </div>
          </article>

          {capabilityGroups.map((group) => {
            const Icon = capabilityIcons[group.id];
            return (
              <article className={`operation-chapter chapter-${group.id}`} key={group.id}>
                <div className="chapter-heading">
                  <span className="chapter-icon"><Icon aria-hidden="true" /></span>
                  <span>{group.label}</span>
                </div>
                <h3>{group.heading}</h3>
                <p>{group.copy}</p>
                <ul>
                  {group.points.map((point) => (
                    <li key={point}><Check aria-hidden="true" />{point}</li>
                  ))}
                </ul>
              </article>
            );
          })}

          <div className="operations-export">
            <ArrowDownToLine aria-hidden="true" />
            <div><strong>Export the record</strong><span>Customers · Invoices · Payments · Receipts</span></div>
            <span className="status-chip neutral">CSV</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TrustArchitecture() {
  return (
    <section className="trust-section" id="trust">
      <div className="shell-container trust-shell">
        <div className="trust-intro">
          <p className="section-signal">Clear payment boundaries</p>
          <h2>Trust comes from knowing where Lumina stops.</h2>
          <p>
            The product is designed around provider truth, server-side scope, and an explicit
            separation between reconciliation software and custody of funds.
          </p>
        </div>

        <div className="trust-architecture" aria-label="Lumina payment trust architecture">
          <div aria-hidden="true" className="trust-routes"><span /><span /><span /><span /></div>
          <div className="trust-hub">
            <span className="hub-mark"><ShieldCheck aria-hidden="true" /></span>
            <span className="data-label">LUMINA VERIFICATION LAYER</span>
            <strong>Provider-confirmed financial truth</strong>
            <small>Signed webhook + server verification</small>
          </div>
          {trustNodes.map((node) => {
            const Icon = trustIcons[node.id as keyof typeof trustIcons] ?? CircleAlert;
            return (
              <article className={`trust-node trust-${node.id}`} key={node.id}>
                <Icon aria-hidden="true" />
                <div><h3>{node.label}</h3><p>{node.detail}</p></div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
