import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { TalentsService } from "../talents.service";

@ApiTags("Talent / Dashboard")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.talent, UserRole.super_admin)
@Controller("talent/dashboard")
export class TalentDashboardController {
  constructor(@Inject(TalentsService) private readonly talentsService: TalentsService) {}

  @Get()
  @ApiOperation({
    summary: "Get aggregated dashboard metrics for talent (pipeline, active placement, timesheet, payouts, interviews)",
  })
  @ApiResponse({ status: 200, description: "Returns role-safe talent dashboard overview" })
  async getDashboard(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.talentsService.getTalentDashboard(currentUser);
  }

  @Post("application")
  @ApiOperation({
    summary: "Submit talent application and upload CV from the authenticated talent portal",
  })
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("cv"))
  async submitApplication(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: any,
    @UploadedFile() cvFile?: Express.Multer.File,
  ) {
    return this.talentsService.submitTalentApplicationFromDashboard(
      currentUser,
      dto,
      cvFile
        ? {
            originalname: cvFile.originalname,
            mimetype: cvFile.mimetype,
            size: cvFile.size,
            buffer: cvFile.buffer,
          }
        : undefined,
    );
  }
}

