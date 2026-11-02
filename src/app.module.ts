import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { DatabaseModule } from "./infrastructure/database/database.module";
import { AccessTokenGuard } from "./common/guards/access-token.guard";
import { AppFeatureModule } from "./modules/app/app.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ResourcesModule } from "./modules/resources/resources.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [DatabaseModule, AppFeatureModule, AuthModule, UsersModule, ResourcesModule],
  providers: [{ provide: APP_GUARD, useClass: AccessTokenGuard }],
})
export class AppModule {}
