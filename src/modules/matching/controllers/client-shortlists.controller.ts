import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { ShortlistsService } from "../shortlists.service";
import { ShortlistClientDecisionDto } from "../dto/client-decision.dto";

@ApiTags("Client / Shortlists")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.client_admin, UserRole.client_user)
@Controller("client/shortlists")
export class ClientShortlistsController {
  constructor(@Inject(ShortlistsService) private readonly shortlistsService: ShortlistsService) {}

  @Get(":id")
  @ApiOperation({ summary: "View published shortlist for own company (FR-SEC-01 strictly anonymised)" })
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.shortlistsService.findClientShortlistById(id, currentUser);
  }

  @Post(":id/items/:talentId/decision")
  @ApiOperation({ summary: "Record decision on a shortlisted talent (interview, not_a_fit, hire)" })
  async recordDecision(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("talentId", ParseUUIDPipe) talentId: string,
    @Body() dto: ShortlistClientDecisionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.shortlistsService.recordClientDecision(id, talentId, dto, currentUser);
  }
}

