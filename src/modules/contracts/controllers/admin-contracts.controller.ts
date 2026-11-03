import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { ContractsService } from "../contracts.service";
import { CreateContractDto } from "../dto/create-contract.dto";
import { UpdateContractDto } from "../dto/update-contract.dto";
import { CreateSignatoryDto } from "../dto/create-signatory.dto";
import { UpdateSignatureStatusDto } from "../dto/update-signature-status.dto";
import { QueryContractsDto } from "../dto/query-contracts.dto";
import type { UploadedMulterFile } from "../../files/files.controller";

@ApiTags("Admin / Contracts")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.super_admin, UserRole.finance, UserRole.sales, UserRole.recruiter, UserRole.recruiter_lead, UserRole.account_manager)
@Controller("admin/contracts")
export class AdminContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  @ApiOperation({ summary: "List contracts" })
  findAll(@Query() query: QueryContractsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.contractsService.findAll(query, user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get contract details" })
  findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.contractsService.findById(id, user);
  }

  @Post()
  @ApiOperation({ summary: "Create contract metadata" })
  create(@Body() dto: CreateContractDto, @CurrentUser() user: AuthenticatedUser) {
    return this.contractsService.create(dto, user);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update contract metadata" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateContractDto, @CurrentUser() user: AuthenticatedUser) {
    return this.contractsService.update(id, dto, user);
  }

  @Post(":id/file")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload contract PDF" })
  attachFile(@Param("id", ParseUUIDPipe) id: string, @UploadedFile() file: UploadedMulterFile, @CurrentUser() user: AuthenticatedUser) {
    return this.contractsService.attachFile(id, file, false, user);
  }

  @Post(":id/signed-file")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload signed contract PDF" })
  attachSignedFile(@Param("id", ParseUUIDPipe) id: string, @UploadedFile() file: UploadedMulterFile, @CurrentUser() user: AuthenticatedUser) {
    return this.contractsService.attachFile(id, file, true, user);
  }

  @Post(":id/signatories")
  addSignatory(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateSignatoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.contractsService.addSignatory(id, dto, user);
  }

  @Patch(":id/signature-status")
  updateStatus(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateSignatureStatusDto, @CurrentUser() user: AuthenticatedUser) {
    return this.contractsService.updateSignatureStatus(id, dto, user);
  }
}
