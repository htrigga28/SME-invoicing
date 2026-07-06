import "reflect-metadata";

import { GUARDS_METADATA } from "@nestjs/common/constants";

import { PublicInvoicesController } from "./public-invoices.controller";

describe("PublicInvoicesController", () => {
  it("does not require auth guards for public invoice endpoints", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PublicInvoicesController)).toBeUndefined();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PublicInvoicesController.prototype.getPublicInvoice)
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        PublicInvoicesController.prototype.markPublicInvoiceViewed
      )
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        PublicInvoicesController.prototype.initializePublicInvoicePayment
      )
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        PublicInvoicesController.prototype.verifyPublicInvoicePayment
      )
    ).toBeUndefined();
  });

  it("delegates public invoice requests to the invoice service", () => {
    const service = {
      getPublicInvoice: jest.fn(),
      initializePublicInvoicePayment: jest.fn(),
      markPublicInvoiceViewed: jest.fn()
    };
    const paymentsService = {
      verifyPublicInvoicePayment: jest.fn()
    };
    const controller = new PublicInvoicesController(service as never, paymentsService as never);

    controller.getPublicInvoice("token");
    controller.initializePublicInvoicePayment("token");
    controller.markPublicInvoiceViewed("token");
    controller.verifyPublicInvoicePayment("token", "reference");

    expect(service.getPublicInvoice).toHaveBeenCalledWith("token");
    expect(service.initializePublicInvoicePayment).toHaveBeenCalledWith("token");
    expect(service.markPublicInvoiceViewed).toHaveBeenCalledWith("token");
    expect(paymentsService.verifyPublicInvoicePayment).toHaveBeenCalledWith("token", "reference");
  });
});
