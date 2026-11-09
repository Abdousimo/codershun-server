import { Module } from "@nestjs/common";
import { FilesModule } from "../files/files.module";
import { MailModule } from "../mail/mail.module";
import { InvoicesService } from "./invoices.service";
import { AdminInvoicesController } from "./controllers/admin-invoices.controller";

@Module({
  imports: [FilesModule, MailModule],
  controllers: [AdminInvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
