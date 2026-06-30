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
      processPaystackWebhook: jest.fn().mockResolvedValue({ received: true })
    };
    const controller = new PaymentsController(service as never);
    const rawBody = Buffer.from('{"event":"charge.success"}');

    controller.processPaystackWebhook({ rawBody }, "signature");

    expect(service.processPaystackWebhook).toHaveBeenCalledWith(rawBody, "signature");
  });

  it("rejects requests when raw body support is unavailable", () => {
    const service = {
      processPaystackWebhook: jest.fn()
    };
    const controller = new PaymentsController(service as never);

    expect(() => controller.processPaystackWebhook({}, "signature")).toThrow(BadRequestException);
    expect(service.processPaystackWebhook).not.toHaveBeenCalled();
  });
});
