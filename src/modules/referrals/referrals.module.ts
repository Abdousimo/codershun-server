import { Module } from "@nestjs/common";
import { ReferralsService } from "./referrals.service";
import { AdminReferralsController } from "./controllers/admin-referrals.controller";
import { TalentReferralsController } from "./controllers/talent-referrals.controller";

@Module({
  controllers: [AdminReferralsController, TalentReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
