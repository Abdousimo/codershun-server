import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { SettingsModule } from "../settings/settings.module";
import { FilesModule } from "../files/files.module";
import { PublicFormsController } from "./public-forms.controller";
import { PublicFormsService } from "./public-forms.service";

@Module({
  imports: [PrismaModule, SettingsModule, FilesModule],
  controllers: [PublicFormsController],
  providers: [PublicFormsService],
  exports: [PublicFormsService],
})
export class PublicFormsModule {}

