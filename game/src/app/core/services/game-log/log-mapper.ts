import type { Delta, DeltaValue, PlayerQuestEntry } from "@rinner/grayvale-core";
import type { WorldUpdateEvent } from "../character-roster.service";
import type { GameQuestEvent } from "../game-quest.types";
import type {
  GameDialogChoiceView,
  GameDialogEvent,
  GameDialogTranscriptEntry
} from "../../../shared/components/game-dialog/game-dialog.types";

export interface GameplayLogChoice {
  readonly index: number;
  readonly label: string;
  readonly seen?: boolean;
}

export type GameLogEntry =
  | { type: "system"; text: string }
  | { type: "quest"; text: string }
  | { type: "combat"; text: string }
  | { type: "loot"; text: string }
  | { type: "dialogue"; text: string }
  | { type: "choice"; options: GameplayLogChoice[] };

export interface StoredGameplayLogEntry {
  readonly entry: GameLogEntry;
  readonly mergeState: GameplayLogMergeState | null;
}

interface GameplayLogMappedEntry {
  readonly entry: GameLogEntry;
  readonly mergeState: GameplayLogMergeState | null;
}

type GameplayLogMergeState =
  | {
      readonly kind: "attribute";
      readonly key: string;
      readonly amount: number;
      readonly label: string;
    }
  | {
      readonly kind: "skill";
      readonly key: string;
      readonly amount: number;
      readonly label: string;
    }
  | {
      readonly kind: "currency";
      readonly key: string;
      readonly amount: number;
      readonly label: string;
    }
  | {
      readonly kind: "item";
      readonly key: string;
      readonly amount: number;
      readonly label: string;
    }
  | {
      readonly kind: "combat-kill";
      readonly key: string;
      readonly amount: number;
      readonly label: string;
    };

const CURRENCY_IDS = new Map<string, string>([
  ["penny", "Penny"],
  ["mark", "Mark"],
  ["crown", "Crown"],
  ["throne", "Throne"]
]);

const FILTERED_PATHS = new Set<string>([
  "player.interactionState.totalButtonPresses",
  "player.interactionState.lastButtonPress",
  "player.interactionState.recentButtonPresses",
  "player.story.currentArcId",
  "player.story.currentChapter"
]);

const FILTERED_PATH_PREFIXES = ["player.story.completedChapters", "player.activityState.availability"];

export function mapDeltaToGameplayLogEntry(delta: Delta): StoredGameplayLogEntry | null {
  if (shouldIgnoreDelta(delta)) {
    return null;
  }

  const mappedEntry =
    mapCombatDelta(delta) ??
    mapQuestDelta(delta) ??
    mapCurrencyDelta(delta) ??
    mapItemDelta(delta) ??
    mapAttributeDelta(delta) ??
    mapSkillDelta(delta) ??
    mapEquipmentDelta(delta) ??
    mapGenericDelta(delta);

  if (!mappedEntry) {
    return null;
  }

  return {
    entry: mappedEntry.entry,
    mergeState: mappedEntry.mergeState
  };
}

export function mapWorldUpdateToGameplayLogEntry(
  event: WorldUpdateEvent
): StoredGameplayLogEntry | null {
  const previousSublocation = event.previousWorld.sublocations.at(-1) ?? null;
  const nextSublocation = event.nextWorld.sublocations.at(-1) ?? null;

  if (
    event.previousWorld.currentLocation === event.nextWorld.currentLocation &&
    previousSublocation !== nextSublocation
  ) {
    if (previousSublocation && !nextSublocation) {
      return {
        entry: {
          type: "system",
          text: `Left ${prettyLabel(previousSublocation)}`
        },
        mergeState: null
      };
    }

    if (nextSublocation) {
      return {
        entry: {
          type: "system",
          text: `Entered ${prettyLabel(nextSublocation)}`
        },
        mergeState: null
      };
    }
  }

  if (event.previousWorld.currentLocation !== event.nextWorld.currentLocation) {
    return {
      entry: {
        type: "system",
        text: `Traveled from ${prettyLabel(event.previousWorld.currentLocation)} to ${prettyLabel(event.nextWorld.currentLocation)}`
      },
      mergeState: null
    };
  }

  return null;
}

export function mapDialogEventToGameplayLogEntry(
  event: GameDialogEvent
): StoredGameplayLogEntry | null {
  switch (event.type) {
    case "session-started":
    case "session-ended":
      return null;
    case "line-shown":
      return {
        entry: {
          type: "dialogue",
          text: formatDialogueEntry(event.entry)
        },
        mergeState: null
      };
    case "choices-presented":
      return {
        entry: {
          type: "choice",
          options: event.choices.map(cloneChoiceView)
        },
        mergeState: null
      };
    case "choice-selected":
      return {
        entry: {
          type: "dialogue",
          text: `Chose: ${event.choice.label}`
        },
        mergeState: null
      };
  }

  return null;
}

export function mapQuestEventToGameplayLogEntry(
  event: GameQuestEvent
): StoredGameplayLogEntry | null {
  switch (event.type) {
    case "quest-start-queued":
    case "quest-progressed":
      return null;
    case "quest-started":
    case "quest-completed":
      return {
        entry: {
          type: "quest",
          text: event.message
        },
        mergeState: null
      };
  }

  return null;
}

export function appendGameplayLogEntry(
  entries: readonly StoredGameplayLogEntry[],
  nextEntry: StoredGameplayLogEntry
): readonly StoredGameplayLogEntry[] {
  const previousEntry = entries.at(-1);

  if (
    previousEntry?.mergeState &&
    nextEntry.mergeState &&
    previousEntry.mergeState.kind === nextEntry.mergeState.kind &&
    previousEntry.mergeState.key === nextEntry.mergeState.key
  ) {
    const mergedState = {
      ...previousEntry.mergeState,
      amount: previousEntry.mergeState.amount + nextEntry.mergeState.amount
    } satisfies GameplayLogMergeState;

    return [
      ...entries.slice(0, -1),
      {
        entry: buildMergedEntry(mergedState),
        mergeState: mergedState
      }
    ];
  }

  if (areDuplicateEntries(previousEntry?.entry, nextEntry.entry)) {
    return entries;
  }

  return [...entries, nextEntry];
}

export function toGameplayLogEntries(
  entries: readonly StoredGameplayLogEntry[]
): GameLogEntry[] {
  return entries.map((entry) => entry.entry);
}

function shouldIgnoreDelta(delta: Delta): boolean {
  if (delta.path.length === 0) {
    return true;
  }

  if (delta.meta?.["gameplayLogHandledBy"] === "quest-event") {
    return true;
  }

  if (extractKillSignal(delta)) {
    return false;
  }

  const pathKey = buildPathKey(delta);

  return (
    FILTERED_PATHS.has(pathKey) ||
    FILTERED_PATH_PREFIXES.some((prefix) => pathKey.startsWith(prefix))
  );
}

function mapCombatDelta(delta: Delta): GameplayLogMappedEntry | null {
  const signal = extractKillSignal(delta);

  if (!signal || signal.amount <= 0) {
    return null;
  }

  const label = prettyLabel(signal.target);

  return {
    entry: {
      type: "combat",
      text: `Defeated ${label} x${formatNumber(signal.amount)}`
    },
    mergeState: {
      kind: "combat-kill",
      key: signal.target,
      amount: signal.amount,
      label
    }
  };
}

function mapQuestDelta(delta: Delta): GameplayLogMappedEntry | null {
  if (
    delta.type !== "set" ||
    delta.target !== "player" ||
    delta.path.length !== 3 ||
    delta.path[0] !== "questLog" ||
    delta.path[1] !== "quests"
  ) {
    return null;
  }

  const questId = delta.path[2];
  const questEntry = parseQuestEntry(delta.value);

  if (!questId || !questEntry) {
    return null;
  }

  if (questEntry.status === "active") {
    return {
      entry: {
        type: "quest",
        text: `Quest started: ${prettyLabel(questId)}`
      },
      mergeState: null
    };
  }

  if (questEntry.status === "completed") {
    return {
      entry: {
        type: "quest",
        text: `Quest completed: ${prettyLabel(questId)}`
      },
      mergeState: null
    };
  }

  return {
    entry: {
      type: "quest",
      text: `Quest updated: ${prettyLabel(questId)} is now ${prettyLabel(questEntry.status)}`
    },
    mergeState: null
  };
}

function mapCurrencyDelta(delta: Delta): GameplayLogMappedEntry | null {
  const amount = getInventoryAdditionAmount(delta);
  const itemId = getInventoryItemId(delta);

  if (amount === null || !itemId) {
    return null;
  }

  const currency = getCurrencyDefinition(itemId);

  if (!currency) {
    return null;
  }

  return {
    entry: {
      type: "loot",
      text: `${amount > 0 ? "Received" : "Spent"} ${currency.label} x${formatNumber(Math.abs(amount))}`
    },
    mergeState:
      amount > 0
        ? {
            kind: "currency",
            key: currency.key,
            amount,
            label: currency.label
          }
        : null
  };
}

function mapItemDelta(delta: Delta): GameplayLogMappedEntry | null {
  const amount = getInventoryAdditionAmount(delta);
  const itemId = getInventoryItemId(delta);

  if (amount === null || !itemId || getCurrencyDefinition(itemId)) {
    return null;
  }

  const label = prettyLabel(itemId);

  return {
    entry: {
      type: "loot",
      text: `${amount > 0 ? "Received" : "Spent"} ${label} x${formatNumber(Math.abs(amount))}`
    },
    mergeState:
      amount > 0
        ? {
            kind: "item",
            key: itemId,
            amount,
            label
          }
        : null
  };
}

function mapAttributeDelta(delta: Delta): GameplayLogMappedEntry | null {
  if (
    delta.target !== "player" ||
    delta.path.length !== 2 ||
    delta.path[0] !== "attributes" ||
    typeof delta.value !== "number"
  ) {
    return null;
  }

  const attributeId = delta.path[1];

  if (!attributeId) {
    return null;
  }

  const label = prettyLabel(attributeId);

  if (delta.type === "add") {
    if (delta.value === 0) {
      return null;
    }

    return {
      entry: {
        type: "system",
        text: `${label} ${delta.value > 0 ? "+" : ""}${formatNumber(delta.value)}`
      },
      mergeState: {
        kind: "attribute",
        key: attributeId,
        amount: delta.value,
        label
      }
    };
  }

  return {
    entry: {
      type: "system",
      text: `${label} is now ${formatNumber(delta.value)}`
    },
    mergeState: null
  };
}

function mapSkillDelta(delta: Delta): GameplayLogMappedEntry | null {
  if (
    delta.target !== "player" ||
    delta.path.length !== 2 ||
    delta.path[0] !== "skills" ||
    typeof delta.value !== "number"
  ) {
    return null;
  }

  const skillId = delta.path[1];

  if (!skillId) {
    return null;
  }

  const label = prettyLabel(skillId);

  if (delta.type === "add") {
    if (delta.value === 0) {
      return null;
    }

    return {
      entry: {
        type: "system",
        text: `${label} ${delta.value > 0 ? "+" : ""}${formatNumber(delta.value)}`
      },
      mergeState: {
        kind: "skill",
        key: skillId,
        amount: delta.value,
        label
      }
    };
  }

  return {
    entry: {
      type: "system",
      text: `${label} is now ${formatNumber(delta.value)}`
    },
    mergeState: null
  };
}

function mapEquipmentDelta(delta: Delta): GameplayLogMappedEntry | null {
  if (
    delta.target !== "player" ||
    delta.type !== "set" ||
    delta.path.length !== 2 ||
    delta.path[0] !== "equippedItems"
  ) {
    return null;
  }

  const slotId = delta.path[1];

  if (!slotId) {
    return null;
  }

  if (typeof delta.value === "string" && delta.value.trim().length > 0) {
    return {
      entry: {
        type: "loot",
        text: `Equipped ${prettyLabel(delta.value)} in ${prettyLabel(slotId)}`
      },
      mergeState: null
    };
  }

  if (delta.value === null) {
    return {
      entry: {
        type: "loot",
        text: `Unequipped ${prettyLabel(slotId)}`
      },
      mergeState: null
    };
  }

  return null;
}

function mapGenericDelta(delta: Delta): GameplayLogMappedEntry | null {
  const pathLabel = prettyPath(delta.path);
  const subjectLabel = buildSubjectLabel(delta);
  const entryType = classifyGenericEntryType(delta.path);

  if (delta.type === "add" && typeof delta.value === "number" && delta.value !== 0) {
    return {
      entry: {
        type: entryType,
        text: `${subjectLabel} ${pathLabel} ${delta.value > 0 ? "+" : ""}${formatNumber(delta.value)}`
      },
      mergeState: null
    };
  }

  if (delta.type === "set") {
    return {
      entry: {
        type: entryType,
        text: `${subjectLabel} ${pathLabel} set to ${toHumanValue(delta.value)}`
      },
      mergeState: null
    };
  }

  return null;
}

function buildMergedEntry(state: GameplayLogMergeState): GameLogEntry {
  switch (state.kind) {
    case "attribute":
    case "skill":
      return {
        type: "system",
        text: `${state.label} ${state.amount > 0 ? "+" : ""}${formatNumber(state.amount)}`
      };
    case "currency":
    case "item":
      return {
        type: "loot",
        text: `Received ${state.label} x${formatNumber(state.amount)}`
      };
    case "combat-kill":
      return {
        type: "combat",
        text: `Defeated ${state.label} x${formatNumber(state.amount)}`
      };
  }
}

function getInventoryItemId(delta: Delta): string | null {
  if (
    delta.target !== "player" ||
    delta.path.length !== 3 ||
    delta.path[0] !== "inventory" ||
    delta.path[1] !== "items"
  ) {
    return null;
  }

  return delta.path[2] ?? null;
}

function getInventoryAdditionAmount(delta: Delta): number | null {
  if (delta.type !== "add" || typeof delta.value !== "number" || delta.value === 0) {
    return null;
  }

  return getInventoryItemId(delta) ? delta.value : null;
}

function parseQuestEntry(value: Delta["value"]): PlayerQuestEntry | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const currentStep = record["currentStep"];
  const status = record["status"];

  if (
    typeof currentStep !== "string" ||
    (status !== "inactive" && status !== "active" && status !== "completed")
  ) {
    return null;
  }

  return {
    currentStep,
    status,
    completedSteps: Array.isArray(record["completedSteps"])
      ? record["completedSteps"].filter((entry): entry is string => typeof entry === "string")
      : undefined
  };
}

function extractKillSignal(delta: Delta): { target: string; amount: number } | null {
  const nestedSignal = delta.meta?.["questSignal"];

  if (typeof nestedSignal === "object" && nestedSignal !== null && !Array.isArray(nestedSignal)) {
    const record = nestedSignal as Record<string, unknown>;
    const target = record["target"];
    const amount =
      toFiniteNumber(record["amount"]) ??
      toFiniteNumber(record["count"]) ??
      toFiniteNumber(record["killCount"]);

    if (record["type"] === "kill" && typeof target === "string" && amount !== null) {
      return { target, amount };
    }
  }

  if (!delta.meta || typeof delta.meta !== "object") {
    return null;
  }

  const target = delta.meta["killTarget"];
  const amount =
    toFiniteNumber(delta.meta["killCount"]) ?? toFiniteNumber(delta.meta["count"]);

  if (typeof target !== "string" || amount === null) {
    return null;
  }

  return { target, amount };
}

function getCurrencyDefinition(itemId: string): { key: string; label: string } | null {
  // GAP: Currency ids are documented in design docs but not yet authored as a core enum/schema.
  // This mapper currently recognizes the documented ids directly plus `currency_*` aliases.
  const normalizedKey = itemId.toLowerCase().replace(/^currency_/, "");
  const label = CURRENCY_IDS.get(normalizedKey);

  if (!label) {
    return null;
  }

  return {
    key: normalizedKey,
    label
  };
}

function buildPathKey(delta: Delta): string {
  return `${delta.target}.${delta.path.join(".")}`;
}

function buildSubjectLabel(delta: Delta): string {
  if (delta.target === "npc") {
    return delta.targetId ? `${prettyLabel(delta.targetId)}` : "Npc";
  }

  return "Player";
}

function classifyGenericEntryType(path: readonly string[]): Exclude<GameLogEntry["type"], "choice"> {
  if (path[0] === "story") {
    return "dialogue";
  }

  if (path[0] === "questLog") {
    return "quest";
  }

  if (path[0] === "inventory" || path[0] === "equippedItems") {
    return "loot";
  }

  return "system";
}

function prettyPath(path: readonly string[]): string {
  return path.map((segment) => prettyLabel(segment)).join(" ");
}

function formatDialogueEntry(entry: GameDialogTranscriptEntry): string {
  if (entry.kind === "narration" || !entry.actor?.name) {
    return entry.text;
  }

  return `${entry.actor.name}: ${entry.text}`;
}

function cloneChoiceView(choice: GameDialogChoiceView): GameDialogChoiceView {
  return {
    index: choice.index,
    label: choice.label,
    seen: choice.seen
  };
}

function toHumanValue(value: DeltaValue): string {
  if (value === null) {
    return "none";
  }

  if (typeof value === "string") {
    return prettyLabel(value);
  }

  if (typeof value === "number") {
    return formatNumber(value);
  }

  if (typeof value === "boolean") {
    return value ? "enabled" : "disabled";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "none";
    }

    return value.map((entry) => toHumanValue(entry)).join(", ");
  }

  return Object.entries(value)
    .map(([key, entry]) => `${prettyLabel(key)}: ${toHumanValue(entry)}`)
    .join("; ");
}

function areDuplicateEntries(
  left: GameLogEntry | undefined,
  right: GameLogEntry
): boolean {
  if (!left || left.type !== right.type) {
    return false;
  }

  if (left.type === "choice" || right.type === "choice") {
    return false;
  }

  return left.text === right.text;
}

function prettyLabel(value: string): string {
  return value
    .replace(/^quest_/, "")
    .replace(/^currency_/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value.toFixed(2).replace(/\.?0+$/, "");
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
