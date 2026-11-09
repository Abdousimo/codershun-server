import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { Public } from "../../../common/decorators/public.decorator";
import { TalentsService } from "../talents.service";
import { QueryShowcaseDto } from "../dto/query-talents.dto";
import { TalentShowcaseResponseDto } from "../dto/talent-response.dto";

@ApiTags("Talents (Public Showcase)")
@Controller("talents")
export class TalentsController {
  constructor(@Inject(TalentsService) private readonly talentsService: TalentsService) {}

  @Public()
  @Get("showcase")
  @ApiOperation({
    summary: "Browse anonymised vetted talents showcase (FR-TAL-04, FR-SEC-01)",
  })
  @ApiResponse({ status: 200, type: [TalentShowcaseResponseDto] })
  async getPublicShowcase(@Query() query: QueryShowcaseDto) {
    return this.talentsService.getPublicShowcase(query);
  }
}

