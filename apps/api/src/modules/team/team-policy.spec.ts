import { ForbiddenException } from "@nestjs/common";

import { assertInvitePermission, assertMemberManagementPermission } from "./team-policy";

describe("team policy", () => {
  it("allows owner to invite admin, accountant, and viewer", () => {
    expect(() => assertInvitePermission("owner", "admin")).not.toThrow();
    expect(() => assertInvitePermission("owner", "accountant")).not.toThrow();
    expect(() => assertInvitePermission("owner", "viewer")).not.toThrow();
  });

  it("allows admin to invite accountant and viewer only", () => {
    expect(() => assertInvitePermission("admin", "accountant")).not.toThrow();
    expect(() => assertInvitePermission("admin", "viewer")).not.toThrow();
    expect(() => assertInvitePermission("admin", "admin")).toThrow(ForbiddenException);
  });

  it("blocks accountant and viewer invitations", () => {
    expect(() => assertInvitePermission("accountant", "viewer")).toThrow(ForbiddenException);
    expect(() => assertInvitePermission("viewer", "viewer")).toThrow(ForbiddenException);
  });

  it("blocks self-management and owner management", () => {
    expect(() =>
      assertMemberManagementPermission({
        actorRole: "owner",
        actorUserId: "user-1",
        targetRole: "admin",
        targetUserId: "user-1"
      })
    ).toThrow(ForbiddenException);

    expect(() =>
      assertMemberManagementPermission({
        actorRole: "owner",
        actorUserId: "user-1",
        targetRole: "owner",
        targetUserId: "user-2"
      })
    ).toThrow(ForbiddenException);
  });

  it("limits admin member management to accountant and viewer", () => {
    expect(() =>
      assertMemberManagementPermission({
        actorRole: "admin",
        actorUserId: "user-1",
        targetRole: "accountant",
        targetUserId: "user-2"
      })
    ).not.toThrow();

    expect(() =>
      assertMemberManagementPermission({
        actorRole: "admin",
        actorUserId: "user-1",
        targetRole: "viewer",
        targetUserId: "user-2"
      })
    ).not.toThrow();

    expect(() =>
      assertMemberManagementPermission({
        actorRole: "admin",
        actorUserId: "user-1",
        targetRole: "admin",
        targetUserId: "user-2"
      })
    ).toThrow(ForbiddenException);

    expect(() =>
      assertMemberManagementPermission({
        actorRole: "admin",
        actorUserId: "user-1",
        targetRole: "viewer",
        targetUserId: "user-2",
        requestedRole: "admin"
      })
    ).toThrow(ForbiddenException);
  });
});
