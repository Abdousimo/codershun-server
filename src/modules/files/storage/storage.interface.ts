import type { Readable } from "node:stream";

export const STORAGE_SERVICE_TOKEN = Symbol("STORAGE_SERVICE_TOKEN");

export interface IStorageService {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  getSignedDownloadUrl(fileId: string, originalName: string, expiresInSeconds?: number): Promise<string>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  verifySignature(fileId: string, expires: number, signature: string): boolean;
}
