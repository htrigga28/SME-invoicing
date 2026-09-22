import { Controller, Get, Headers, Inject, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "crypto";

import { AutomationRunnerService } from "./automation-runner.service";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

@Controller("internal/automation")
export class InternalAutomationController {
  constructor(
    @Inject(AutomationRunnerService) private readonly runner: AutomationRunnerService,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {}

  @Get("run")
  async run(@Headers("authorization") authorization?: string) {
    const secret = this.config.get<string>("CRON_SECRET");
    // Fail closed: no secret configured means no execution.
    if (!secret) {
      throw new UnauthorizedException("Automation is not configured.");
    }
    const expected = `Bearer ${secret}`;
    if (!authorization || !safeEqual(authorization, expected)) {
      throw new UnauthorizedException("Invalid automation credentials.");
    }
    // No organisation ID accepted from caller; ownership derives from stored jobs.
    return this.runner.run();
  }
}


