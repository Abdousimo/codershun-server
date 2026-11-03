import { Module } from "@nestjs/common";
import { FilesModule } from "../files/files.module";
import { ContractsService } from "./contracts.service";
import { AdminContractsController } from "./controllers/admin-contracts.controller";

@Module({
  imports: [FilesModule],
  controllers: [AdminContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
