import "reflect-metadata";

import { ROLES_KEY } from "../../common/decorators/roles.decorator";
import { CatalogueController } from "./catalogue.controller";

function rolesFor(methodName: keyof CatalogueController) {
  return Reflect.getMetadata(ROLES_KEY, CatalogueController.prototype[methodName]);
}

describe("CatalogueController RBAC metadata", () => {
  it("allows every active member role to list catalogue items", () => {
    expect(rolesFor("listCatalogueItems")).toEqual(["owner", "admin", "accountant", "viewer"]);
  });

  it("excludes viewers from catalogue item mutations", () => {
    const mutationRoles = ["owner", "admin", "accountant"];

    expect(rolesFor("createCatalogueItem")).toEqual(mutationRoles);
    expect(rolesFor("updateCatalogueItem")).toEqual(mutationRoles);
    expect(rolesFor("archiveCatalogueItem")).toEqual(mutationRoles);
    expect(rolesFor("restoreCatalogueItem")).toEqual(mutationRoles);
  });
});
