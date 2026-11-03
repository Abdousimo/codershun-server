import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { PricingService } from "./pricing.service";
import { SettingsService } from "./settings.service";
import { SettingsController } from "./settings.controller";
import { PricingController } from "./pricing.controller";
import { ReferenceDataController } from "./reference-data.controller";

@Module({
  imports: [PrismaModule],
  controllers: [
    SettingsController,
    PricingController,
    ReferenceDataController,
  ],
  providers: [SettingsService, PricingService],
  exports: [SettingsService, PricingService],
})
export class SettingsModule {}

