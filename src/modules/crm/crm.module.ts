import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { LeadsController } from "./controllers/leads.controller";
import { CompaniesController } from "./controllers/companies.controller";
import { CrmTimelineController } from "./controllers/crm-timeline.controller";
import { ClientDashboardController } from "./controllers/client-dashboard.controller";
import { ClientWorkspaceController } from "./controllers/client-workspace.controller";
import { CrmService } from "./crm.service";

@Module({
  imports: [PrismaModule],
  controllers: [
    LeadsController,
    CompaniesController,
    CrmTimelineController,
    ClientDashboardController,
    ClientWorkspaceController,
  ],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}

