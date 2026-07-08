import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { DatabaseService } from "../../database/database.service";
import { auditLogs, users } from "../../database/schema";
import { AuthRepository } from "../auth/auth.repository";
import type { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";
import { categorizeAuditAction, presentAuditLog } from "./audit-log-presenter";

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
  constructor(
    @Inject(AuthRepository) private readonly authRepository: AuthRepository,
    @Inject(DatabaseService) private readonly databaseService: DatabaseService
  ) {}

  create(input: AuditLogInput) {
    return this.authRepository.createAuditLog(input);
  }

  async listAuditLogs(context: ActiveOrganisationContext, query: ListAuditLogsQueryDto) {
    const pagination = this.getPagination(query);
    const rows = await this.findAuditLogRows(context.activeOrganisation.id, query);
    const filteredRows = this.applyPresentationFilters(
      rows.map((row) => presentAuditLog(row)),
      query
    );
    const pageRows = filteredRows.slice(pagination.offset, pagination.offset + pagination.limit);

    return {
      auditLogs: pageRows.map(({ metadataFields: _metadataFields, ...auditLog }) => auditLog),
      pagination: this.toPaginationResponse(pagination, filteredRows.length)
    };
  }

  async listAuditLogsForExport(
    context: ActiveOrganisationContext,
    query: Omit<ListAuditLogsQueryDto, "limit" | "page">
  ) {
    const rows = await this.findAuditLogRows(context.activeOrganisation.id, query);
    return this.applyPresentationFilters(
      rows.map((row) => presentAuditLog(row)),
      query
    );
  }

  async getAuditLog(context: ActiveOrganisationContext, auditLogId: string) {
    const rows = await this.findAuditLogRows(context.activeOrganisation.id, { auditLogId });
    const auditLog = rows[0] ? presentAuditLog(rows[0]) : null;

    if (!auditLog) {
      throw new NotFoundException("Audit log was not found.");
    }

    return { auditLog };
  }

  private async findAuditLogRows(
    organisationId: string,
    query: Omit<ListAuditLogsQueryDto, "limit" | "page"> & { auditLogId?: string }
  ) {
    const conditions: SQL[] = [eq(auditLogs.organisationId, organisationId)];

    if (query.auditLogId) {
      conditions.push(eq(auditLogs.id, query.auditLogId));
    }

    if (query.action?.trim()) {
      conditions.push(eq(auditLogs.action, query.action.trim()));
    }

    if (query.actorUserId) {
      conditions.push(eq(auditLogs.actorUserId, query.actorUserId));
    }

    if (query.resourceType?.trim()) {
      conditions.push(eq(auditLogs.entityType, query.resourceType.trim()));
    }

    if (query.dateFrom) {
      conditions.push(gte(auditLogs.createdAt, new Date(`${query.dateFrom}T00:00:00.000Z`)));
    }

    if (query.dateTo) {
      conditions.push(lte(auditLogs.createdAt, new Date(`${query.dateTo}T23:59:59.999Z`)));
    }

    return this.databaseService.db
      .select({ auditLog: auditLogs, actor: users })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt));
  }

  private applyPresentationFilters(
    auditLogRows: ReturnType<typeof presentAuditLog>[],
    query: Omit<ListAuditLogsQueryDto, "limit" | "page">
  ) {
    let filteredRows = auditLogRows;

    if (query.category) {
      filteredRows = filteredRows.filter(
        (row) => categorizeAuditAction(row.action) === query.category
      );
    }

    const search = query.search?.trim().toLowerCase();

    if (search) {
      filteredRows = filteredRows.filter((row) =>
        [
          row.action,
          row.actionLabel,
          row.category,
          row.actor?.name,
          row.actor?.email,
          row.actorLabel,
          row.resource?.type,
          row.resource?.label,
          row.metadataSummary
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search))
      );
    }

    return filteredRows;
  }

  private getPagination(input: Pick<ListAuditLogsQueryDto, "limit" | "page">) {
    const page = input.page ?? 1;
    const limit = Math.min(input.limit ?? 25, 100);

    return {
      page,
      limit,
      offset: (page - 1) * limit
    };
  }

  private toPaginationResponse(
    pagination: ReturnType<AuditLogService["getPagination"]>,
    total: number
  ) {
    return {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.max(Math.ceil(total / pagination.limit), 1)
    };
  }
}
