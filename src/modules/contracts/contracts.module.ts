import { Module } from "@nestjs/common";
import { FilesModule } from "../files/files.module";
import { ContractsService } from "./contracts.service";
import { AdminContractsController } from "./controllers/admin-contracts.controller";
import { TalentContractsController } from "./controllers/talent-contracts.controller";
import { ClientContractsController } from "./controllers/client-contracts.controller";

@Module({
  imports: [FilesModule],
  controllers: [
    AdminContractsController,
    ClientContractsController,
    TalentContractsController,
  ],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
