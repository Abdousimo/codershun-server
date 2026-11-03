import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  InvoiceKind,
  InvoiceStatus,
  PaymentMethod,
  Prisma,
  UserRole,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { FilesService } from "../files/files.service";
import { FileCategory } from "../files/dto/upload-file.dto";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { CreateInvoiceLineDto } from "./dto/create-invoice-line.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { QueryInvoicesDto } from "./dto/query-invoices.dto";
import { InvoiceResponseDto } from "./dto/invoice-response.dto";

const STAFF_ROLES: UserRole[] = [
  UserRole.super_admin,
  UserRole.finance,
  UserRole.sales,
  UserRole.account_manager,
];

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  private assertFinance(user: AuthenticatedUser): void {
    if (!([UserRole.finance, UserRole.super_admin] as UserRole[]).includes(user.role)) {
      throw new ForbiddenException("Only Finance or Super admin can modify invoices");
    }
  }

  private async getRaw(id: string) {
    const invoice = await this.prisma.invoices.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    return invoice;
  }

  private assertDraft(status: InvoiceStatus): void {
    if (status !== InvoiceStatus.draft) {
      throw new BadRequestException("Issued invoices are immutable; create a credit note instead");
    }
  }

  async create(dto: CreateInvoiceDto, user: AuthenticatedUser): Promise<InvoiceResponseDto> {
    this.assertFinance(user);
    const [company, entity] = await Promise.all([
      this.prisma.companies.findUnique({ where: { id: dto.companyId } }),
      this.prisma.legalEntities.findUnique({ where: { id: dto.legalEntityId } }),
    ]);
    if (!company) throw new NotFoundException(`Company ${dto.companyId} not found`);
    if (!entity) throw new NotFoundException(`Legal entity ${dto.legalEntityId} not found`);

    const invoice = await this.prisma.withUserContext(user, (tx) =>
      tx.invoices.create({
        data: {
          kind: dto.kind ?? InvoiceKind.invoice,
          companyId: dto.companyId,
          legalEntityId: dto.legalEntityId,
          language: dto.language,
          currency: dto.currency.toUpperCase(),
          periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
          periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          notes: dto.notes,
          createdBy: user.id,
        },
      }),
    );
    return this.findById(invoice.id, user);
  }

  async findAll(query: QueryInvoicesDto, user: AuthenticatedUser) {
    const where: Prisma.InvoicesWhereInput = {};
    if (STAFF_ROLES.includes(user.role)) {
      if (query.companyId) where.companyId = query.companyId;
    } else if (user.companyId) {
      where.companyId = user.companyId;
    } else {
      throw new ForbiddenException("User has no invoice scope");
    }
    if (query.status) where.status = query.status;
    if (query.kind) where.kind = query.kind;
    if (query.search) where.number = { contains: query.search, mode: Prisma.QueryMode.insensitive };
    const skip = (query.page - 1) * query.pageSize;
    const [total, invoices] = await Promise.all([
      this.prisma.invoices.count({ where }),
      this.prisma.invoices.findMany({ where, skip, take: query.pageSize, orderBy: { createdAt: "desc" } }),
    ]);
    return {
      data: await Promise.all(invoices.map((invoice) => this.mapResponse(invoice))),
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async findById(id: string, user: AuthenticatedUser): Promise<InvoiceResponseDto> {
    const invoice = await this.getRaw(id);
    if (!STAFF_ROLES.includes(user.role) && invoice.companyId !== user.companyId) {
      throw new ForbiddenException("Access to this invoice is denied");
    }
    return this.mapResponse(invoice);
  }

  async update(id: string, dto: UpdateInvoiceDto, user: AuthenticatedUser): Promise<InvoiceResponseDto> {
    this.assertFinance(user);
    const invoice = await this.getRaw(id);
    this.assertDraft(invoice.status);
    const updated = await this.prisma.withUserContext(user, (tx) =>
      tx.invoices.update({
        where: { id },
        data: {
          ...(dto.companyId !== undefined && { companyId: dto.companyId }),
          ...(dto.legalEntityId !== undefined && { legalEntityId: dto.legalEntityId }),
          ...(dto.kind !== undefined && { kind: dto.kind }),
          ...(dto.language !== undefined && { language: dto.language }),
          ...(dto.currency !== undefined && { currency: dto.currency.toUpperCase() }),
          ...(dto.periodStart !== undefined && { periodStart: new Date(dto.periodStart) }),
          ...(dto.periodEnd !== undefined && { periodEnd: new Date(dto.periodEnd) }),
          ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          updatedAt: new Date(),
        },
      }),
    );
    return this.mapResponse(updated);
  }

  async addLine(id: string, dto: CreateInvoiceLineDto, user: AuthenticatedUser): Promise<InvoiceResponseDto> {
    this.assertFinance(user);
    const invoice = await this.getRaw(id);
    this.assertDraft(invoice.status);
    const quantity = new Prisma.Decimal(dto.quantity);
    const unitPrice = new Prisma.Decimal(dto.unitPrice);
    const discountPct = new Prisma.Decimal(dto.discountPct ?? 0);
    const amount = quantity.times(unitPrice).times(new Prisma.Decimal(100).minus(discountPct)).dividedBy(100);
    await this.prisma.withUserContext(user, async (tx) => {
      await tx.invoiceLines.create({
        data: {
          invoiceId: id,
          placementId: dto.placementId,
          timesheetId: dto.timesheetId,
          kind: dto.kind,
          description: dto.description,
          periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
          periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
          quantity,
          unit: dto.unit ?? "month",
          unitPrice,
          discountPct,
          amount,
        },
      });
      await this.recalculate(tx, id);
    });
    return this.findById(id, user);
  }

  async issue(id: string, user: AuthenticatedUser): Promise<InvoiceResponseDto> {
    this.assertFinance(user);
    const invoice = await this.getRaw(id);
    this.assertDraft(invoice.status);
    const lines = await this.prisma.invoiceLines.findMany({ where: { invoiceId: id } });
    if (lines.length === 0) throw new BadRequestException("An invoice must contain at least one line");
    const fiscalYear = new Date().getUTCFullYear();
    const issued = await this.prisma.withUserContext(user, async (tx) => {
      const sequence = await tx.invoiceNumberSequences.upsert({
        where: {
          legalEntityId_kind_fiscalYear: {
            legalEntityId: invoice.legalEntityId,
            kind: invoice.kind,
            fiscalYear,
          },
        },
        create: {
          legalEntityId: invoice.legalEntityId,
          kind: invoice.kind,
          fiscalYear,
          lastNumber: 1,
        },
        update: { lastNumber: { increment: 1 } },
      });
      const prefix = invoice.kind === InvoiceKind.credit_note ? "CN" : "INV";
      const number = `${prefix}-${fiscalYear}-${String(sequence.lastNumber).padStart(5, "0")}`;
      return tx.invoices.update({
        where: { id },
        data: {
          fiscalYear,
          sequenceNumber: sequence.lastNumber,
          number,
          status: InvoiceStatus.issued,
          issueDate: new Date(),
          issuedBy: user.id,
          issuedAt: new Date(),
        },
      });
    });
    return this.mapResponse(issued);
  }

  async createCreditNote(id: string, dto: CreateInvoiceDto, user: AuthenticatedUser): Promise<InvoiceResponseDto> {
    this.assertFinance(user);
    const original = await this.getRaw(id);
    if (original.status === InvoiceStatus.draft) throw new BadRequestException("Credit notes require an issued invoice");
    const credit = await this.prisma.withUserContext(user, (tx) =>
      tx.invoices.create({
        data: {
          kind: InvoiceKind.credit_note,
          creditedInvoiceId: original.id,
          companyId: original.companyId,
          legalEntityId: original.legalEntityId,
          language: dto.language ?? original.language,
          currency: original.currency,
          notes: dto.notes,
          createdBy: user.id,
        },
      }),
    );
    return this.findById(credit.id, user);
  }

  async recordPayment(id: string, dto: CreatePaymentDto, user: AuthenticatedUser): Promise<InvoiceResponseDto> {
    this.assertFinance(user);
    const invoice = await this.getRaw(id);
    if (invoice.status === InvoiceStatus.draft || invoice.status === InvoiceStatus.void) {
      throw new BadRequestException("Payments can only be recorded for issued invoices");
    }
    const paid = new Prisma.Decimal(invoice.amountPaid).plus(new Prisma.Decimal(dto.amount));
    if (paid.greaterThan(new Prisma.Decimal(invoice.total))) {
      throw new BadRequestException("Payment exceeds the invoice total");
    }
    await this.prisma.withUserContext(user, async (tx) => {
      await tx.payments.create({
        data: {
          invoiceId: id,
          receivedOn: new Date(dto.receivedOn),
          amount: new Prisma.Decimal(dto.amount),
          currency: dto.currency.toUpperCase(),
          method: dto.method,
          fees: new Prisma.Decimal(dto.fees ?? 0),
          fxRate: dto.fxRate === undefined ? null : new Prisma.Decimal(dto.fxRate),
          reference: dto.reference,
          recordedBy: user.id,
        },
      });
      const status = paid.equals(new Prisma.Decimal(invoice.total)) ? InvoiceStatus.paid : InvoiceStatus.partially_paid;
      await tx.invoices.update({
        where: { id },
        data: {
          amountPaid: paid,
          status,
          paidAt: status === InvoiceStatus.paid ? new Date() : null,
        },
      });
    });
    return this.findById(id, user);
  }

  async attachPdf(id: string, file: { originalname: string; mimetype: string; size: number; buffer: Buffer }, user: AuthenticatedUser): Promise<InvoiceResponseDto> {
    this.assertFinance(user);
    await this.getRaw(id);
    const uploaded = await this.filesService.uploadFile(file, FileCategory.INVOICE, user);
    const updated = await this.prisma.withUserContext(user, (tx) =>
      tx.invoices.update({ where: { id }, data: { pdfFileId: uploaded.id } }),
    );
    return this.mapResponse(updated);
  }

  private async recalculate(tx: any, id: string): Promise<void> {
    const lines = await tx.invoiceLines.findMany({ where: { invoiceId: id } });
    const subtotal = lines.reduce(
      (sum: Prisma.Decimal, line: { amount: Prisma.Decimal }) => sum.plus(line.amount),
      new Prisma.Decimal(0),
    );
    await tx.invoices.update({
      where: { id },
      data: {
        subtotal,
        discountTotal: new Prisma.Decimal(0),
        vatAmount: subtotal.times(new Prisma.Decimal(0)).dividedBy(100),
        total: subtotal,
      },
    });
  }

  private async mapResponse(invoice: any): Promise<InvoiceResponseDto> {
    const [lines, payments] = await Promise.all([
      this.prisma.invoiceLines.findMany({ where: { invoiceId: invoice.id }, orderBy: { sortOrder: "asc" } }),
      this.prisma.payments.findMany({ where: { invoiceId: invoice.id }, orderBy: { receivedOn: "asc" } }),
    ]);
    const total = new Prisma.Decimal(invoice.total);
    const amountPaid = new Prisma.Decimal(invoice.amountPaid);
    return {
      id: invoice.id,
      kind: invoice.kind,
      companyId: invoice.companyId,
      legalEntityId: invoice.legalEntityId,
      number: invoice.number,
      status: invoice.status,
      language: invoice.language,
      currency: invoice.currency,
      subtotal: new Prisma.Decimal(invoice.subtotal).toFixed(2),
      discountTotal: new Prisma.Decimal(invoice.discountTotal).toFixed(2),
      vatRate: new Prisma.Decimal(invoice.vatRate).toFixed(2),
      vatAmount: new Prisma.Decimal(invoice.vatAmount).toFixed(2),
      total: total.toFixed(2),
      amountPaid: amountPaid.toFixed(2),
      balanceDue: total.minus(amountPaid).toFixed(2),
      issueDate: invoice.issueDate?.toISOString().split("T")[0] ?? null,
      dueDate: invoice.dueDate?.toISOString().split("T")[0] ?? null,
      pdfFileId: invoice.pdfFileId,
      lines: lines.map((line: any) => ({
        id: line.id,
        kind: line.kind,
        description: line.description,
        placementId: line.placementId,
        quantity: new Prisma.Decimal(line.quantity).toFixed(2),
        unit: line.unit,
        unitPrice: new Prisma.Decimal(line.unitPrice).toFixed(2),
        discountPct: new Prisma.Decimal(line.discountPct).toFixed(2),
        amount: new Prisma.Decimal(line.amount).toFixed(2),
      })),
      payments: payments.map((payment: any) => ({
        id: payment.id,
        receivedOn: payment.receivedOn.toISOString().split("T")[0],
        amount: new Prisma.Decimal(payment.amount).toFixed(2),
        currency: payment.currency,
        method: payment.method as PaymentMethod,
        fees: new Prisma.Decimal(payment.fees).toFixed(2),
        fxRate: payment.fxRate ? new Prisma.Decimal(payment.fxRate).toFixed(8) : null,
        reference: payment.reference,
      })),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };
  }
}
