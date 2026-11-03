import { Module } from "@nestjs/common";
import { ReferralsService } from "./referrals.service";
import { AdminReferralsController } from "./controllers/admin-referrals.controller";

@Module({
  controllers: [AdminReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
