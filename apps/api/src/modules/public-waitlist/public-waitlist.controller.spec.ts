import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import type { AddressInfo } from "node:net";

import { PublicWaitlistController } from "./public-waitlist.controller";
import { PublicWaitlistService } from "./public-waitlist.service";

describe("PublicWaitlistController", () => {
  it("exposes only public waitlist creation", () => {
    const methods = Object.getOwnPropertyNames(PublicWaitlistController.prototype).filter(
      (name) => name !== "constructor"
    );

    expect(methods).toEqual(["createEntry"]);
  });

  it("delegates waitlist creation to the service", async () => {
    const service = {
      createEntry: jest.fn().mockResolvedValue({
        success: true,
        message: "You're on the list. We'll let you know when early access opens."
      })
    };
    const controller = new PublicWaitlistController(service as never);
    const input = { email: "founder@example.test" };

    await expect(controller.createEntry(input)).resolves.toEqual({
      success: true,
      message: "You're on the list. We'll let you know when early access opens."
    });
    expect(service.createEntry).toHaveBeenCalledWith(input);
  });

  it("returns 429 after the configured per-client request limit", async () => {
    const service = {
      createEntry: jest.fn().mockResolvedValue({
        success: true,
        message: "You're on the list. We'll let you know when early access opens."
      })
    };
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 2 }])],
      controllers: [PublicWaitlistController],
      providers: [{ provide: PublicWaitlistService, useValue: service }]
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.getHttpAdapter().getInstance().set("trust proxy", 1);

    await app.listen(0, "127.0.0.1");

    try {
      const address = app.getHttpServer().address() as AddressInfo;
      const endpoint = `http://127.0.0.1:${address.port}/public/waitlist`;
      const submit = (headers: Record<string, string> = {}) =>
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ email: "founder@example.test" })
        });

      await expect(
        fetch(endpoint, {
          method: "POST",
          headers: { "X-Forwarded-For": "203.0.113.10" },
          body: new URLSearchParams({ email: "  native@example.test  ", source: "waitlist" })
        })
      ).resolves.toMatchObject({ status: 201 });
      expect(service.createEntry).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ email: "native@example.test", source: "waitlist" })
      );
      await expect(
        submit({ "X-Forwarded-For": "203.0.113.10" })
      ).resolves.toMatchObject({ status: 201 });
      await expect(
        submit({ "X-Forwarded-For": "203.0.113.10" })
      ).resolves.toMatchObject({ status: 429 });
      await expect(
        submit({ "X-Forwarded-For": "203.0.113.11" })
      ).resolves.toMatchObject({ status: 201 });
      expect(service.createEntry).toHaveBeenCalledTimes(3);
    } finally {
      await app.close();
    }
  });
});
