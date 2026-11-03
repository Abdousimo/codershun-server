import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./controllers/notifications.controller";
import { AdminNotificationsController } from "./controllers/admin-notifications.controller";

@Module({
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
