import { Module } from "@nestjs/common";
import { AuditDashboardController } from "./controllers/audit-dashboard.controller";
import { AuditDashboardService } from "./audit-dashboard.service";

@Module({
  controllers: [AuditDashboardController],
  providers: [AuditDashboardService],
  exports: [AuditDashboardService],
})
export class AuditDashboardModule {}
