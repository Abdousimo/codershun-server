import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { LeadsController } from "./controllers/leads.controller";
import { CompaniesController } from "./controllers/companies.controller";
import { CrmTimelineController } from "./controllers/crm-timeline.controller";
import { CrmService } from "./crm.service";

@Module({
  imports: [PrismaModule],
  controllers: [
    LeadsController,
    CompaniesController,
    CrmTimelineController,
  ],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}

