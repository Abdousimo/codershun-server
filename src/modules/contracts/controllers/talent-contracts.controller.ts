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

@ApiTags("Talent / Contracts")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.talent, UserRole.super_admin)
@Controller("talent/contracts")
export class TalentContractsController {
  constructor(@Inject(ContractsService) private readonly contractsService: ContractsService) {}

  @Get()
  @ApiOperation({ summary: "Get signed contracts and agreements assigned to this talent" })
  async getContracts(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.contractsService.getTalentContracts(currentUser);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get single talent contract details" })
  async getContractById(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.contractsService.getTalentContractById(id, currentUser);
  }
}
