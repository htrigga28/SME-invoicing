import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import type { AddressInfo } from "node:net";

import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { AuthController } from "./modules/auth/auth.controller";
import { AuthService } from "./modules/auth/auth.service";
import { TokenService } from "./modules/auth/token.service";
import { PublicWaitlistController } from "./modules/public-waitlist/public-waitlist.controller";
import { PublicWaitlistService } from "./modules/public-waitlist/public-waitlist.service";

describe("public rate limits", () => {
  it(
    "throttles repeated public registration attempts",
    async () => {
    const service = {
      register: jest.fn().mockResolvedValue({ accessToken: "access", refreshToken: "refresh" })
    };
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 2 }])],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: service },
        { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
        { provide: TokenService, useValue: { verifyAccessToken: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } }
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
      await expect(submit()).resolves.toMatchObject({ status: 201 });
      await expect(submit()).resolves.toMatchObject({ status: 429 });
      expect(service.register).toHaveBeenCalledTimes(3);
    } finally {
      await app.close();
    }
    },
    // Boots a real HTTP server; give it headroom under full-suite parallel load.
    30_000
  );

  it(
    "rate-limits login and refresh separately from registration",
    async () => {
      const service = {
        login: jest.fn().mockResolvedValue({ accessToken: "access", refreshToken: "refresh" }),
        refresh: jest.fn().mockResolvedValue({ accessToken: "access", refreshToken: "refresh" })
      };
      const moduleRef = await Test.createTestingModule({
        imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
        controllers: [AuthController],
        providers: [
          { provide: AuthService, useValue: service },
          { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
          { provide: TokenService, useValue: { verifyAccessToken: jest.fn() } },
          { provide: ConfigService, useValue: { get: jest.fn() } }
        ]
      }).compile();
      const app: INestApplication = moduleRef.createNestApplication();
      app.getHttpAdapter().getInstance().set("trust proxy", 1);
      await app.listen(0, "127.0.0.1");

      try {
        const address = app.getHttpServer().address() as AddressInfo;
        const baseUrl = `http://127.0.0.1:${address.port}`;
        const login = () =>
          fetch(`${baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.21" },
            body: JSON.stringify({ email: "owner@example.test", password: "DemoPass123!" })
          });
        const refresh = () =>
          fetch(`${baseUrl}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.22" },
            body: JSON.stringify({ refreshToken: "legacy-refresh-token-long-enough" })
          });

        for (let attempt = 0; attempt < 5; attempt += 1) {
          await expect(login()).resolves.toMatchObject({ status: 201 });
        }
        await expect(login()).resolves.toMatchObject({ status: 429 });

        for (let attempt = 0; attempt < 10; attempt += 1) {
          await expect(refresh()).resolves.toMatchObject({ status: 201 });
        }
        await expect(refresh()).resolves.toMatchObject({ status: 429 });
        expect(service.login).toHaveBeenCalledTimes(5);
        expect(service.refresh).toHaveBeenCalledTimes(10);
      } finally {
        await app.close();
      }
    },
    30_000
  );

  it("throttles waitlist requests per forwarded client", async () => {
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
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Forwarded-For": "203.0.113.10"
          },
          body: new URLSearchParams({ email: "  native@example.test  ", source: "waitlist" })
        })
      ).resolves.toMatchObject({ status: 201 });
      expect(service.createEntry).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ email: "native@example.test", source: "waitlist" })
      );
      await expect(submit({ "X-Forwarded-For": "203.0.113.10" })).resolves.toMatchObject({
        status: 201
      });
      await expect(submit({ "X-Forwarded-For": "203.0.113.10" })).resolves.toMatchObject({
        status: 429
      });
      await expect(submit({ "X-Forwarded-For": "203.0.113.11" })).resolves.toMatchObject({
        status: 201
      });
      expect(service.createEntry).toHaveBeenCalledTimes(3);
    } finally {
      await app.close();
    }
  });
});
