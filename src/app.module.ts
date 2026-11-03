import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";

import { PrismaModule } from "./prisma/prisma.module";
import { AccessTokenGuard } from "./common/guards/access-token.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { PrismaExceptionFilter } from "./common/filters/prisma-exception.filter";
import configuration from "./config/configuration";
import { validateEnv } from "./config/env.validation";
import { AppFeatureModule } from "./modules/app/app.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { UsersModule } from "./modules/users/users.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { FilesModule } from "./modules/files/files.module";
import { CrmModule } from "./modules/crm/crm.module";
import { PublicFormsModule } from "./modules/public-forms/public-forms.module";
import { TalentsModule } from "./modules/talents/talents.module";
import { MatchingModule } from "./modules/matching/matching.module";
import { PlacementsModule } from "./modules/placements/placements.module";
import { ContractsModule } from "./modules/contracts/contracts.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { PayoutsModule } from "./modules/payouts/payouts.module";
import { ReferralsModule } from "./modules/referrals/referrals.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AuditDashboardModule } from "./modules/audit-dashboard/audit-dashboard.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    AppFeatureModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    FilesModule,
    CrmModule,
    PublicFormsModule,
    TalentsModule,
    MatchingModule,
    PlacementsModule,
    ContractsModule,
    InvoicesModule,
    PayoutsModule,
    ReferralsModule,
    NotificationsModule,
    AuditDashboardModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
