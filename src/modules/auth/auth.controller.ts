import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Ip, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { Login2faDto } from "./dto/login-2fa.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { MagicLinkRequestDto, MagicLinkVerifyDto } from "./dto/magic-link.dto";
import { ForgotPasswordDto, ResetPasswordDto } from "./dto/password-reset.dto";
import { Enable2faDto, VerifyEmailDto } from "./dto/two-factor.dto";
import {
  AuthSessionResponseDto,
  Require2faResponseDto,
  TwoFactorSetupResponseDto,
} from "./dto/auth-response.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Register a new user account" })
  @ApiResponse({ status: HttpStatus.CREATED, type: AuthSessionResponseDto })
  register(@Body() input: RegisterDto, @Ip() ip: string, @Req() req: Request) {
    const userAgent = req.headers["user-agent"];
    return this.authService.register(input, ip, userAgent);
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Log in with email and password" })
  @ApiResponse({ status: HttpStatus.OK, type: AuthSessionResponseDto })
  @ApiResponse({ status: HttpStatus.OK, type: Require2faResponseDto })
  login(@Body() input: LoginDto, @Ip() ip: string, @Req() req: Request) {
    const userAgent = req.headers["user-agent"];
    return this.authService.login(input, ip, userAgent);
  }

  @Public()
  @Post("login/2fa")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Complete login with TOTP code or recovery code" })
  @ApiResponse({ status: HttpStatus.OK, type: AuthSessionResponseDto })
  login2fa(@Body() input: Login2faDto, @Ip() ip: string, @Req() req: Request) {
    const userAgent = req.headers["user-agent"];
    return this.authService.login2fa(input, ip, userAgent);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rotate refresh token and issue new token pair" })
  @ApiResponse({ status: HttpStatus.OK, type: AuthSessionResponseDto })
  refresh(@Body() input: RefreshTokenDto, @Ip() ip: string, @Req() req: Request) {
    const userAgent = req.headers["user-agent"];
    return this.authService.refresh(input.refreshToken, ip, userAgent);
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke a session refresh token" })
  logout(@Body() input: RefreshTokenDto) {
    return this.authService.logout(input.refreshToken);
  }

  @ApiBearerAuth()
  @Post("logout-all")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke all active sessions for the current user" })
  logoutAll(@CurrentUser("id") userId: string) {
    return this.authService.logoutAll(userId);
  }

  @Public()
  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify user email with single-use token" })
  verifyEmail(@Body() input: VerifyEmailDto) {
    return this.authService.verifyEmail(input.token);
  }

  @Public()
  @Post("magic-link/request")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Request a passwordless magic login link" })
  requestMagicLink(@Body() input: MagicLinkRequestDto) {
    return this.authService.requestMagicLink(input.email);
  }

  @Public()
  @Post("magic-link/verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify magic link and obtain session" })
  @ApiResponse({ status: HttpStatus.OK, type: AuthSessionResponseDto })
  verifyMagicLink(@Body() input: MagicLinkVerifyDto, @Ip() ip: string, @Req() req: Request) {
    const userAgent = req.headers["user-agent"];
    return this.authService.verifyMagicLink(input.token, ip, userAgent);
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Request a password reset email" })
  forgotPassword(@Body() input: ForgotPasswordDto) {
    return this.authService.forgotPassword(input.email);
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset password using a valid reset token" })
  resetPassword(@Body() input: ResetPasswordDto) {
    return this.authService.resetPassword(input);
  }

  @ApiBearerAuth()
  @Post("2fa/generate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Generate TOTP secret and QR code for 2FA setup" })
  @ApiResponse({ status: HttpStatus.OK, type: TwoFactorSetupResponseDto })
  generate2faSecret(@CurrentUser("id") userId: string) {
    return this.authService.generate2faSecret(userId);
  }

  @ApiBearerAuth()
  @Post("2fa/enable")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Verify TOTP code and enable 2FA on account" })
  enable2fa(@CurrentUser("id") userId: string, @Body() input: Enable2faDto) {
    return this.authService.enable2fa(userId, input.code);
  }

  @ApiBearerAuth()
  @Post("2fa/disable")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Disable 2FA on account (blocked for staff)" })
  disable2fa(@CurrentUser("id") userId: string) {
    return this.authService.disable2fa(userId);
  }

  @ApiBearerAuth()
  @Get("me")
  @ApiOperation({ summary: "Get currently authenticated user identity and scopes" })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }
}
