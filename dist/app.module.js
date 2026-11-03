var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { DatabaseModule } from "./infrastructure/database/database.module";
import { AccessTokenGuard } from "./common/guards/access-token.guard";
import { AppFeatureModule } from "./modules/app/app.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ResourcesModule } from "./modules/resources/resources.module";
import { UsersModule } from "./modules/users/users.module";
let AppModule = class AppModule {
};
AppModule = __decorate([
    Module({
        imports: [DatabaseModule, AppFeatureModule, AuthModule, UsersModule, ResourcesModule],
        providers: [{ provide: APP_GUARD, useClass: AccessTokenGuard }],
    })
], AppModule);
export { AppModule };
