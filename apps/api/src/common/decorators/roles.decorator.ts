import { SetMetadata } from "@nestjs/common";

import type { RoleRequirement } from "../types/request-context";

export const ROLES_KEY = "roles";

export const Roles = (...roles: RoleRequirement[]) => SetMetadata(ROLES_KEY, roles);
