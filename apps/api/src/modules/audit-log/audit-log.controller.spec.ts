import { Reflector } from "@nestjs/core";

import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { AuditLogsController } from "./audit-log.controller";

describe("AuditLogsController RBAC metadata", () => {
  const reflector = new Reflector();

  it("allows audit log browsing for owner and admin only", () => {
    expect(reflector.get(ROLES_KEY, AuditLogsController.prototype.listAuditLogs)).toEqual([
      "owner",
      "admin"
    ]);
    expect(reflector.get(ROLES_KEY, AuditLogsController.prototype.getAuditLog)).toEqual([
      "owner",
      "admin"
    ]);
  });
});
