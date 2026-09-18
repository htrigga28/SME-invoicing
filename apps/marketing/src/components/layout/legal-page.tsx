import type { ReactNode } from "react";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export function LegalPage({ children, title, eyebrow }: { children: ReactNode; title: string; eyebrow: string }) {
  return (
    <main className="legal-page">
      <article className="shell-container legal-layout">
        <aside className="legal-aside">
          <a href="/"><ArrowLeft aria-hidden="true" />Back to Lumina</a>
          <div>
            <span className="data-label">Document status</span>
            <strong>Product draft</strong>
            <p>Owner and legal review required before production use.</p>
          </div>
        </aside>

        <div className="legal-document">
          <header>
            <p className="section-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <div className="legal-warning">
              <AlertTriangle aria-hidden="true" />
              <p>This lightweight legal copy is a product draft and requires final owner/legal review before production use.</p>
            </div>
          </header>
          <div className="legal-content">{children}</div>
        </div>
      </article>
    </main>
  );
}
