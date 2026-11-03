var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../../modules/auth/auth.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
let AccessTokenGuard = class AccessTokenGuard {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    async canActivate(context) {
        const handler = context.getHandler();
        const controller = context.getClass();
        const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, handler) ??
            Reflect.getMetadata(IS_PUBLIC_KEY, controller);
        if (isPublic)
            return true;
        const request = context.switchToHttp().getRequest();
        const header = request.headers.authorization;
        if (!header?.startsWith("Bearer ")) {
            throw new UnauthorizedException("Bearer access token is required");
        }
        request.user = await this.authService.verifyAccessToken(header.slice(7));
        return true;
    }
};
AccessTokenGuard = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [AuthService])
], AccessTokenGuard);
export { AccessTokenGuard };
