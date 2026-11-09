import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { CrmService } from "../crm.service";
import { QueryCompaniesDto } from "../dto/query-crm.dto";
import { CreateCompanyDto, UpdateCompanyDto } from "../dto/company.dto";
import { CreateContactDto, UpdateContactDto } from "../dto/contact.dto";

@ApiTags("CRM Companies")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("crm")
export class CompaniesController {
  constructor(@Inject(CrmService) private readonly crmService: CrmService) {}

  @Get("companies")
  @Roles(
    UserRole.super_admin,
    UserRole.sales,
    UserRole.account_manager,
    UserRole.recruiter,
    UserRole.recruiter_lead,
    UserRole.finance,
  )
  @ApiOperation({ summary: "List companies with pagination and filters" })
  async getCompanies(@Query() query: QueryCompaniesDto) {
    return this.crmService.getCompanies(query);
  }

  @Get("companies/:id")
  @Roles(
    UserRole.super_admin,
    UserRole.sales,
    UserRole.account_manager,
    UserRole.recruiter,
    UserRole.recruiter_lead,
    UserRole.finance,
  )
  @ApiOperation({ summary: "Get company profile with contacts and linked leads" })
  async getCompanyById(@Param("id") id: string) {
    return this.crmService.getCompanyById(id);
  }

  @Post("companies")
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager)
  @ApiOperation({ summary: "Create a company profile" })
  async createCompany(
    @Body() dto: CreateCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crmService.createCompany(dto, user);
  }

  @Patch("companies/:id")
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager)
  @ApiOperation({ summary: "Update company profile" })
  async updateCompany(
    @Param("id") id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crmService.updateCompany(id, dto, user);
  }

  @Delete("companies/:id")
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager)
  @ApiOperation({ summary: "Soft delete company" })
  async deleteCompany(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crmService.softDeleteCompany(id, user);
  }

  @Get("companies/:id/contacts")
  @Roles(
    UserRole.super_admin,
    UserRole.sales,
    UserRole.account_manager,
    UserRole.recruiter,
    UserRole.recruiter_lead,
    UserRole.finance,
  )
  @ApiOperation({ summary: "Get contacts for a company" })
  async getCompanyContacts(@Param("id") companyId: string) {
    return this.crmService.getCompanyContacts(companyId);
  }

  @Post("companies/:id/contacts")
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager)
  @ApiOperation({ summary: "Add a contact person to a company" })
  async createContact(
    @Param("id") companyId: string,
    @Body() dto: CreateContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crmService.createContact(companyId, dto, user);
  }

  @Patch("contacts/:id")
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager)
  @ApiOperation({ summary: "Update contact person details" })
  async updateContact(
    @Param("id") id: string,
    @Body() dto: UpdateContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crmService.updateContact(id, dto, user);
  }
}

