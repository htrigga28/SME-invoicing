import "reflect-metadata";

import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { PaymentSetupController } from "./payment-setup.controller";

function rolesFor(methodName: keyof PaymentSetupController) {
  return Reflect.getMetadata(ROLES_KEY, PaymentSetupController.prototype[methodName]);
}

describe("PaymentSetupController RBAC metadata", () => {
  it("allows every active member role to view payment setup status", () => {
    expect(rolesFor("getAccount")).toEqual(["owner", "admin", "accountant", "viewer"]);
  });

  it("allows only owners and admins to manage payment setup", () => {
    const managerRoles = ["owner", "admin"];

    expect(rolesFor("listBanks")).toEqual(managerRoles);
    expect(rolesFor("resolveAccount")).toEqual(managerRoles);
    expect(rolesFor("createSubaccount")).toEqual(managerRoles);
    expect(rolesFor("disableAccount")).toEqual(managerRoles);
  });
});
