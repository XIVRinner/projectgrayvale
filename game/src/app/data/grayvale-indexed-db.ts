export const GRAYVALE_CACHE_DB_NAME = "grayvale-api-cache";
export const API_RESPONSE_STORE_NAME = "responses";
export const DEFINITION_STORE_NAME = "definitions";
export const IMAGE_STORE_NAME = "images";
export const KNOWN_SERVERS_STORE_NAME = "knownServers";

let indexedDbPromise: Promise<IDBDatabase | null> | null = null;

export function openGrayvaleIndexedDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }

  if (!indexedDbPromise) {
    indexedDbPromise = new Promise((resolve) => {
      const request = indexedDB.open(GRAYVALE_CACHE_DB_NAME, 3);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const oldVersion = event.oldVersion;

        if (!db.objectStoreNames.contains(API_RESPONSE_STORE_NAME)) {
          db.createObjectStore(API_RESPONSE_STORE_NAME, { keyPath: "key" });
        }

        if (!db.objectStoreNames.contains(DEFINITION_STORE_NAME)) {
          const store = db.createObjectStore(DEFINITION_STORE_NAME, { keyPath: "key" });
          store.createIndex("by_type", "type", { unique: false });
        }

        if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
          const store = db.createObjectStore(IMAGE_STORE_NAME, { keyPath: "key" });
          store.createIndex("by_assetType", "assetType", { unique: false });
        }

        // v3: known server profiles cache
        if (oldVersion < 3 && !db.objectStoreNames.contains(KNOWN_SERVERS_STORE_NAME)) {
          db.createObjectStore(KNOWN_SERVERS_STORE_NAME, { keyPath: "serverName" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  }

  return indexedDbPromise;
}
