import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import type { UploadedMulterFile } from "../../files/files.controller";
import { PayoutsService } from "../payouts.service";
import { CreatePayoutDto } from "../dto/create-payout.dto";
import { CreatePayoutLineDto } from "../dto/create-payout-line.dto";
import { MarkPaidDto } from "../dto/mark-paid.dto";
import { QueryPayoutsDto } from "../dto/query-payouts.dto";

@ApiTags("Admin / Payouts")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.super_admin, UserRole.finance)
@Controller("admin/payouts")
export class AdminPayoutsController {
  constructor(@Inject(PayoutsService) private readonly payoutsService: PayoutsService) {}

  @Get()
  @ApiOperation({ summary: "List talent payouts" })
  findAll(@Query() query: QueryPayoutsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payoutsService.findAll(query, user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get payout details" })
  findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payoutsService.findById(id, user);
  }

  @Post()
  @ApiOperation({ summary: "Create a manual payout for the previous month" })
  create(@Body() dto: CreatePayoutDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payoutsService.create(dto, user);
  }

  @Post(":id/lines")
  @ApiOperation({ summary: "Add a payout line" })
  addLine(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreatePayoutLineDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payoutsService.addLine(id, dto, user);
  }

  @Post(":id/approve")
  @ApiOperation({ summary: "Approve a pending payout" })
  approve(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payoutsService.approve(id, user);
  }

  @Post(":id/paid")
  @ApiOperation({ summary: "Mark an approved payout as paid" })
  markPaid(@Param("id", ParseUUIDPipe) id: string, @Body() dto: MarkPaidDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payoutsService.markPaid(id, dto, user);
  }

  @Post(":id/statement")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload payout statement PDF" })
  attachStatement(@Param("id", ParseUUIDPipe) id: string, @UploadedFile() file: UploadedMulterFile, @CurrentUser() user: AuthenticatedUser) {
    return this.payoutsService.attachStatement(id, file, user);
  }
}
