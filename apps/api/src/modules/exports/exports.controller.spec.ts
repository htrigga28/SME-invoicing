import { Reflector } from "@nestjs/core";

import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { ExportsController } from "./exports.controller";

describe("ExportsController RBAC metadata", () => {
  const reflector = new Reflector();

  it("allows operational CSV exports for owner, admin, and accountant", () => {
    for (const method of [
      "exportCustomers",
      "exportInvoices",
      "exportPayments",
      "exportReceipts"
    ] as const) {
      expect(reflector.get(ROLES_KEY, ExportsController.prototype[method])).toEqual([
        "owner",
        "admin",
        "accountant"
      ]);
    }
  });

  it("allows audit log CSV exports for owner and admin only", () => {
    expect(reflector.get(ROLES_KEY, ExportsController.prototype.exportAuditLogs)).toEqual([
      "owner",
      "admin"
    ]);
  });
});
