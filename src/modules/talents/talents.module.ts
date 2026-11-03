import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AdminTalentsController } from "./controllers/admin-talents.controller";
import { TalentsController } from "./controllers/talents.controller";
import { TalentsService } from "./talents.service";

@Module({
  imports: [PrismaModule],
  controllers: [AdminTalentsController, TalentsController],
  providers: [TalentsService],
  exports: [TalentsService],
})
export class TalentsModule {}
