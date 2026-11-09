import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import type { UploadedMulterFile } from "../../files/files.controller";
import { InvoicesService } from "../invoices.service";
import { CreateInvoiceDto } from "../dto/create-invoice.dto";
import { UpdateInvoiceDto } from "../dto/update-invoice.dto";
import { CreateInvoiceLineDto } from "../dto/create-invoice-line.dto";
import { CreatePaymentDto } from "../dto/create-payment.dto";
import { QueryInvoicesDto } from "../dto/query-invoices.dto";

@ApiTags("Admin / Invoices")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.super_admin, UserRole.finance, UserRole.sales, UserRole.account_manager)
@Controller("admin/invoices")
export class AdminInvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  findAll(@Query() query: QueryInvoicesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.findAll(query, user);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.findById(id, user);
  }

  @Post()
  @Roles(UserRole.super_admin, UserRole.finance)
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.create(dto, user);
  }

  @Patch(":id")
  @Roles(UserRole.super_admin, UserRole.finance)
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.update(id, dto, user);
  }

  @Post(":id/lines")
  @Roles(UserRole.super_admin, UserRole.finance)
  addLine(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateInvoiceLineDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.addLine(id, dto, user);
  }

  @Post(":id/issue")
  @Roles(UserRole.super_admin, UserRole.finance)
  issue(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.issue(id, user);
  }

  @Post(":id/credit-note")
  @Roles(UserRole.super_admin, UserRole.finance)
  creditNote(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.createCreditNote(id, dto, user);
  }

  @Post(":id/payments")
  @Roles(UserRole.super_admin, UserRole.finance)
  recordPayment(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreatePaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.recordPayment(id, dto, user);
  }

  @Post(":id/pdf")
  @Roles(UserRole.super_admin, UserRole.finance)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  uploadPdf(@Param("id", ParseUUIDPipe) id: string, @UploadedFile() file: UploadedMulterFile, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.attachPdf(id, file, user);
  }

  @Post(":id/send")
  @Roles(UserRole.super_admin, UserRole.finance)
  @ApiOperation({ summary: "Send invoice by email to client billing contact" })
  sendEmail(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.sendInvoiceEmail(id, user);
  }

  @Post(":id/remind")
  @Roles(UserRole.super_admin, UserRole.finance)
  @ApiOperation({ summary: "Send overdue payment reminder email for this invoice" })
  sendReminder(
    @Param("id", ParseUUIDPipe) id: string,
    @Body("stage") stage: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.sendInvoiceReminder(id, stage, user);
  }

  @Post("reminders/process")
  @Roles(UserRole.super_admin, UserRole.finance)
  @ApiOperation({ summary: "Automated batch processing for overdue invoice reminders" })
  processReminders(@CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.processAutomatedReminders(user);
  }

  @Get(":id/reminders")
  @ApiOperation({ summary: "Get all sent reminders for an invoice" })
  getReminders(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.getInvoiceReminders(id, user);
  }
}
