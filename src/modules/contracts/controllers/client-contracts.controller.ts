import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { ContractsService } from "../contracts.service";

@ApiTags("Client / Contracts")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.client_admin, UserRole.client_user, UserRole.super_admin)
@Controller("client/contracts")
export class ClientContractsController {
  constructor(@Inject(ContractsService) private readonly contractsService: ContractsService) {}

  @Get()
  @ApiOperation({ summary: "Get signed contracts and agreements for client company" })
  async getContracts(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.contractsService.getClientContracts(currentUser);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get single client contract details and signatories" })
  async getContractById(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.contractsService.getClientContractById(id, currentUser);
  }
}

