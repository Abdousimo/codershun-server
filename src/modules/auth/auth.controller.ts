import { Body, Controller, Get, Post, Req } from "@nestjs/common";

import { Public } from "../../common/decorators/public.decorator";
import type { AuthenticatedRequest } from "../../common/types/authenticated-request";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @Public()
  register(@Body() input: RegisterDto) {
    return this.authService.register(input);
  }

  @Post("login")
  @Public()
  login(@Body() input: LoginDto) {
    return this.authService.login(input);
  }

  @Post("refresh")
  @Public()
  refresh(@Body() input: RefreshTokenDto) {
    return this.authService.refresh(input);
  }

  @Post("logout")
  @Public()
  logout(@Body() input: RefreshTokenDto) {
    return this.authService.logout(input.refreshToken);
  }

  @Get("me")
  me(@Req() request: AuthenticatedRequest) {
    return request.user;
  }
}
