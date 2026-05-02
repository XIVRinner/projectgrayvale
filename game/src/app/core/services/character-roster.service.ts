import { Injectable, computed, signal } from "@angular/core";
import { applyDeltas, type Delta, type Player } from "@rinner/grayvale-core";

import { safeParsePlayer } from "../validation/core-runtime-validation";
import {
  cloneSaveSlotWorldState,
  DEFAULT_SAVE_SLOT_WORLD_STATE,
  type SaveSlotWorldState
} from "./world-state.models";
import { type SaveSlotHealthState } from "./health-balance";

const STORAGE_KEY = "grayvale:save-slots:v1";
const VITALITY_ATTRIBUTE_ID = "vitality";

export interface CharacterStatUnlockState {
  readonly attributes: Readonly<Record<string, boolean>>;
  readonly skills: Readonly<Record<string, boolean>>;
}

export interface CharacterSaveSlot {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly player: Player;
  readonly statUnlocks: CharacterStatUnlockState;
  readonly world: SaveSlotWorldState;
  readonly health?: SaveSlotHealthState;
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
  readonly activeWorld = computed(() => this.activeSlot()?.world ?? null);
  readonly activeHealth = computed(() => this.activeSlot()?.health ?? null);

  constructor() {
    this.hydrate();
  }

  createCharacter(
    player: Player,
    health: SaveSlotHealthState | undefined = undefined
  ): CharacterSaveSlot {
    const nowIso = new Date().toISOString();
    const seededPlayer = seedNewCharacter(player);
    const statUnlocks = buildDefaultStatUnlocks(seededPlayer);
    const nextSlot = {
      id: buildNextSlotId(this.slotsState()),
      createdAt: nowIso,
      updatedAt: nowIso,
      player: seededPlayer,
      statUnlocks,
      world: cloneSaveSlotWorldState(),
      health: cloneHealthState(health)
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

  applyActiveCharacterDeltas(deltas: readonly Delta[]): CharacterSaveSlot | null {
    if (deltas.length === 0) {
      return this.activeSlot();
    }

    return this.updateActiveSlot((slot) => ({
      ...slot,
      player: applyDeltas(
        {
          player: slot.player,
          npcs: {}
        },
        [...deltas]
      ).player
    }));
  }

  updateActiveWorld(world: SaveSlotWorldState): CharacterSaveSlot | null {
    return this.updateActiveSlot((slot) => ({
      ...slot,
      world: cloneSaveSlotWorldState(world)
    }));
  }

  updateActiveHealth(health: SaveSlotHealthState): CharacterSaveSlot | null {
    return this.updateActiveSlot((slot) => ({
      ...slot,
      health: cloneHealthState(health)
    }));
  }

  setActiveAttributeUnlocked(
    attributeId: string,
    unlocked: boolean
  ): CharacterSaveSlot | null {
    return this.updateActiveSlot((slot) => ({
      ...slot,
      statUnlocks: {
        ...slot.statUnlocks,
        attributes: {
          ...slot.statUnlocks.attributes,
          [attributeId]: unlocked
        }
      }
    }));
  }

  setActiveSkillUnlocked(skillId: string, unlocked: boolean): CharacterSaveSlot | null {
    return this.updateActiveSlot((slot) => ({
      ...slot,
      statUnlocks: {
        ...slot.statUnlocks,
        skills: {
          ...slot.statUnlocks.skills,
          [skillId]: unlocked
        }
      }
    }));
  }

  applyActiveCharacterAndWorldUpdate(
    deltas: readonly Delta[],
    world: SaveSlotWorldState
  ): CharacterSaveSlot | null {
    return this.updateActiveSlot((slot) => ({
      ...slot,
      player: deltas.length
        ? applyDeltas(
            {
              player: slot.player,
              npcs: {}
            },
            [...deltas]
          ).player
        : slot.player,
      world: cloneSaveSlotWorldState(world)
    }));
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

  private updateActiveSlot(
    updater: (slot: CharacterSaveSlot) => CharacterSaveSlot
  ): CharacterSaveSlot | null {
    const activeSlotId = this.activeSlotIdState();

    if (!activeSlotId) {
      return null;
    }

    let nextActiveSlot: CharacterSaveSlot | null = null;

    this.slotsState.update((slots) =>
      slots.map((slot) => {
        if (slot.id !== activeSlotId) {
          return slot;
        }

        const updatedSlot = updater(slot);
        nextActiveSlot = {
          ...updatedSlot,
          updatedAt: new Date().toISOString()
        };

        return nextActiveSlot;
      })
    );

    if (!nextActiveSlot) {
      return null;
    }

    this.persist();
    return nextActiveSlot;
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

  if (playerResult.success === false) {
    throw new Error(
      `slots[${index}].player failed validation: ${playerResult.error}`
    );
  }

  return {
    id,
    createdAt,
    updatedAt,
    player: playerResult.data,
    statUnlocks: parseStatUnlocks(record["statUnlocks"], `slots[${index}].statUnlocks`, playerResult.data),
    world: parseWorldState(record["world"], `slots[${index}].world`),
    health: parseHealthState(record["health"], `slots[${index}].health`)
  };
}

function parseStatUnlocks(
  raw: unknown,
  label: string,
  player: Player
): CharacterStatUnlockState {
  const fallback = buildDefaultStatUnlocks(player);

  if (raw === undefined) {
    return fallback;
  }

  const record = ensureRecord(raw, label);

  return {
    attributes: {
      ...fallback.attributes,
      ...parseBooleanRecord(record["attributes"], `${label}.attributes`)
    },
    skills: {
      ...fallback.skills,
      ...parseBooleanRecord(record["skills"], `${label}.skills`)
    }
  };
}

function parseWorldState(raw: unknown, label: string): SaveSlotWorldState {
  if (raw === undefined) {
    return cloneSaveSlotWorldState(DEFAULT_SAVE_SLOT_WORLD_STATE);
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${label} must be an object.`);
  }

  const record = raw as Record<string, unknown>;

  return {
    currentLocation: ensureString(record["currentLocation"], `${label}.currentLocation`),
    sublocations: ensureStringArray(record["sublocations"], `${label}.sublocations`)
  };
}

function parseHealthState(raw: unknown, label: string): SaveSlotHealthState | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${label} must be an object.`);
  }

  const record = raw as Record<string, unknown>;

  return {
    currentHp: ensureNumber(record["currentHp"], `${label}.currentHp`),
    maxHp: ensureNumber(record["maxHp"], `${label}.maxHp`)
  };
}

function ensureString(raw: unknown, label: string): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return raw;
}

function ensureRecord(raw: unknown, label: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${label} must be an object.`);
  }

  return raw as Record<string, unknown>;
}

function ensureStringArray(raw: unknown, label: string): string[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array.`);
  }

  return raw.map((entry, index) => ensureString(entry, `${label}[${index}]`));
}

function ensureNumber(raw: unknown, label: string): number {
  if (typeof raw !== "number" || Number.isNaN(raw)) {
    throw new Error(`${label} must be a number.`);
  }

  return raw;
}

function parseBooleanRecord(raw: unknown, label: string): Record<string, boolean> {
  const record = ensureRecord(raw, label);
  const result: Record<string, boolean> = {};

  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== "boolean") {
      throw new Error(`${label}.${key} must be a boolean.`);
    }

    result[key] = value;
  }

  return result;
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

function seedNewCharacter(player: Player): Player {
  return {
    ...player,
    story: player.story ?? {
      currentArcId: "prologue",
      currentChapter: 1
    },
    activityState: {
      availability: {
        ...(player.activityState?.availability ?? {})
      },
      activeActivityId:
        player.activityState?.activeActivityId ?? null
    }
  };
}

function buildDefaultStatUnlocks(player: Player): CharacterStatUnlockState {
  const attributes = Object.fromEntries(
    Object.keys(player.attributes).map((attributeId) => [
      attributeId,
      attributeId === VITALITY_ATTRIBUTE_ID
    ])
  );
  const skills = Object.fromEntries(
    Object.keys(player.skills).map((skillId) => [skillId, false])
  );

  return {
    attributes,
    skills
  };
}

function cloneHealthState(
  health: SaveSlotHealthState | undefined
): SaveSlotHealthState | undefined {
  if (!health) {
    return undefined;
  }

  return {
    currentHp: health.currentHp,
    maxHp: health.maxHp
  };
}
