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
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.create(dto, user);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.update(id, dto, user);
  }

  @Post(":id/lines")
  addLine(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateInvoiceLineDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.addLine(id, dto, user);
  }

  @Post(":id/issue")
  issue(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.issue(id, user);
  }

  @Post(":id/credit-note")
  creditNote(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.createCreditNote(id, dto, user);
  }

  @Post(":id/payments")
  recordPayment(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreatePaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.recordPayment(id, dto, user);
  }

  @Post(":id/pdf")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  uploadPdf(@Param("id", ParseUUIDPipe) id: string, @UploadedFile() file: UploadedMulterFile, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.attachPdf(id, file, user);
  }
}
