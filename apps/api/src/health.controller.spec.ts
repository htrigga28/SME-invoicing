import { ServiceUnavailableException } from "@nestjs/common";

import type { DatabaseService } from "./database/database.service";
import { HealthController } from "./health.controller";

function createController(databaseUp: boolean) {
  const databaseService = {
    checkConnection: jest.fn().mockResolvedValue(databaseUp)
  };
  const controller = new HealthController(databaseService as unknown as DatabaseService);

  return { controller, databaseService };
}

describe("HealthController", () => {
  it("returns an ok health response", () => {
    const { controller } = createController(true);

    expect(controller.getHealth()).toEqual({ status: "ok" });
  });

  it("reports readiness when the database answers", async () => {
    const { controller, databaseService } = createController(true);

    await expect(controller.getReadiness()).resolves.toEqual({
      status: "ok",
      checks: { database: "up" }
    });
    expect(databaseService.checkConnection).toHaveBeenCalledTimes(1);
  });

  it("reports degraded readiness when the database is unreachable", async () => {
    const { controller } = createController(false);

    await expect(controller.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
