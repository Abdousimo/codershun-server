import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ShortlistsService } from "../shortlists.service";

@ApiTags("Public / Shortlists")
@Controller("public/shortlists")
export class PublicShortlistsController {
  constructor(private readonly shortlistsService: ShortlistsService) {}

  @Get("share/:token")
  @ApiOperation({ summary: "Access a published shortlist via secure link (FR-SEC-01 strictly anonymised)" })
  async findByShareToken(@Param("token") token: string) {
    return this.shortlistsService.findPublicShortlistByToken(token);
  }
}

