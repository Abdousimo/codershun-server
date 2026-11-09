import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";

import { UserRole } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../../common/guards/access-token.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { FilesService } from "./files.service";
import {
  FileCategory,
  UpdateScanStatusDto,
} from "./dto/upload-file.dto";
import {
  FileResponseDto,
} from "./dto/file-response.dto";

export interface UploadedMulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags("Files")
@Controller("files")
export class FilesController {
  constructor(@Inject(FilesService) private readonly filesService: FilesService) {}

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Post("upload")
  @ApiOperation({ summary: "Upload file directly to VPS uploads directory (CV <= 5 MB, documents <= 20 MB)" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        category: { type: "string", enum: Object.values(FileCategory), default: FileCategory.DOCUMENT },
      },
    },
  })
  @ApiResponse({ status: 201, type: FileResponseDto })
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile(
    @UploadedFile() file: UploadedMulterFile | undefined,
    @Query("category") queryCategory?: FileCategory,
    @Body("category") bodyCategory?: FileCategory,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<FileResponseDto> {
    if (!file) {
      throw new BadRequestException("No file provided in 'file' field");
    }

    const category = queryCategory || bodyCategory || FileCategory.DOCUMENT;
    return this.filesService.uploadFile(file, category, user);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Get(":id")
  @ApiOperation({ summary: "Get file metadata" })
  @ApiResponse({ status: 200, type: FileResponseDto })
  async getFile(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FileResponseDto> {
    const file = await this.filesService.getFileById(id, user);
    return this.filesService.mapToFileResponse(file);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Get(":id/download-url")
  @ApiOperation({ summary: "Get time-limited signed download URL" })
  async getDownloadUrl(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.filesService.getDownloadUrl(id, user);
  }

  @Public()
  @Get(":id/download")
  @ApiOperation({ summary: "Download / stream file directly from local VPS uploads folder" })
  async downloadFile(
    @Param("id") id: string,
    @Query("expires") expires: string,
    @Query("sig") sig: string,
    @Res() res: Response,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const { stream, file } = await this.filesService.getFileStream(id, user, { expires, sig });

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    );
    res.setHeader("Content-Length", file.sizeBytes);

    stream.pipe(res);
  }
}

@ApiTags("Admin Files")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.super_admin)
@Controller("admin/files")
export class AdminFilesController {
  constructor(@Inject(FilesService) private readonly filesService: FilesService) {}

  @Patch(":id/virus-scan")
  @ApiOperation({ summary: "Update virus scan status (Super Admin)" })
  @ApiResponse({ status: 200, type: FileResponseDto })
  async updateScanStatus(
    @Param("id") id: string,
    @Body() dto: UpdateScanStatusDto,
  ): Promise<FileResponseDto> {
    return this.filesService.updateScanStatus(id, dto.status);
  }
}
