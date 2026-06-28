import "reflect-metadata";

import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { InvoicesController } from "./invoices.controller";

function rolesFor(methodName: keyof InvoicesController) {
  return Reflect.getMetadata(ROLES_KEY, InvoicesController.prototype[methodName]);
}

describe("InvoicesController RBAC metadata", () => {
  it("allows every active member role to list and view invoices", () => {
    const expectedRoles = ["owner", "admin", "accountant", "viewer"];

    expect(rolesFor("listInvoices")).toEqual(expectedRoles);
    expect(rolesFor("getInvoice")).toEqual(expectedRoles);
  });

  it("excludes viewers from invoice create, edit, and send", () => {
    const expectedMutationRoles = ["owner", "admin", "accountant"];

    expect(rolesFor("createInvoice")).toEqual(expectedMutationRoles);
    expect(rolesFor("updateInvoice")).toEqual(expectedMutationRoles);
    expect(rolesFor("sendInvoice")).toEqual(expectedMutationRoles);
  });

  it("restricts cancel and void to owner and admin", () => {
    expect(rolesFor("cancelInvoice")).toEqual(["owner", "admin"]);
    expect(rolesFor("voidInvoice")).toEqual(["owner", "admin"]);
  });
});
