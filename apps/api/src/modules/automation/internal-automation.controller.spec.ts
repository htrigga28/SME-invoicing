import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { InternalAutomationController } from "./internal-automation.controller";

function configWith(secret?: string) {
  return { get: jest.fn(() => secret) } as unknown as ConfigService;
}

describe("internal automation auth", () => {
  it("fails closed when CRON_SECRET is missing", async () => {
    const controller = new InternalAutomationController({ run: jest.fn() } as never, configWith(undefined));
    await expect(controller.run("Bearer anything")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects invalid credentials", async () => {
    const controller = new InternalAutomationController({ run: jest.fn() } as never, configWith("s3cr3t"));
    await expect(controller.run("Bearer wrong")).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.run(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("runs with valid credentials and returns a safe summary", async () => {
    const summary = { date: "2026-10-01", claimed: 1, completed: 1, skipped: 0, needsAttention: 0, failed: 0 };
    const controller = new InternalAutomationController({ run: jest.fn().mockResolvedValue(summary) } as never, configWith("s3cr3t"));
    const result = await controller.run("Bearer s3cr3t");
    expect(result).toEqual(summary);
    expect(JSON.stringify(result)).not.toMatch(/@example|INV-|₦/);
  });
});


