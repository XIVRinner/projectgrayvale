import { Injectable, signal } from "@angular/core";

import { generatePlayerUuid } from "../utils/player-uuid";

const STORAGE_KEY = "grayvale:player-profile:v1";
const CHAR_MAP_KEY = "grayvale:character-server-map:v1";

@Injectable({ providedIn: "root" })
export class PlayerIdentityService {
  private readonly profileIdState = signal<string | null>(null);
  private readonly characterMappingsState = signal<Record<string, string>>({});

  readonly profileId = this.profileIdState.asReadonly();

  constructor() {
    this.hydrate();
  }

  ensureProfileId(): string {
    const existing = this.profileIdState();

    if (existing) {
      return existing;
    }

    const nextProfileId = generatePlayerUuid();
    this.profileIdState.set(nextProfileId);
    this.persist();

    return nextProfileId;
  }

  setProfileId(profileId: string): void {
    const normalized = profileId.trim();

    if (!normalized) {
      return;
    }

    this.profileIdState.set(normalized);
    this.persist();
  }

  /** Returns the server-side character UUID mapped to the given local character UUID, or null if unmapped. */
  getServerCharacterId(localCharacterId: string): string | null {
    return this.characterMappingsState()[localCharacterId] ?? null;
  }

  /** Persists a local character UUID → server character UUID mapping. */
  setServerCharacterId(localCharacterId: string, serverCharacterId: string): void {
    this.characterMappingsState.update((map) => ({
      ...map,
      [localCharacterId]: serverCharacterId,
    }));
    this.persistMappings();
  }

  /** Returns the local character UUID mapped to the given server character UUID, or null if unmapped. */
  findLocalCharacterIdByServerCharacterId(serverCharacterId: string): string | null {
    for (const [localCharacterId, mappedServerCharacterId] of Object.entries(
      this.characterMappingsState(),
    )) {
      if (mappedServerCharacterId === serverCharacterId) {
        return localCharacterId;
      }
    }

    return null;
  }

  private hydrate(): void {
    try {
      const rawValue = localStorage.getItem(STORAGE_KEY);

      if (!rawValue) {
        return;
      }

      const parsed = JSON.parse(rawValue) as { profileId?: unknown };
      const profileId =
        typeof parsed.profileId === "string" && parsed.profileId.trim().length > 0
          ? parsed.profileId.trim()
          : null;

      this.profileIdState.set(profileId);
    } catch {
      this.profileIdState.set(null);
    }

    try {
      const rawMap = localStorage.getItem(CHAR_MAP_KEY);

      if (rawMap) {
        const parsed = JSON.parse(rawMap) as unknown;

        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
          const validated: Record<string, string> = {};

          for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof k === "string" && typeof v === "string") {
              validated[k] = v;
            }
          }

          this.characterMappingsState.set(validated);
        }
      }
    } catch {
      // Ignore corrupt mapping data.
    }
  }

  private persist(): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        profileId: this.profileIdState(),
      }),
    );
  }

  private persistMappings(): void {
    localStorage.setItem(CHAR_MAP_KEY, JSON.stringify(this.characterMappingsState()));
  }
}
