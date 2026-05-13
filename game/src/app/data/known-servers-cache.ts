import { KNOWN_SERVERS_STORE_NAME, openGrayvaleIndexedDb } from "./grayvale-indexed-db";

export interface KnownServerProfile {
  /** Used as the IndexedDB key. */
  readonly serverName: string;
  readonly customContent: boolean;
  readonly profileToken: string;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
}

/**
 * Persist a server profile entry into the local known-servers cache.
 * Updates lastSeenAt and profileToken on each call.
 * If the token changed from what was previously stored, the stored entry
 * will differ — callers can compare to detect token changes.
 */
export async function upsertKnownServerProfile(
  profile: Omit<KnownServerProfile, "firstSeenAt" | "lastSeenAt"> & {
    firstSeenAt?: string;
  },
): Promise<void> {
  const db = await openGrayvaleIndexedDb();

  if (!db) {
    return;
  }

  const now = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(KNOWN_SERVERS_STORE_NAME, "readwrite");
    const store = tx.objectStore(KNOWN_SERVERS_STORE_NAME);
    const getReq = store.get(profile.serverName);

    getReq.onsuccess = () => {
      const existing = getReq.result as KnownServerProfile | undefined;

      const entry: KnownServerProfile = {
        serverName: profile.serverName,
        customContent: profile.customContent,
        profileToken: profile.profileToken,
        firstSeenAt: existing?.firstSeenAt ?? profile.firstSeenAt ?? now,
        lastSeenAt: now,
      };

      const putReq = store.put(entry);
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieve a previously seen server profile from the local cache.
 * Returns null if the server has never been seen before.
 */
export async function getKnownServerProfile(
  serverName: string,
): Promise<KnownServerProfile | null> {
  const db = await openGrayvaleIndexedDb();

  if (!db) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(KNOWN_SERVERS_STORE_NAME, "readonly");
    const store = tx.objectStore(KNOWN_SERVERS_STORE_NAME);
    const req = store.get(serverName);

    req.onsuccess = () => {
      resolve((req.result as KnownServerProfile | undefined) ?? null);
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve all previously seen server profiles from the local cache.
 */
export async function getAllKnownServerProfiles(): Promise<readonly KnownServerProfile[]> {
  const db = await openGrayvaleIndexedDb();

  if (!db) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(KNOWN_SERVERS_STORE_NAME, "readonly");
    const store = tx.objectStore(KNOWN_SERVERS_STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      resolve((req.result as KnownServerProfile[]) ?? []);
    };

    req.onerror = () => reject(req.error);
  });
}
