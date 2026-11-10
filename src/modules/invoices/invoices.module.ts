import { Module } from "@nestjs/common";
import { FilesModule } from "../files/files.module";
import { MailModule } from "../mail/mail.module";
import { InvoicesService } from "./invoices.service";
import { AdminInvoicesController } from "./controllers/admin-invoices.controller";
import { ClientInvoicesController } from "./controllers/client-invoices.controller";

@Module({
  imports: [FilesModule, MailModule],
  controllers: [AdminInvoicesController, ClientInvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
