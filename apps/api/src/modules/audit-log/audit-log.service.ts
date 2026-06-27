import { Inject, Injectable } from "@nestjs/common";

import { AuthRepository } from "../auth/auth.repository";

type AuditLogInput = {
  organisationId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadataRedacted?: Record<string, unknown> | null;
};

@Injectable()
export class AuditLogService {
  constructor(@Inject(AuthRepository) private readonly authRepository: AuthRepository) {}

  create(input: AuditLogInput) {
    return this.authRepository.createAuditLog(input);
  }
}
