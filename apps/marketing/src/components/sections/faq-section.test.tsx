import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { faq } from "@/content/site-copy";
import { getFaqJsonLd } from "@/lib/seo";
import { FaqSection } from "./faq-section";

describe("FaqSection", () => {
  it("uses a native disclosure with the first answer visible by default", () => {
    const secondFaq = faq[1]!;
    const { container } = render(<FaqSection />);

    const details = container.querySelectorAll("details");
    expect(details).toHaveLength(faq.length);
    expect(details[0]).toHaveAttribute("open");
    expect(details[1]).not.toHaveAttribute("open");

    fireEvent.click(screen.getByText(secondFaq.question));

    expect(details[1]).toHaveAttribute("open");
    expect(screen.getByText(secondFaq.answer)).toBeVisible();
  });

  it("keeps visible FAQ content aligned with FAQPage schema", () => {
    const schema = getFaqJsonLd();

    expect(schema.mainEntity).toHaveLength(faq.length);
    const firstFaq = faq[0]!;

    expect(schema.mainEntity[0]!).toMatchObject({
      name: firstFaq.question,
      acceptedAnswer: {
        text: firstFaq.answer
      }
    });
  });
});
