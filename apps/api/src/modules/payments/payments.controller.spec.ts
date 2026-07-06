import "reflect-metadata";

import { BadRequestException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";

import { PaymentsController } from "./payments.controller";

describe("PaymentsController", () => {
  it("does not require user auth guards for the Paystack webhook endpoint", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PaymentsController)).toBeUndefined();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PaymentsController.prototype.processPaystackWebhook)
    ).toBeUndefined();
  });

  it("delegates raw body and signature to the payment service", () => {
    const service = {
      getPayment: jest.fn(),
      getPaymentSummary: jest.fn(),
      listPayments: jest.fn(),
      listReviewEvents: jest.fn(),
      processPaystackWebhook: jest.fn().mockResolvedValue({ received: true })
    };
    const controller = new PaymentsController(service as never);
    const rawBody = Buffer.from('{"event":"charge.success"}');

    controller.processPaystackWebhook({ rawBody }, "signature");

    expect(service.processPaystackWebhook).toHaveBeenCalledWith(rawBody, "signature");
  });

  it("rejects requests when raw body support is unavailable", () => {
    const service = {
      getPayment: jest.fn(),
      getPaymentSummary: jest.fn(),
      listPayments: jest.fn(),
      listReviewEvents: jest.fn(),
      processPaystackWebhook: jest.fn()
    };
    const controller = new PaymentsController(service as never);

    expect(() => controller.processPaystackWebhook({}, "signature")).toThrow(BadRequestException);
    expect(service.processPaystackWebhook).not.toHaveBeenCalled();
  });

  it("protects internal payment read routes while leaving webhook public", () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PaymentsController.prototype.listPayments)
    ).toBeDefined();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PaymentsController.prototype.getPaymentSummary)
    ).toBeDefined();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PaymentsController.prototype.listReviewEvents)
    ).toBeDefined();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PaymentsController.prototype.getPayment)
    ).toBeDefined();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PaymentsController.prototype.processPaystackWebhook)
    ).toBeUndefined();
  });

  it("delegates internal payment reads to the service", () => {
    const service = {
      getPayment: jest.fn(),
      getPaymentSummary: jest.fn(),
      listPayments: jest.fn(),
      listReviewEvents: jest.fn(),
      processPaystackWebhook: jest.fn()
    };
    const controller = new PaymentsController(service as never);
    const context = { activeOrganisation: { id: "org-1" } };

    controller.listPayments(context as never, { search: "ref" });
    controller.getPaymentSummary(context as never, { dateFrom: "2026-06-01" });
    controller.listReviewEvents(context as never, { processed: true });
    controller.getPayment(context as never, "payment-1");

    expect(service.listPayments).toHaveBeenCalledWith(context, { search: "ref" });
    expect(service.getPaymentSummary).toHaveBeenCalledWith(context, { dateFrom: "2026-06-01" });
    expect(service.listReviewEvents).toHaveBeenCalledWith(context, { processed: true });
    expect(service.getPayment).toHaveBeenCalledWith(context, "payment-1");
  });
});
