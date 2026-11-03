import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { FilesController, AdminFilesController } from "./files.controller";
import { FilesService } from "./files.service";
import { STORAGE_SERVICE_TOKEN } from "./storage/storage.interface";
import { LocalStorageService } from "./storage/local-storage.service";

@Module({
  imports: [PrismaModule],
  controllers: [FilesController, AdminFilesController],
  providers: [
    FilesService,
    LocalStorageService,
    {
      provide: STORAGE_SERVICE_TOKEN,
      useExisting: LocalStorageService,
    },
  ],
  exports: [FilesService, STORAGE_SERVICE_TOKEN, LocalStorageService],
})
export class FilesModule {}
