import {
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";

import { Public } from "../../common/decorators/public.decorator";
import { PublicFormsService } from "./public-forms.service";
import { PublicHireRequestDto } from "./dto/hire-request.dto";
import { PublicTalentApplicationDto } from "./dto/talent-application.dto";
import { PublicContactFormDto } from "./dto/contact-form.dto";
import { PublicReferrerSignupDto } from "./dto/referrer-signup.dto";
import {
  HireRequestResponseDto,
  ReferrerSignupResponseDto,
  TalentApplicationResponseDto,
} from "./dto/public-form-response.dto";
import type { UploadedMulterFile } from "../files/files.controller";

@ApiTags("Public Forms")
@Public()
@Controller("public")
export class PublicFormsController {
  constructor(private readonly formsService: PublicFormsService) {}

  @Post("hire-requests")
  @ApiOperation({
    summary: "Public client hire request (calculates indicative pricing & creates lead + request)",
  })
  @ApiResponse({ status: 201, type: HireRequestResponseDto })
  async submitHireRequest(
    @Body() dto: PublicHireRequestDto,
    @Req() req: Request,
  ): Promise<HireRequestResponseDto> {
    const clientIp = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];
    return this.formsService.submitHireRequest(dto, clientIp, userAgent);
  }

  @Post("talent-applications")
  @ApiOperation({
    summary: "Public talent application form (creates candidate profile with CV upload)",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        cv: { type: "string", format: "binary" },
        firstName: { type: "string", example: "Amine" },
        lastName: { type: "string", example: "Bensalem" },
        email: { type: "string", example: "amine@example.com" },
        expectedNetPay: { type: "string", example: "2000.00" },
        privacyPolicyAccepted: { type: "boolean", example: true },
      },
      required: ["firstName", "lastName", "email", "expectedNetPay", "privacyPolicyAccepted"],
    },
  })
  @ApiResponse({ status: 201, type: TalentApplicationResponseDto })
  @UseInterceptors(FileInterceptor("cv"))
  async submitTalentApplication(
    @Body() dto: PublicTalentApplicationDto,
    @UploadedFile() cv: UploadedMulterFile | undefined,
    @Req() req: Request,
  ): Promise<TalentApplicationResponseDto> {
    const clientIp = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];
    return this.formsService.submitTalentApplication(dto, cv, clientIp, userAgent);
  }

  @Post("contact")
  @ApiOperation({ summary: "Public general contact inquiry" })
  async submitContact(
    @Body() dto: PublicContactFormDto,
    @Req() req: Request,
  ) {
    const clientIp = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];
    return this.formsService.submitContactForm(dto, clientIp, userAgent);
  }

  @Post("referrers")
  @ApiOperation({ summary: "Public referral partner signup" })
  @ApiResponse({ status: 201, type: ReferrerSignupResponseDto })
  async submitReferrerSignup(
    @Body() dto: PublicReferrerSignupDto,
    @Req() req: Request,
  ): Promise<ReferrerSignupResponseDto> {
    const clientIp = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];
    return this.formsService.submitReferrerSignup(dto, clientIp, userAgent);
  }
}

