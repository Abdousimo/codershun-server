import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { Readable } from "node:stream";

import type { IStorageService } from "./storage.interface";

@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly baseDir: string;
  private readonly secret: string;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    const uploadDir = configService.get<string>("storage.uploadDir") || "uploads";
    this.baseDir = path.resolve(process.cwd(), uploadDir);
    this.secret = configService.get<string>("auth.secret") || "codershub-local-secret";

    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async upload(key: string, buffer: Buffer): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await fs.promises.writeFile(filePath, buffer);
  }

  async getSignedDownloadUrl(fileId: string, originalName: string, expiresInSeconds: number = 900): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signature = this.generateSignature(fileId, expires);
    const encodedName = encodeURIComponent(originalName);
    return `/api/v1/files/${fileId}/download?expires=${expires}&sig=${signature}&name=${encodedName}`;
  }

  async getStream(key: string): Promise<Readable> {
    const filePath = path.join(this.baseDir, key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Local file not found on disk: ${key}`);
    }
    return fs.createReadStream(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  verifySignature(fileId: string, expires: number, signature: string): boolean {
    if (Math.floor(Date.now() / 1000) > expires) {
      return false;
    }
    const expected = this.generateSignature(fileId, expires);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  private generateSignature(fileId: string, expires: number): string {
    return crypto
      .createHmac("sha256", this.secret)
      .update(`${fileId}:${expires}`)
      .digest("hex");
  }
}
