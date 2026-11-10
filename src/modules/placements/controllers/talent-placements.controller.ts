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
import { PlacementsService } from "../placements.service";
import { QueryPlacementsDto } from "../dto/query-placements.dto";

@ApiTags("Talent / Placements")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.talent, UserRole.super_admin)
@Controller("talent/placements")
export class TalentPlacementsController {
  constructor(@Inject(PlacementsService) private readonly placementsService: PlacementsService) {}

  @Get()
  @ApiOperation({ summary: "List assigned placements - FR-SEC-02 strictly hides client price and margin" })
  async findAll(
    @Query() query: QueryPlacementsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.placementsService.findAll(query, currentUser);
  }

  @Get(":id")
  @ApiOperation({ summary: "View details of assigned placement" })
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.placementsService.findById(id, currentUser);
  }
}

