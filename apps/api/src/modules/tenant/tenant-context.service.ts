import { ForbiddenException, Inject, Injectable } from "@nestjs/common";

import { AuthRepository } from "../auth/auth.repository";

@Injectable()
export class TenantContextService {
  constructor(@Inject(AuthRepository) private readonly authRepository: AuthRepository) {}

  async resolveForUser(userId: string) {
    const context = await this.authRepository.getActiveContextForUser(userId);

    if (!context) {
      throw new ForbiddenException("No active organisation membership was found.");
    }

    return context;
  }
}
