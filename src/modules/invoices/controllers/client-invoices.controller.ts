import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
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
import { InvoicesService } from "../invoices.service";
import { QueryInvoicesDto } from "../dto/query-invoices.dto";

@ApiTags("Client / Invoices")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.client_admin, UserRole.client_user, UserRole.super_admin)
@Controller("client/invoices")
export class ClientInvoicesController {
  constructor(@Inject(InvoicesService) private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: "List company invoices for client portal" })
  async findAll(@Query() query: QueryInvoicesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.findAll(query, user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get detailed invoice statement and breakdown" })
  async findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.findById(id, user);
  }
}
