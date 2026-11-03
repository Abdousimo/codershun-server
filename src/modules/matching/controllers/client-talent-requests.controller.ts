import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { RequestStatus, UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { TalentRequestsService } from "../talent-requests.service";
import { CreateTalentRequestDto } from "../dto/create-talent-request.dto";
import { QueryTalentRequestsDto } from "../dto/query-talent-requests.dto";

@ApiTags("Client / Talent Requests")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.client_admin, UserRole.client_user)
@Controller("client/talent-requests")
export class ClientTalentRequestsController {
  constructor(private readonly talentRequestsService: TalentRequestsService) {}

  @Get()
  @ApiOperation({ summary: "List own company's talent requests" })
  async findAll(
    @Query() query: QueryTalentRequestsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.talentRequestsService.findAll(query, currentUser);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get details of own talent request" })
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.talentRequestsService.findById(id, currentUser);
  }

  @Post()
  @ApiOperation({ summary: "Submit a new talent request from the client portal" })
  async create(
    @Body() dto: CreateTalentRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.talentRequestsService.createRequest(dto, currentUser);
  }

  @Patch(":id/cancel")
  @ApiOperation({ summary: "Cancel a talent request" })
  async cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body("reason") reason: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.talentRequestsService.updateStatus(
      id,
      {
        status: RequestStatus.cancelled,
        cancelledReason: reason,
      },
      currentUser,
    );
  }
}
