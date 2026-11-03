import { Module } from "@nestjs/common";
import { FilesModule } from "../files/files.module";
import { InvoicesService } from "./invoices.service";
import { AdminInvoicesController } from "./controllers/admin-invoices.controller";

@Module({
  imports: [FilesModule],
  controllers: [AdminInvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
