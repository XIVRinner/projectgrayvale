import { HttpClient, HttpResponse } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom, from, map, of, switchMap, type Observable } from "rxjs";

const CACHE_DB_NAME = "grayvale-api-cache";
const CACHE_STORE_NAME = "responses";
const CACHE_STORAGE_PREFIX = "grayvale:api-cache:v1:";
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const HOT_DATA_TTL_MS = 15 * 60 * 1000;
const DEV_DEFAULT_TTL_MS = 5 * 1000;
const DEV_HOT_DATA_TTL_MS = 15 * 1000;

interface CachedApiEntry {
  readonly key: string;
  readonly body: unknown;
  readonly cachedAt: number;
  readonly etag?: string;
}

interface ApiCacheRequestOptions {
  readonly cacheKey?: string;
  readonly ttlMs?: number;
}

@Injectable({ providedIn: "root" })
export class GameApiCacheService {
  private readonly http = inject(HttpClient);

  private readonly memoryCache = new Map<string, CachedApiEntry>();
  private readonly inFlightRequests = new Map<string, Promise<unknown>>();
  private indexedDbPromise: Promise<IDBDatabase | null> | null = null;

  getJson<T>(url: string, options: ApiCacheRequestOptions = {}): Observable<T> {
    const cacheKey = options.cacheKey ?? url;
    const ttlMs = options.ttlMs ?? resolveCacheTtl(url);

    return from(this.readCacheEntry(cacheKey)).pipe(
      switchMap((cachedEntry) => {
        if (cachedEntry && isFresh(cachedEntry, ttlMs)) {
          return of(cachedEntry.body as T);
        }

        const existingRequest = this.inFlightRequests.get(cacheKey);

        if (existingRequest) {
          return from(existingRequest as Promise<T>);
        }

        const request = this.fetchAndCache<T>(url, cacheKey, cachedEntry).finally(() => {
          this.inFlightRequests.delete(cacheKey);
        });

        this.inFlightRequests.set(cacheKey, request);
        return from(request);
      })
    );
  }

  getJsonWithFallback<T>(
    urls: readonly string[],
    options: ApiCacheRequestOptions = {}
  ): Observable<T> {
    if (urls.length === 0) {
      throw new Error("GameApiCacheService.getJsonWithFallback requires at least one URL.");
    }

    const cacheKey = options.cacheKey ?? urls[0]!;
    const ttlMs = options.ttlMs ?? resolveCacheTtl(urls[0]!);

    return from(this.readCacheEntry(cacheKey)).pipe(
      switchMap((cachedEntry) => {
        if (cachedEntry && isFresh(cachedEntry, ttlMs)) {
          return of(cachedEntry.body as T);
        }

        const existingRequest = this.inFlightRequests.get(cacheKey);

        if (existingRequest) {
          return from(existingRequest as Promise<T>);
        }

        const request = this.fetchAndCacheFromUrls<T>(urls, cacheKey, cachedEntry).finally(() => {
          this.inFlightRequests.delete(cacheKey);
        });

        this.inFlightRequests.set(cacheKey, request);
        return from(request);
      })
    );
  }

  async clearAll(): Promise<void> {
    this.memoryCache.clear();
    await Promise.all([this.clearIndexedDb(), this.clearLocalStorage()]);
  }

  private async fetchAndCache<T>(
    url: string,
    cacheKey: string,
    cachedEntry: CachedApiEntry | null
  ): Promise<T> {
    try {
      const response = await firstValueFrom(
        this.http.get<unknown>(url, { observe: "response" }).pipe(
          map((httpResponse) => this.extractBody(httpResponse, url))
        )
      );

      const nextEntry: CachedApiEntry = {
        key: cacheKey,
        body: response.body,
        cachedAt: Date.now(),
        etag: response.etag
      };

      await this.writeCacheEntry(nextEntry);
      return response.body as T;
    } catch (error) {
      if (cachedEntry) {
        return cachedEntry.body as T;
      }

      throw error;
    }
  }

  private async fetchAndCacheFromUrls<T>(
    urls: readonly string[],
    cacheKey: string,
    cachedEntry: CachedApiEntry | null
  ): Promise<T> {
    let lastError: unknown = null;

    for (const url of urls) {
      try {
        return await this.fetchAndCache<T>(url, cacheKey, null);
      } catch (error) {
        lastError = error;
      }
    }

    if (cachedEntry) {
      return cachedEntry.body as T;
    }

    throw lastError ?? new Error("All fallback API requests failed.");
  }

  private extractBody(
    response: HttpResponse<unknown>,
    url: string
  ): { readonly body: unknown; readonly etag?: string } {
    if (response.body === null || response.body === undefined) {
      throw new Error(`API cache received an empty response body for "${url}".`);
    }

    return {
      body: response.body,
      etag: response.headers.get("ETag") ?? undefined
    };
  }

  private async readCacheEntry(key: string): Promise<CachedApiEntry | null> {
    const memoryEntry = this.memoryCache.get(key);

    if (memoryEntry) {
      return memoryEntry;
    }

    const indexedDbEntry = await this.readIndexedDbEntry(key);

    if (indexedDbEntry) {
      this.memoryCache.set(key, indexedDbEntry);
      return indexedDbEntry;
    }

    const localStorageEntry = this.readLocalStorageEntry(key);

    if (localStorageEntry) {
      this.memoryCache.set(key, localStorageEntry);
      return localStorageEntry;
    }

    return null;
  }

  private async writeCacheEntry(entry: CachedApiEntry): Promise<void> {
    this.memoryCache.set(entry.key, entry);

    const indexedDbStored = await this.writeIndexedDbEntry(entry);

    if (!indexedDbStored) {
      this.writeLocalStorageEntry(entry);
    }
  }

  private async readIndexedDbEntry(key: string): Promise<CachedApiEntry | null> {
    const db = await this.openIndexedDb();

    if (!db) {
      return null;
    }

    return new Promise((resolve) => {
      const transaction = db.transaction(CACHE_STORE_NAME, "readonly");
      const request = transaction.objectStore(CACHE_STORE_NAME).get(key);

      request.onsuccess = () => {
        resolve(normalizeCachedEntry(request.result));
      };

      request.onerror = () => {
        resolve(null);
      };
    });
  }

  private async writeIndexedDbEntry(entry: CachedApiEntry): Promise<boolean> {
    const db = await this.openIndexedDb();

    if (!db) {
      return false;
    }

    return new Promise((resolve) => {
      const transaction = db.transaction(CACHE_STORE_NAME, "readwrite");
      const request = transaction.objectStore(CACHE_STORE_NAME).put(entry);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    });
  }

  private async clearIndexedDb(): Promise<void> {
    const db = await this.openIndexedDb();

    if (!db) {
      return;
    }

    await new Promise<void>((resolve) => {
      const transaction = db.transaction(CACHE_STORE_NAME, "readwrite");
      const request = transaction.objectStore(CACHE_STORE_NAME).clear();

      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }

  private readLocalStorageEntry(key: string): CachedApiEntry | null {
    if (typeof localStorage === "undefined") {
      return null;
    }

    const rawValue = localStorage.getItem(toStorageKey(key));

    if (!rawValue) {
      return null;
    }

    try {
      return normalizeCachedEntry(JSON.parse(rawValue) as unknown);
    } catch {
      localStorage.removeItem(toStorageKey(key));
      return null;
    }
  }

  private writeLocalStorageEntry(entry: CachedApiEntry): void {
    if (typeof localStorage === "undefined") {
      return;
    }

    try {
      localStorage.setItem(toStorageKey(entry.key), JSON.stringify(entry));
    } catch {
      // Ignore quota and serialization failures. Memory cache still works.
    }
  }

  private async clearLocalStorage(): Promise<void> {
    if (typeof localStorage === "undefined") {
      return;
    }

    const keysToDelete: string[] = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);

      if (key?.startsWith(CACHE_STORAGE_PREFIX)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      localStorage.removeItem(key);
    }
  }

  private async openIndexedDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === "undefined") {
      return null;
    }

    if (!this.indexedDbPromise) {
      this.indexedDbPromise = new Promise((resolve) => {
        const request = indexedDB.open(CACHE_DB_NAME, 1);

        request.onupgradeneeded = () => {
          const db = request.result;

          if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
            db.createObjectStore(CACHE_STORE_NAME, { keyPath: "key" });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      });
    }

    return this.indexedDbPromise;
  }
}

function normalizeCachedEntry(raw: unknown): CachedApiEntry | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;

  if (typeof record["key"] !== "string") {
    return null;
  }

  if (typeof record["cachedAt"] !== "number" || Number.isNaN(record["cachedAt"])) {
    return null;
  }

  return {
    key: record["key"],
    body: record["body"],
    cachedAt: record["cachedAt"],
    etag: typeof record["etag"] === "string" ? record["etag"] : undefined
  };
}

function isFresh(entry: CachedApiEntry, ttlMs: number): boolean {
  return Date.now() - entry.cachedAt <= ttlMs;
}

function resolveCacheTtl(url: string): number {
  const isLocalDevelopment =
    typeof location !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(location.hostname);
  const hotData = isHotDataUrl(url);

  if (isLocalDevelopment) {
    return hotData ? DEV_HOT_DATA_TTL_MS : DEV_DEFAULT_TTL_MS;
  }

  return hotData ? HOT_DATA_TTL_MS : DEFAULT_TTL_MS;
}

function isHotDataUrl(url: string): boolean {
  return [
    "/api/items",
    "/api/inventory-items",
    "/api/equipment-items",
    "/api/activity-definitions",
    "/api/action-definitions",
    "/api/quests",
    "/api/dialogues",
    "/api/world-locations",
    "/api/data/dialogue-project"
  ].some((segment) => url.includes(segment));
}

function toStorageKey(key: string): string {
  return `${CACHE_STORAGE_PREFIX}${encodeURIComponent(key)}`;
}
