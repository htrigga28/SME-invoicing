import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import { and, count, desc, eq, ilike, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { DatabaseService } from "../../database/database.service";
import { customers, invoices, type Customer, type Invoice } from "../../database/schema";
import { AuditLogService } from "../audit-log/audit-log.service";
import type { ArchiveCustomerDto } from "./dto/archive-customer.dto";
import type { CreateCustomerDto } from "./dto/create-customer.dto";
import type { ListCustomersQueryDto } from "./dto/list-customers-query.dto";
import type { UpdateCustomerDto } from "./dto/update-customer.dto";

type PaginationInput = {
  page?: number;
  limit?: number;
};

type CustomerStatus = "active" | "archived";
type InvoiceStatusValue = Invoice["status"];

function shouldDisplayAsOverdue(input: {
  balanceDueKobo: number;
  dueDate: string;
  status: InvoiceStatusValue;
}) {
  if (["draft", "paid", "cancelled", "void"].includes(input.status)) {
    return false;
  }

  if (input.balanceDueKobo <= 0) {
    return false;
  }

  const today = new Date();
  const dueDate = new Date(`${input.dueDate}T00:00:00.000Z`);
  const todayStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  return dueDate < todayStart;
}

@Injectable()
export class CustomersService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService
  ) {}

  async listCustomers(context: ActiveOrganisationContext, query: ListCustomersQueryDto) {
    const pagination = this.getPagination(query);
    const conditions = [eq(customers.organisationId, context.activeOrganisation.id)];
    const status = query.status ?? "active";

    if (status === "active") {
      conditions.push(isNull(customers.archivedAt));
    }

    if (status === "archived") {
      conditions.push(isNotNull(customers.archivedAt));
    }

    const search = query.search?.trim();

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(customers.name, pattern),
          ilike(customers.email, pattern),
          ilike(customers.phone, pattern)
        )!
      );
    }

    const whereClause = and(...conditions);
    const rows = await this.databaseService.db
      .select()
      .from(customers)
      .where(whereClause)
      .orderBy(desc(customers.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    const [countRow] = await this.databaseService.db
      .select({ total: count() })
      .from(customers)
      .where(whereClause);

    return {
      customers: rows.map((customer) => this.toSafeCustomer(customer)),
      pagination: this.toPaginationResponse(pagination, countRow?.total ?? 0)
    };
  }

  async createCustomer(context: ActiveOrganisationContext, input: CreateCustomerDto) {
    const normalized = this.normalizeCreateInput(input);

    await this.assertNoDuplicateActiveEmail({
      organisationId: context.activeOrganisation.id,
      email: normalized.email
    });

    const [customer] = await this.databaseService.db
      .insert(customers)
      .values({
        organisationId: context.activeOrganisation.id,
        createdByUserId: context.user.id,
        ...normalized
      })
      .returning();

    if (!customer) {
      throw new Error("Customer creation failed.");
    }

    await this.auditLogService.create({
      organisationId: context.activeOrganisation.id,
      actorUserId: context.user.id,
      action: "customer_created",
      entityType: "customer",
      entityId: customer.id,
      metadataRedacted: { email: customer.email, name: customer.name }
    });

    return { customer: this.toSafeCustomer(customer) };
  }

  async getCustomer(context: ActiveOrganisationContext, customerId: string) {
    const customer = await this.findCustomerInOrganisation(
      context.activeOrganisation.id,
      customerId
    );

    if (!customer) {
      throw new NotFoundException("Customer was not found.");
    }

    const customerInvoices = await this.findInvoicesForCustomer(
      context.activeOrganisation.id,
      customer.id
    );
    const invoiceSummary = this.toInvoiceSummary(customerInvoices);

    return {
      customer: this.toSafeCustomer(customer),
      invoiceSummary,
      invoices: customerInvoices.map((invoice) => this.toCustomerInvoiceHistoryItem(invoice))
    };
  }

  async updateCustomer(
    context: ActiveOrganisationContext,
    customerId: string,
    input: UpdateCustomerDto
  ) {
    const customer = await this.findCustomerInOrganisation(
      context.activeOrganisation.id,
      customerId
    );

    if (!customer) {
      throw new NotFoundException("Customer was not found.");
    }

    if (customer.archivedAt) {
      throw new UnprocessableEntityException("Archived customers cannot be updated.");
    }

    const normalized = this.normalizeUpdateInput(input);

    if (Object.keys(normalized).length === 0) {
      throw new BadRequestException("Provide at least one customer field to update.");
    }

    if (normalized.email && normalized.email !== customer.email) {
      await this.assertNoDuplicateActiveEmail({
        organisationId: context.activeOrganisation.id,
        email: normalized.email,
        excludeCustomerId: customer.id
      });
    }

    const [updated] = await this.databaseService.db
      .update(customers)
      .set({
        ...normalized,
        updatedAt: new Date()
      })
      .where(eq(customers.id, customer.id))
      .returning();

    if (!updated) {
      throw new Error("Customer update failed.");
    }

    await this.auditLogService.create({
      organisationId: context.activeOrganisation.id,
      actorUserId: context.user.id,
      action: "customer_updated",
      entityType: "customer",
      entityId: customer.id,
      metadataRedacted: {
        fields: Object.keys(normalized),
        emailChanged: normalized.email ? normalized.email !== customer.email : false
      }
    });

    return { customer: this.toSafeCustomer(updated) };
  }

  async archiveCustomer(
    context: ActiveOrganisationContext,
    customerId: string,
    input: ArchiveCustomerDto
  ) {
    const customer = await this.findCustomerInOrganisation(
      context.activeOrganisation.id,
      customerId
    );

    if (!customer) {
      throw new NotFoundException("Customer was not found.");
    }

    if (customer.archivedAt) {
      throw new ConflictException("Customer is already archived.");
    }

    const archivedAt = new Date();
    const [updated] = await this.databaseService.db
      .update(customers)
      .set({ archivedAt, updatedAt: archivedAt })
      .where(eq(customers.id, customer.id))
      .returning();

    if (!updated) {
      throw new Error("Customer archive failed.");
    }

    await this.auditLogService.create({
      organisationId: context.activeOrganisation.id,
      actorUserId: context.user.id,
      action: "customer_archived",
      entityType: "customer",
      entityId: customer.id,
      metadataRedacted: {
        email: customer.email,
        reason: input.reason?.trim() || null
      }
    });

    return { customer: this.toSafeCustomer(updated) };
  }

  private async findCustomerInOrganisation(organisationId: string, customerId: string) {
    const [customer] = await this.databaseService.db
      .select()
      .from(customers)
      .where(and(eq(customers.organisationId, organisationId), eq(customers.id, customerId)))
      .limit(1);

    return customer;
  }

  private async findInvoicesForCustomer(organisationId: string, customerId: string) {
    return this.databaseService.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.organisationId, organisationId), eq(invoices.customerId, customerId)))
      .orderBy(desc(invoices.createdAt))
      .limit(10)
      .offset(0);
  }

  private async assertNoDuplicateActiveEmail(input: {
    organisationId: string;
    email: string;
    excludeCustomerId?: string;
  }) {
    const conditions = [
      eq(customers.organisationId, input.organisationId),
      isNull(customers.archivedAt),
      sql`lower(${customers.email}) = ${input.email}`
    ];

    if (input.excludeCustomerId) {
      conditions.push(ne(customers.id, input.excludeCustomerId));
    }

    const [existingCustomer] = await this.databaseService.db
      .select({ id: customers.id })
      .from(customers)
      .where(and(...conditions))
      .limit(1);

    if (existingCustomer) {
      throw new ConflictException("An active customer with this email already exists.");
    }
  }

  private normalizeCreateInput(input: CreateCustomerDto) {
    return {
      name: this.requiredText(input.name, "Customer name"),
      email: this.normalizeEmail(input.email),
      phone: this.nullableText(input.phone),
      billingAddress: this.nullableText(input.billingAddress)
    };
  }

  private normalizeUpdateInput(input: UpdateCustomerDto) {
    return {
      ...(input.name !== undefined ? { name: this.requiredText(input.name, "Customer name") } : {}),
      ...(input.email !== undefined ? { email: this.normalizeEmail(input.email) } : {}),
      ...(input.phone !== undefined ? { phone: this.nullableText(input.phone) } : {}),
      ...(input.billingAddress !== undefined
        ? { billingAddress: this.nullableText(input.billingAddress) }
        : {})
    };
  }

  private normalizeEmail(email: string | null | undefined) {
    if (typeof email !== "string") {
      throw new BadRequestException("Customer email is required.");
    }

    return email.trim().toLowerCase();
  }

  private requiredText(value: string | null | undefined, label: string) {
    if (typeof value !== "string") {
      throw new BadRequestException(`${label} is required.`);
    }

    const trimmed = value.trim();

    if (!trimmed) {
      throw new BadRequestException(`${label} is required.`);
    }

    return trimmed;
  }

  private nullableText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== "string") {
      throw new BadRequestException("Optional customer fields must be strings.");
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private getPagination(input: PaginationInput) {
    const page = input.page ?? 1;
    const limit = Math.min(input.limit ?? 20, 100);
    return { page, limit, offset: (page - 1) * limit };
  }

  private toPaginationResponse(
    pagination: { page: number; limit: number; offset: number },
    total: number
  ) {
    return {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit))
    };
  }

  private toSafeCustomer(customer: Customer) {
    const status: CustomerStatus = customer.archivedAt ? "archived" : "active";

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      billingAddress: customer.billingAddress,
      status,
      archivedAt: customer.archivedAt,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt
    };
  }

  private displayInvoiceStatus(invoice: Invoice): InvoiceStatusValue {
    return shouldDisplayAsOverdue({
      balanceDueKobo: invoice.balanceDueKobo,
      dueDate: invoice.dueDate,
      status: invoice.status
    })
      ? "overdue"
      : invoice.status;
  }

  private toInvoiceSummary(customerInvoices: Invoice[]) {
    const totals = customerInvoices.reduce(
      (summary, invoice) => ({
        totalBalanceDueKobo: summary.totalBalanceDueKobo + invoice.balanceDueKobo,
        totalInvoices: summary.totalInvoices + 1,
        totalInvoicedKobo: summary.totalInvoicedKobo + invoice.totalKobo,
        totalPaidKobo: summary.totalPaidKobo + invoice.amountPaidKobo
      }),
      {
        totalBalanceDueKobo: 0,
        totalInvoices: 0,
        totalInvoicedKobo: 0,
        totalPaidKobo: 0
      }
    );

    return {
      available: true,
      ...totals,
      message:
        totals.totalInvoices === 0
          ? "No invoices have been created for this customer yet."
          : `${totals.totalInvoices} invoice${totals.totalInvoices === 1 ? "" : "s"} found for this customer.`
    };
  }

  private toCustomerInvoiceHistoryItem(invoice: Invoice) {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: this.displayInvoiceStatus(invoice),
      currency: invoice.currency,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      totalKobo: invoice.totalKobo,
      amountPaidKobo: invoice.amountPaidKobo,
      balanceDueKobo: invoice.balanceDueKobo,
      publicAccessEnabled: invoice.publicAccessEnabled,
      sentAt: invoice.sentAt,
      paidAt: invoice.paidAt,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt
    };
  }
}
