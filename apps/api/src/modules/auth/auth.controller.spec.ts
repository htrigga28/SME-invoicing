import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";

import { AuthController } from "./auth.controller";

function createController(serviceMocks: Record<string, jest.Mock> = {}) {
  const service = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    getMe: jest.fn(),
    getOrganisations: jest.fn(),
    selectOrganisation: jest.fn(),
    ...serviceMocks
  };
  const configService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      if (key === "NODE_ENV") {
        return "test";
      }

      if (key === "CORS_ORIGINS") {
        return "https://app.test";
      }

      if (key === "LEGACY_REFRESH_BODY_ENABLED") {
        return "true";
      }

      return defaultValue;
    })
  };
  const controller = new AuthController(service as never, configService as never);
  const res = { cookie: jest.fn(), clearCookie: jest.fn() };

  return { configService, controller, res, service };
}

describe("AuthController", () => {
  it("rate-limits credential and session endpoints", () => {
    for (const method of ["register", "login", "refresh", "logout"] as const) {
      expect(
        Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype[method])
      ).toBeDefined();
    }
  });

  it("delegates registration", async () => {
    const { controller, res, service } = createController({
      register: jest.fn().mockResolvedValue({ onboardingStep: "business_profile" })
    });
    await expect(controller.register({} as never, res as never)).resolves.toEqual({
      onboardingStep: "business_profile"
    });
    expect(service.register).toHaveBeenCalledWith({});
  });

  it("stores the refresh token in a non-secure lax cookie outside production", async () => {
    const { controller, res, service } = createController({
      login: jest
        .fn()
        .mockResolvedValue({ accessToken: "access", refreshToken: "refresh-token-value" })
    });

    await controller.login({} as never, res as never);

    expect(service.login).toHaveBeenCalledWith({});
    expect(res.cookie).toHaveBeenCalledWith(
      "lumina_rt",
      "refresh-token-value",
      expect.objectContaining({ httpOnly: true, path: "/", sameSite: "lax", secure: false })
    );
  });

  it("refreshes from the cookie when the origin is allowlisted", async () => {
    const { controller, res, service } = createController({
      refresh: jest.fn().mockResolvedValue({ accessToken: "new-access", refreshToken: "new-raw" })
    });
    const req = { headers: { cookie: "lumina_rt=cookie-raw", origin: "https://app.test" } };

    const result = await controller.refresh(req as never, res as never, undefined);

    expect(service.refresh).toHaveBeenCalledWith({ refreshToken: "cookie-raw" });
    expect(res.cookie).toHaveBeenCalledWith(
      "lumina_rt",
      "new-raw",
      expect.objectContaining({ httpOnly: true })
    );
    expect(result).toEqual({ accessToken: "new-access" });
  });

  it("rejects cookie refresh from a foreign or missing origin", async () => {
    const { controller, res, service } = createController();

    await expect(
      controller.refresh(
        { headers: { cookie: "lumina_rt=cookie-raw", origin: "https://evil.test" } } as never,
        res as never,
        undefined
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.refresh(
        { headers: { cookie: "lumina_rt=cookie-raw" } } as never,
        res as never,
        undefined
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.refresh).not.toHaveBeenCalled();
  });

  it("supports the legacy body refresh during the compat window", async () => {
    const { controller, res, service } = createController({
      refresh: jest.fn().mockResolvedValue({ accessToken: "new-access", refreshToken: "new-raw" })
    });

    await expect(
      controller.refresh({ headers: {} } as never, res as never, {
      refreshToken: "legacy-body-token"
      } as never)
    ).resolves.toEqual({ accessToken: "new-access", refreshToken: "new-raw" });

    expect(service.refresh).toHaveBeenCalledWith({ refreshToken: "legacy-body-token" });
    expect(res.cookie).toHaveBeenCalled();
  });

  it("rejects body refresh once the compat window is disabled", async () => {
    const { configService, controller, res, service } = createController();
    configService.get.mockImplementation((key: string, defaultValue?: string) => {
      if (key === "LEGACY_REFRESH_BODY_ENABLED") {
        return "false";
      }

      return defaultValue;
    });

    await expect(
      controller.refresh({ headers: {} } as never, res as never, {
        refreshToken: "legacy-body-token"
      } as never)
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.refresh).not.toHaveBeenCalled();
  });

  it("revokes cookie and body tokens once each on logout and clears the cookie", async () => {
    const { controller, res, service } = createController({
      logout: jest.fn().mockResolvedValue({ success: true })
    });
    const req = { headers: { cookie: "lumina_rt=cookie-raw" } };

    await controller.logout(req as never, res as never, { refreshToken: "body-token" } as never);

    expect(service.logout).toHaveBeenCalledTimes(2);
    expect(service.logout).toHaveBeenCalledWith({ refreshToken: "cookie-raw" });
    expect(service.logout).toHaveBeenCalledWith({ refreshToken: "body-token" });
    expect(res.clearCookie).toHaveBeenCalledWith(
      "lumina_rt",
      expect.objectContaining({ httpOnly: true })
    );
  });

  it("passes the selected workspace header through to /me", async () => {
    const { controller, service } = createController({
      getMe: jest.fn().mockResolvedValue({ activeOrganisation: { id: "org-2" } })
    });

    await controller.me({ userId: "user-1" } as never, "org-2" as never);

    expect(service.getMe).toHaveBeenCalledWith("user-1", "org-2");
  });

  it("delegates organisation listing and selection", async () => {
    const { controller, service } = createController({
      getOrganisations: jest.fn().mockResolvedValue({ organisations: [] }),
      selectOrganisation: jest.fn().mockResolvedValue({ activeOrganisation: { id: "org-2" } })
    });

    await expect(
      controller.organisations({ userId: "user-1" } as never)
    ).resolves.toEqual({ organisations: [] });
    await controller.selectOrganisation({ userId: "user-1" } as never, {
      organisationId: "org-2"
    } as never);

    expect(service.getOrganisations).toHaveBeenCalledWith("user-1");
    expect(service.selectOrganisation).toHaveBeenCalledWith("user-1", "org-2");
  });
});
