import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { ShortlistsService } from "../shortlists.service";
import { CreateShortlistDto } from "../dto/create-shortlist.dto";
import { AddShortlistItemDto, UpdateShortlistItemDto } from "../dto/shortlist-item.dto";

@ApiTags("Admin / Shortlists")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(
  UserRole.super_admin,
  UserRole.recruiter_lead,
  UserRole.recruiter,
  UserRole.sales,
  UserRole.account_manager,
)
@Controller("admin")
export class AdminShortlistsController {
  constructor(private readonly shortlistsService: ShortlistsService) {}

  @Post("talent-requests/:requestId/shortlists")
  @ApiOperation({ summary: "Create a new draft shortlist for a talent request" })
  async createShortlist(
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() dto: CreateShortlistDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.shortlistsService.createShortlist(requestId, dto, currentUser);
  }

  @Get("shortlists/:shortlistId")
  @ApiOperation({ summary: "Get complete shortlist details for internal staff review" })
  async findOne(
    @Param("shortlistId", ParseUUIDPipe) shortlistId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.shortlistsService.findAdminShortlistById(shortlistId, currentUser);
  }

  @Post("shortlists/:shortlistId/items")
  @ApiOperation({ summary: "Add a talent to a shortlist (validates Vetted & Available - FR-TAL-01)" })
  async addItem(
    @Param("shortlistId", ParseUUIDPipe) shortlistId: string,
    @Body() dto: AddShortlistItemDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.shortlistsService.addItem(shortlistId, dto, currentUser);
  }

  @Patch("shortlists/:shortlistId/items/:talentId")
  @ApiOperation({ summary: "Update recruiter note, proposed price, or sort order of a shortlist item" })
  async updateItem(
    @Param("shortlistId", ParseUUIDPipe) shortlistId: string,
    @Param("talentId", ParseUUIDPipe) talentId: string,
    @Body() dto: UpdateShortlistItemDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.shortlistsService.updateItem(shortlistId, talentId, dto, currentUser);
  }

  @Delete("shortlists/:shortlistId/items/:talentId")
  @ApiOperation({ summary: "Remove a talent from a shortlist" })
  async removeItem(
    @Param("shortlistId", ParseUUIDPipe) shortlistId: string,
    @Param("talentId", ParseUUIDPipe) talentId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.shortlistsService.removeItem(shortlistId, talentId, currentUser);
  }

  @Post("shortlists/:shortlistId/publish")
  @ApiOperation({ summary: "Publish shortlist to client, set SLA firstShortlistAt, generate secure share token" })
  async publish(
    @Param("shortlistId", ParseUUIDPipe) shortlistId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.shortlistsService.publishShortlist(shortlistId, currentUser);
  }

  @Get("shortlists/:shortlistId/pdf")
  @ApiOperation({ summary: "Export anonymised shortlist as PDF (FR-SEC-01)" })
  async exportPdf(
    @Param("shortlistId", ParseUUIDPipe) shortlistId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.shortlistsService.generateAnonymisedPdf(shortlistId, currentUser);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="shortlist-${shortlistId}-anonymised.pdf"`,
      "Content-Length": pdfBuffer.length.toString(),
    });
    res.end(pdfBuffer);
  }
}

