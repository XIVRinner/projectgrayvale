import { Injectable, computed, signal } from "@angular/core";
import { type Player } from "@rinner/grayvale-core";

import { safeParsePlayer } from "../validation/core-runtime-validation";

const STORAGE_KEY = "grayvale:save-slots:v1";

export interface CharacterSaveSlot {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly player: Player;
}

interface PersistedRoster {
  readonly activeSlotId: string | null;
  readonly slots: readonly CharacterSaveSlot[];
}

@Injectable({ providedIn: "root" })
export class CharacterRosterService {
  private readonly slotsState = signal<readonly CharacterSaveSlot[]>([]);
  private readonly activeSlotIdState = signal<string | null>(null);

  readonly slots = this.slotsState.asReadonly();
  readonly activeSlotId = this.activeSlotIdState.asReadonly();

  readonly activeSlot = computed(() => {
    const activeId = this.activeSlotIdState();

    if (!activeId) {
      return null;
    }

    return this.slotsState().find((slot) => slot.id === activeId) ?? null;
  });

  readonly activeCharacter = computed(() => this.activeSlot()?.player ?? null);

  constructor() {
    this.hydrate();
  }

  createCharacter(player: Player): CharacterSaveSlot {
    const nowIso = new Date().toISOString();
    const nextSlot = {
      id: buildNextSlotId(this.slotsState()),
      createdAt: nowIso,
      updatedAt: nowIso,
      player
    } satisfies CharacterSaveSlot;

    this.slotsState.update((slots) => [...slots, nextSlot]);
    this.activeSlotIdState.set(nextSlot.id);
    this.persist();

    return nextSlot;
  }

  setActiveSlot(slotId: string): void {
    if (!this.slotsState().some((slot) => slot.id === slotId)) {
      return;
    }

    this.activeSlotIdState.set(slotId);
    this.persist();
  }

  deleteSlot(slotId: string): boolean {
    const currentSlots = this.slotsState();

    if (!currentSlots.some((slot) => slot.id === slotId)) {
      return false;
    }

    const nextSlots = currentSlots.filter((slot) => slot.id !== slotId);
    this.slotsState.set(nextSlots);

    if (this.activeSlotIdState() === slotId) {
      this.activeSlotIdState.set(nextSlots[0]?.id ?? null);
    }

    this.persist();
    return true;
  }

  resetAll(): void {
    this.slotsState.set([]);
    this.activeSlotIdState.set(null);
    this.persist();
  }

  exportAll(): string {
    const payload: PersistedRoster = {
      activeSlotId: this.activeSlotIdState(),
      slots: this.slotsState()
    };

    return JSON.stringify(payload, null, 2);
  }

  exportSlot(slotId: string): string | null {
    const slot = this.slotsState().find((entry) => entry.id === slotId);

    if (!slot) {
      return null;
    }

    return JSON.stringify(slot, null, 2);
  }

  importRoster(serializedPayload: string): number {
    const parsed = JSON.parse(serializedPayload) as unknown;
    const roster = parsePersistedRoster(parsed);

    this.slotsState.set(roster.slots);
    this.activeSlotIdState.set(roster.activeSlotId);
    this.persist();

    return roster.slots.length;
  }

  private hydrate(): void {
    try {
      const rawValue = localStorage.getItem(STORAGE_KEY);

      if (!rawValue) {
        return;
      }

      const parsed = parsePersistedRoster(JSON.parse(rawValue) as unknown);
      this.slotsState.set(parsed.slots);
      this.activeSlotIdState.set(parsed.activeSlotId);
    } catch {
      // Ignore invalid local storage content and keep empty defaults.
    }
  }

  private persist(): void {
    const payload: PersistedRoster = {
      activeSlotId: this.activeSlotIdState(),
      slots: this.slotsState()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }
}

function parsePersistedRoster(raw: unknown): PersistedRoster {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Save roster payload must be an object.");
  }

  const record = raw as Record<string, unknown>;

  if (!Array.isArray(record["slots"])) {
    throw new Error("Save roster payload must include a slots array.");
  }

  const slots = record["slots"].map((entry, index) => parseSlot(entry, index));
  const activeSlotIdRaw = record["activeSlotId"];
  const activeSlotId =
    typeof activeSlotIdRaw === "string" && slots.some((slot) => slot.id === activeSlotIdRaw)
      ? activeSlotIdRaw
      : slots[0]?.id ?? null;

  return {
    activeSlotId,
    slots
  };
}

function parseSlot(raw: unknown, index: number): CharacterSaveSlot {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`Save slot at index ${index} must be an object.`);
  }

  const record = raw as Record<string, unknown>;
  const id = ensureString(record["id"], `slots[${index}].id`);
  const createdAt = ensureString(record["createdAt"], `slots[${index}].createdAt`);
  const updatedAt = ensureString(record["updatedAt"], `slots[${index}].updatedAt`);
  const playerResult = safeParsePlayer(record["player"]);

  if (!playerResult.success) {
    throw new Error(
      `slots[${index}].player failed validation: ${playerResult.error}`
    );
  }

  return {
    id,
    createdAt,
    updatedAt,
    player: playerResult.data
  };
}

function ensureString(raw: unknown, label: string): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return raw;
}

function buildNextSlotId(slots: readonly CharacterSaveSlot[]): string {
  const maxSlotNumber = slots.reduce((maxValue, slot) => {
    const parsed = Number(slot.id.replace(/^slot_/, ""));

    if (!Number.isInteger(parsed)) {
      return maxValue;
    }

    return Math.max(maxValue, parsed);
  }, 0);

  return `slot_${maxSlotNumber + 1}`;
}
