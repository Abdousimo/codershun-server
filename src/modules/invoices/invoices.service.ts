import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
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
import { MailService } from "../mail/mail.service";
import { FileCategory } from "../files/dto/upload-file.dto";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { CreateInvoiceLineDto } from "./dto/create-invoice-line.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { QueryInvoicesDto } from "./dto/query-invoices.dto";
import { InvoiceReminderResponseDto, InvoiceResponseDto } from "./dto/invoice-response.dto";

const STAFF_ROLES: UserRole[] = [
  UserRole.super_admin,
  UserRole.finance,
  UserRole.sales,
  UserRole.account_manager,
];

@Injectable()
export class InvoicesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FilesService) private readonly filesService: FilesService,
    @Inject(MailService) private readonly mailService: MailService,
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
      throw new UnprocessableEntityException({
        code: "FR-BILL-02",
        message: "Issued invoices are immutable; create a credit note instead (FR-BILL-02)",
      });
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

    const [company, legalEntity] = await Promise.all([
      this.prisma.companies.findUnique({ where: { id: invoice.companyId } }),
      this.prisma.legalEntities.findUnique({ where: { id: invoice.legalEntityId } }),
    ]);

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

      const issueDate = new Date();
      const dueDate = invoice.dueDate || new Date(issueDate.getTime() + (company?.paymentTermsDays || 7) * 24 * 60 * 60 * 1000);

      const billingSnapshot = {
        legalName: company?.legalName || company?.name,
        vatNumber: company?.vatNumber,
        billingAddress: company?.billingAddress,
        billingCity: company?.billingCity,
        billingPostalCode: company?.billingPostalCode,
        billingCountryCode: company?.billingCountryCode,
        billingEmail: company?.billingEmail,
      };

      const bankSnapshot = {
        name: legalEntity?.name,
        bankName: legalEntity?.bankName,
        iban: legalEntity?.iban,
        swiftBic: legalEntity?.swiftBic,
        taxId: legalEntity?.taxId,
        address: legalEntity?.address,
      };

      return tx.invoices.update({
        where: { id },
        data: {
          fiscalYear,
          sequenceNumber: sequence.lastNumber,
          number,
          status: InvoiceStatus.issued,
          issueDate,
          dueDate,
          issuedBy: user.id,
          issuedAt: issueDate,
          billingSnapshot,
          bankSnapshot,
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
      throw new UnprocessableEntityException({
        code: "FR-BILL-03",
        message: "Payment exceeds the invoice total (FR-BILL-03)",
      });
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

  async sendInvoiceEmail(id: string, user: AuthenticatedUser) {
    this.assertFinance(user);
    const invoice = await this.getRaw(id);
    if (invoice.status === InvoiceStatus.draft) {
      throw new BadRequestException("Draft invoices must be issued before sending to clients");
    }

    const [company, legalEntity, lines] = await Promise.all([
      this.prisma.companies.findUnique({ where: { id: invoice.companyId } }),
      this.prisma.legalEntities.findUnique({ where: { id: invoice.legalEntityId } }),
      this.prisma.invoiceLines.findMany({ where: { invoiceId: id }, orderBy: { sortOrder: "asc" } }),
    ]);

    if (!company) throw new NotFoundException(`Company not found`);
    const recipientEmail = company.billingEmail || user.email;

    const formattedLines = lines.map((l) => ({
      description: l.description,
      quantity: new Prisma.Decimal(l.quantity).toString(),
      unitPrice: new Prisma.Decimal(l.unitPrice).toFixed(2),
      amount: new Prisma.Decimal(l.amount).toFixed(2),
    }));

    const bankDetails = {
      bankName: legalEntity?.bankName,
      iban: legalEntity?.iban,
      swiftBic: legalEntity?.swiftBic,
    };

    const sent = await this.mailService.sendInvoiceEmail({
      to: recipientEmail,
      invoiceNumber: invoice.number || `INV-${invoice.id.slice(0, 8)}`,
      companyName: company.legalName || company.name,
      currency: invoice.currency,
      total: new Prisma.Decimal(invoice.total).toFixed(2),
      balanceDue: new Prisma.Decimal(invoice.total).minus(new Prisma.Decimal(invoice.amountPaid)).toFixed(2),
      dueDate: invoice.dueDate ? invoice.dueDate.toISOString().split("T")[0] : null,
      issueDate: invoice.issueDate ? invoice.issueDate.toISOString().split("T")[0] : null,
      legalEntityName: legalEntity?.name || "Coders Hub Agency",
      bankDetails,
      lines: formattedLines,
    });

    if (sent) {
      await this.prisma.withUserContext(user, async (tx) => {
        await tx.invoices.update({
          where: { id },
          data: { sentAt: new Date() },
        });
        await tx.invoiceReminders.upsert({
          where: { invoiceId_stage: { invoiceId: id, stage: "issued" } },
          create: { invoiceId: id, stage: "issued", sentAt: new Date() },
          update: { sentAt: new Date() },
        });
      });
    }

    return {
      success: sent,
      recipient: recipientEmail,
      sentAt: new Date().toISOString(),
      message: sent ? `Invoice ${invoice.number} sent successfully to ${recipientEmail}` : `Failed to deliver email to ${recipientEmail}`,
    };
  }

  async sendInvoiceReminder(id: string, stage: string, user: AuthenticatedUser) {
    this.assertFinance(user);
    const invoice = await this.getRaw(id);
    if (invoice.status === InvoiceStatus.draft || invoice.status === InvoiceStatus.paid || invoice.status === InvoiceStatus.void) {
      throw new BadRequestException("Reminders can only be sent for issued or partially paid invoices with balance due");
    }

    const [company, legalEntity] = await Promise.all([
      this.prisma.companies.findUnique({ where: { id: invoice.companyId } }),
      this.prisma.legalEntities.findUnique({ where: { id: invoice.legalEntityId } }),
    ]);

    if (!company) throw new NotFoundException(`Company not found`);
    const recipientEmail = company.billingEmail || user.email;

    const dueDateStr = invoice.dueDate ? invoice.dueDate.toISOString().split("T")[0] : "due date";
    const daysOverdue = invoice.dueDate
      ? Math.max(0, Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const bankDetails = {
      bankName: legalEntity?.bankName,
      iban: legalEntity?.iban,
      swiftBic: legalEntity?.swiftBic,
    };

    const actualStage = stage || (daysOverdue > 0 ? `overdue_${daysOverdue}d` : "due_date");

    const sent = await this.mailService.sendInvoiceReminderEmail({
      to: recipientEmail,
      invoiceNumber: invoice.number || `INV-${invoice.id.slice(0, 8)}`,
      companyName: company.legalName || company.name,
      currency: invoice.currency,
      total: new Prisma.Decimal(invoice.total).toFixed(2),
      balanceDue: new Prisma.Decimal(invoice.total).minus(new Prisma.Decimal(invoice.amountPaid)).toFixed(2),
      dueDate: dueDateStr,
      daysOverdue,
      stage: actualStage,
      legalEntityName: legalEntity?.name || "Coders Hub Agency",
      bankDetails,
    });

    if (sent) {
      await this.prisma.withUserContext(user, async (tx) => {
        await tx.invoiceReminders.upsert({
          where: { invoiceId_stage: { invoiceId: id, stage: actualStage } },
          create: { invoiceId: id, stage: actualStage, sentAt: new Date() },
          update: { sentAt: new Date() },
        });

        if (daysOverdue >= 15) {
          await tx.companies.update({
            where: { id: invoice.companyId },
            data: { isOverdueFlagged: true },
          });
        }
      });
    }

    return {
      success: sent,
      recipient: recipientEmail,
      stage: actualStage,
      daysOverdue,
      message: sent ? `Reminder (${actualStage}) sent to ${recipientEmail}` : `Failed to send reminder to ${recipientEmail}`,
    };
  }

  async processAutomatedReminders(user: AuthenticatedUser) {
    this.assertFinance(user);
    const now = new Date();
    const invoices = await this.prisma.invoices.findMany({
      where: {
        status: { in: [InvoiceStatus.issued, InvoiceStatus.partially_paid] },
        dueDate: { not: null },
      },
    });

    const companyIds = [...new Set(invoices.map((i) => i.companyId))];
    const legalEntityIds = [...new Set(invoices.map((i) => i.legalEntityId))];

    const [companies, legalEntities] = await Promise.all([
      this.prisma.companies.findMany({ where: { id: { in: companyIds } } }),
      this.prisma.legalEntities.findMany({ where: { id: { in: legalEntityIds } } }),
    ]);

    const companyMap = new Map(companies.map((c) => [c.id, c]));
    const legalEntityMap = new Map(legalEntities.map((e) => [e.id, e]));

    let sentCount = 0;
    const results: Array<{ invoiceNumber: string; stage: string; recipient: string; success: boolean }> = [];

    for (const inv of invoices) {
      if (!inv.dueDate) continue;
      const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      let stage: string | null = null;

      if (daysOverdue >= 15) {
        stage = "overdue_15d";
      } else if (daysOverdue >= 10) {
        stage = "overdue_10d";
      } else if (daysOverdue >= 3) {
        stage = "overdue_3d";
      } else if (daysOverdue >= 0 && daysOverdue < 3) {
        stage = "due_date";
      }

      if (!stage) continue;

      const alreadySent = await this.prisma.invoiceReminders.findUnique({
        where: { invoiceId_stage: { invoiceId: inv.id, stage } },
      });

      if (!alreadySent) {
        const company = companyMap.get(inv.companyId);
        const legalEntity = legalEntityMap.get(inv.legalEntityId);
        const recipient = company?.billingEmail || user.email;
        const bankDetails = {
          bankName: legalEntity?.bankName,
          iban: legalEntity?.iban,
          swiftBic: legalEntity?.swiftBic,
        };

        const sent = await this.mailService.sendInvoiceReminderEmail({
          to: recipient,
          invoiceNumber: inv.number || `INV-${inv.id.slice(0, 8)}`,
          companyName: company?.legalName || company?.name || "Client",
          currency: inv.currency,
          total: new Prisma.Decimal(inv.total).toFixed(2),
          balanceDue: new Prisma.Decimal(inv.total).minus(new Prisma.Decimal(inv.amountPaid)).toFixed(2),
          dueDate: inv.dueDate.toISOString().split("T")[0],
          daysOverdue,
          stage,
          legalEntityName: legalEntity?.name || "Coders Hub Agency",
          bankDetails,
        });

        if (sent) {
          await this.prisma.invoiceReminders.create({
            data: {
              invoiceId: inv.id,
              stage,
              sentAt: new Date(),
            },
          });
          if (daysOverdue >= 15) {
            await this.prisma.companies.update({
              where: { id: inv.companyId },
              data: { isOverdueFlagged: true },
            });
          }
          sentCount++;
          results.push({
            invoiceNumber: inv.number || inv.id,
            stage,
            recipient,
            success: true,
          });
        }
      }
    }

    return {
      totalInvoicesChecked: invoices.length,
      remindersSent: sentCount,
      details: results,
    };
  }

  async getInvoiceReminders(id: string, user: AuthenticatedUser): Promise<InvoiceReminderResponseDto[]> {
    await this.findById(id, user);
    const reminders = await this.prisma.invoiceReminders.findMany({
      where: { invoiceId: id },
      orderBy: { sentAt: "desc" },
    });
    return reminders.map((r) => ({
      id: r.id,
      invoiceId: r.invoiceId,
      stage: r.stage,
      sentAt: r.sentAt.toISOString(),
    }));
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
    const [lines, payments, company, legalEntity] = await Promise.all([
      this.prisma.invoiceLines.findMany({ where: { invoiceId: invoice.id }, orderBy: { sortOrder: "asc" } }),
      this.prisma.payments.findMany({ where: { invoiceId: invoice.id }, orderBy: { receivedOn: "asc" } }),
      this.prisma.companies.findUnique({ where: { id: invoice.companyId }, select: { name: true, legalName: true, billingEmail: true } }),
      this.prisma.legalEntities.findUnique({ where: { id: invoice.legalEntityId }, select: { name: true } }),
    ]);
    const total = new Prisma.Decimal(invoice.total);
    const amountPaid = new Prisma.Decimal(invoice.amountPaid);
    return {
      id: invoice.id,
      kind: invoice.kind,
      companyId: invoice.companyId,
      companyName: company?.legalName || company?.name || null,
      companyBillingEmail: company?.billingEmail || null,
      legalEntityId: invoice.legalEntityId,
      legalEntityName: legalEntity?.name || null,
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
      sentAt: invoice.sentAt?.toISOString() ?? null,
      periodStart: invoice.periodStart?.toISOString().split("T")[0] ?? null,
      periodEnd: invoice.periodEnd?.toISOString().split("T")[0] ?? null,
      notes: invoice.notes ?? null,
      billingSnapshot: invoice.billingSnapshot,
      bankSnapshot: invoice.bankSnapshot,
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
