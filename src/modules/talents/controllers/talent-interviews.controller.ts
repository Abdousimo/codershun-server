import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { TalentsService } from "../talents.service";

@ApiTags("Talent / Interviews")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.talent, UserRole.super_admin)
@Controller("talent/interviews")
export class TalentInterviewsController {
  constructor(@Inject(TalentsService) private readonly talentsService: TalentsService) {}

  @Get()
  @ApiOperation({ summary: "List all scheduled and past client interviews for talent" })
  @ApiResponse({ status: 200, description: "Returns list of talent interviews" })
  async getInterviews(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.talentsService.getTalentInterviews(currentUser);
  }
}
