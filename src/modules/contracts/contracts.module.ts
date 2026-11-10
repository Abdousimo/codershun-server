import { Module } from "@nestjs/common";
import { FilesModule } from "../files/files.module";
import { ContractsService } from "./contracts.service";
import { AdminContractsController } from "./controllers/admin-contracts.controller";
import { TalentContractsController } from "./controllers/talent-contracts.controller";

@Module({
  imports: [FilesModule],
  controllers: [AdminContractsController, TalentContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
