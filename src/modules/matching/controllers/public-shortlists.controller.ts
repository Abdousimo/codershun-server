import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ShortlistsService } from "../shortlists.service";
import { ShortlistClientDecisionDto } from "../dto/client-decision.dto";

@ApiTags("Public / Shortlists")
@Controller("public/shortlists")
export class PublicShortlistsController {
  constructor(private readonly shortlistsService: ShortlistsService) {}

  @Get("share/:token")
  @ApiOperation({ summary: "Access a published shortlist via secure link (FR-SEC-01 strictly anonymised)" })
  async findByShareToken(@Param("token") token: string) {
    return this.shortlistsService.findPublicShortlistByToken(token);
  }

  @Post("share/:token/items/:talentId/decision")
  @ApiOperation({ summary: "Record decision on a shortlisted talent via share link" })
  async recordDecisionByToken(
    @Param("token") token: string,
    @Param("talentId") talentId: string,
    @Body() dto: ShortlistClientDecisionDto,
  ) {
    return this.shortlistsService.recordPublicDecision(token, talentId, dto);
  }
}

