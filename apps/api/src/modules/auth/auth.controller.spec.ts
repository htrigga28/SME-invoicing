import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import type { AddressInfo } from "node:net";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TokenService } from "./token.service";

describe("AuthController", () => {
  it("throttles repeated public registration attempts", async () => {
    const service = {
      register: jest.fn().mockResolvedValue({ onboardingStep: "business_profile" })
    };
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 2 }])],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: service },
        { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
        { provide: TokenService, useValue: { verifyAccessToken: jest.fn() } }
      ]
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    app.getHttpAdapter().getInstance().set("trust proxy", 1);

    await app.listen(0, "127.0.0.1");

    try {
      const address = app.getHttpServer().address() as AddressInfo;
      const endpoint = `http://127.0.0.1:${address.port}/auth/register`;
      const submit = () =>
        fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": "203.0.113.20"
          },
          body: JSON.stringify({
            name: "Demo Owner",
            email: "owner@example.test",
            password: "DemoPass123!"
          })
        });

      await expect(submit()).resolves.toMatchObject({ status: 201 });
      await expect(submit()).resolves.toMatchObject({ status: 201 });
      await expect(submit()).resolves.toMatchObject({ status: 429 });
      expect(service.register).toHaveBeenCalledTimes(2);
    } finally {
      await app.close();
    }
  });
});
