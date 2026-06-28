import "reflect-metadata";

import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { CustomersController } from "./customers.controller";

function rolesFor(methodName: keyof CustomersController) {
  return Reflect.getMetadata(ROLES_KEY, CustomersController.prototype[methodName]);
}

describe("CustomersController RBAC metadata", () => {
  it("allows every active member role to list and view customers", () => {
    const expectedRoles = ["owner", "admin", "accountant", "viewer"];

    expect(rolesFor("listCustomers")).toEqual(expectedRoles);
    expect(rolesFor("getCustomer")).toEqual(expectedRoles);
  });

  it("excludes viewers from customer mutations", () => {
    const expectedMutationRoles = ["owner", "admin", "accountant"];

    expect(rolesFor("createCustomer")).toEqual(expectedMutationRoles);
    expect(rolesFor("updateCustomer")).toEqual(expectedMutationRoles);
    expect(rolesFor("archiveCustomer")).toEqual(expectedMutationRoles);
  });
});
