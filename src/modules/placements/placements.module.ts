import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { PlacementsService } from "./placements.service";
import { PlacementReviewsService } from "./placement-reviews.service";
import { PlacementOnboardingService } from "./placement-onboarding.service";
import { AdminPlacementsController } from "./controllers/admin-placements.controller";
import { ClientPlacementsController } from "./controllers/client-placements.controller";
import { TalentPlacementsController } from "./controllers/talent-placements.controller";

@Module({
  imports: [SettingsModule],
  controllers: [
    AdminPlacementsController,
    ClientPlacementsController,
    TalentPlacementsController,
  ],
  providers: [
    PlacementsService,
    PlacementReviewsService,
    PlacementOnboardingService,
  ],
  exports: [
    PlacementsService,
    PlacementReviewsService,
    PlacementOnboardingService,
  ],
})
export class PlacementsModule {}
