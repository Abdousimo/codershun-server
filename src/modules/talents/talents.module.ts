import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { FilesModule } from "../files/files.module";
import { AdminTalentsController } from "./controllers/admin-talents.controller";
import { TalentsController } from "./controllers/talents.controller";
import { TalentDashboardController } from "./controllers/talent-dashboard.controller";
import { TalentInterviewsController } from "./controllers/talent-interviews.controller";
import { TalentsService } from "./talents.service";

@Module({
  imports: [PrismaModule, FilesModule],
  controllers: [
    AdminTalentsController,
    TalentsController,
    TalentDashboardController,
    TalentInterviewsController,
  ],
  providers: [TalentsService],
  exports: [TalentsService],
})
export class TalentsModule {}

