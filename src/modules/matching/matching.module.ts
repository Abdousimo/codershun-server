import { Module } from "@nestjs/common";
import { SettingsModule } from "../settings/settings.module";
import { TalentRequestsService } from "./talent-requests.service";
import { MatchingService } from "./matching.service";
import { ShortlistsService } from "./shortlists.service";
import { AdminTalentRequestsController } from "./controllers/admin-talent-requests.controller";
import { AdminShortlistsController } from "./controllers/admin-shortlists.controller";
import { ClientTalentRequestsController } from "./controllers/client-talent-requests.controller";
import { ClientShortlistsController } from "./controllers/client-shortlists.controller";
import { PublicShortlistsController } from "./controllers/public-shortlists.controller";

@Module({
  imports: [SettingsModule],
  controllers: [
    AdminTalentRequestsController,
    AdminShortlistsController,
    ClientTalentRequestsController,
    ClientShortlistsController,
    PublicShortlistsController,
  ],
  providers: [
    TalentRequestsService,
    MatchingService,
    ShortlistsService,
  ],
  exports: [
    TalentRequestsService,
    MatchingService,
    ShortlistsService,
  ],
})
export class MatchingModule {}
