import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";

import { DatabaseService } from "./database/database.service";

type HealthResponse = {
  status: "ok";
};

type ReadinessResponse = {
  status: "ok";
  checks: {
    database: "up";
  };
};

@Controller("health")
export class HealthController {
  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  @Get()
  getHealth(): HealthResponse {
    return { status: "ok" };
  }

  @Get("ready")
  async getReadiness(): Promise<ReadinessResponse> {
    // Cheap dependency probe only: a single round trip that fails fast when
    // PostgreSQL is unreachable.
    const databaseUp = await this.databaseService.checkConnection();

    if (!databaseUp) {
      throw new ServiceUnavailableException({
        status: "degraded",
        checks: { database: "down" }
      });
    }

    return { status: "ok", checks: { database: "up" } };
  }
}
