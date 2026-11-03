import { Module } from "@nestjs/common";
import { FilesModule } from "../files/files.module";
import { PayoutsService } from "./payouts.service";
import { AdminPayoutsController } from "./controllers/admin-payouts.controller";

@Module({
  imports: [FilesModule],
  controllers: [AdminPayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
