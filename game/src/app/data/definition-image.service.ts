import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { assetApiPath, assetInfoApiPath, type DefinitionApiType } from "./api-paths";
import { IMAGE_STORE_NAME, openGrayvaleIndexedDb } from "./grayvale-indexed-db";

export interface CachedImageRecord {
  readonly key: string;
  readonly assetType: DefinitionApiType;
  readonly assetId: string;
  readonly hash: string;
  readonly contentType: string;
  readonly blob: Blob;
  readonly cachedAt: string;
}

interface AssetInfoResponse {
  readonly id: string;
  readonly hash: string;
  readonly contentType: string;
  readonly updatedAt: string;
}

@Injectable({ providedIn: "root" })
export class DefinitionImageService {
  private readonly http = inject(HttpClient);

  private readonly objectUrls = new Map<string, string>();
  private readonly memoryCache = new Map<string, CachedImageRecord>();

  async getImageUrl(type: DefinitionApiType, assetId: string | null | undefined): Promise<string> {
    const normalizedAssetId = assetId?.trim();

    if (!normalizedAssetId) {
      return "assets/images/no-texture.svg";
    }

    const key = toImageCacheKey(type, normalizedAssetId);
    const cached = await this.readCachedImage(type, normalizedAssetId);
    const info = await this.fetchInfo(type, normalizedAssetId);

    if (cached && (!info || cached.hash === info.hash)) {
      return this.toObjectUrl(key, cached.blob);
    }

    try {
      const blob = await firstValueFrom(
        this.http.get(assetApiPath(type, normalizedAssetId), { responseType: "blob" }),
      );
      const record: CachedImageRecord = {
        key,
        assetType: type,
        assetId: normalizedAssetId,
        hash: info?.hash ?? `${Date.now()}`,
        contentType: info?.contentType ?? blob.type ?? "application/octet-stream",
        blob,
        cachedAt: new Date().toISOString(),
      };
      await this.writeCachedImage(record);
      return this.toObjectUrl(key, blob);
    } catch {
      if (cached) {
        return this.toObjectUrl(key, cached.blob);
      }

      return "assets/images/no-texture.svg";
    }
  }

  async invalidateImage(type: DefinitionApiType, assetId: string): Promise<void> {
    const key = toImageCacheKey(type, assetId);
    const existingUrl = this.objectUrls.get(key);

    if (existingUrl) {
      URL.revokeObjectURL(existingUrl);
      this.objectUrls.delete(key);
    }

    this.memoryCache.delete(key);
    const db = await openGrayvaleIndexedDb();

    if (!db) {
      return;
    }

    await new Promise<void>((resolve) => {
      const transaction = db.transaction(IMAGE_STORE_NAME, "readwrite");
      const request = transaction.objectStore(IMAGE_STORE_NAME).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  private async fetchInfo(type: DefinitionApiType, assetId: string): Promise<AssetInfoResponse | null> {
    try {
      return await firstValueFrom(this.http.get<AssetInfoResponse>(assetInfoApiPath(type, assetId)));
    } catch {
      return null;
    }
  }

  private async readCachedImage(
    type: DefinitionApiType,
    assetId: string,
  ): Promise<CachedImageRecord | null> {
    const key = toImageCacheKey(type, assetId);
    const memoryEntry = this.memoryCache.get(key);

    if (memoryEntry) {
      return memoryEntry;
    }

    const db = await openGrayvaleIndexedDb();

    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      const transaction = db.transaction(IMAGE_STORE_NAME, "readonly");
      const request = transaction.objectStore(IMAGE_STORE_NAME).get(key);

      request.onsuccess = () => {
        const record = normalizeCachedImageRecord(request.result);

        if (record) {
          this.memoryCache.set(key, record);
        }

        resolve(record);
      };

      request.onerror = () => resolve(null);
    });
  }

  private async writeCachedImage(record: CachedImageRecord): Promise<void> {
    this.memoryCache.set(record.key, record);
    const previousUrl = this.objectUrls.get(record.key);

    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      this.objectUrls.delete(record.key);
    }

    const db = await openGrayvaleIndexedDb();

    if (!db) {
      return;
    }

    await new Promise<void>((resolve) => {
      const transaction = db.transaction(IMAGE_STORE_NAME, "readwrite");
      const request = transaction.objectStore(IMAGE_STORE_NAME).put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  private toObjectUrl(key: string, blob: Blob): string {
    const existingUrl = this.objectUrls.get(key);

    if (existingUrl) {
      return existingUrl;
    }

    const nextUrl = URL.createObjectURL(blob);
    this.objectUrls.set(key, nextUrl);
    return nextUrl;
  }
}

function normalizeCachedImageRecord(raw: unknown): CachedImageRecord | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;

  if (
    typeof record["key"] !== "string" ||
    typeof record["assetType"] !== "string" ||
    typeof record["assetId"] !== "string" ||
    typeof record["hash"] !== "string" ||
    typeof record["contentType"] !== "string" ||
    typeof record["cachedAt"] !== "string" ||
    !(record["blob"] instanceof Blob)
  ) {
    return null;
  }

  return {
    key: record["key"],
    assetType: record["assetType"] as DefinitionApiType,
    assetId: record["assetId"],
    hash: record["hash"],
    contentType: record["contentType"],
    blob: record["blob"],
    cachedAt: record["cachedAt"],
  };
}

function toImageCacheKey(type: DefinitionApiType, assetId: string): string {
  return `${type}:${assetId}`;
}
