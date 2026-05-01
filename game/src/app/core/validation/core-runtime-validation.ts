import type {
  PlayerActivityAvailabilityEntry,
  ButtonPressRecord,
  Modifier,
  Player,
  PlayerDifficultyMode,
  PlayerDifficultySettings,
  Race,
  RaceVariant
} from "@rinner/grayvale-core";

export function parseRace(raw: unknown): Race {
  const record = ensureRecord(raw, "race");

  return {
    id: ensureString(record["id"], "race.id"),
    name: ensureString(record["name"], "race.name"),
    slug: ensureString(record["slug"], "race.slug"),
    imageBasePath: ensureString(record["imageBasePath"], "race.imageBasePath"),
    variants: parseVariants(record["variants"]),
    startingBonuses: parseModifiers(record["startingBonuses"])
  };
}

export function safeParsePlayer(raw: unknown):
  | { success: true; data: Player }
  | { success: false; error: string } {
  try {
    return {
      success: true,
      data: parsePlayer(raw)
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid player payload."
    };
  }
}

function parsePlayer(raw: unknown): Player {
  const record = ensureRecord(raw, "player");
  const selectedAppearance = parseSelectedAppearance(record["selectedAppearance"]);
  const talents = parseStringArray(record["talents"], "player.talents");
  const questLog = parseQuestLog(record["questLog"]);
  const story = parseStory(record["story"]);
  const activityState = parseActivityState(record["activityState"]);
  const interactionState = parseInteractionState(record["interactionState"]);
  const difficulty = parseDifficulty(record["difficulty"]);

  return {
    id: ensureString(record["id"], "player.id"),
    name: ensureString(record["name"], "player.name"),
    description: parseOptionalString(record["description"], "player.description"),
    raceId: ensureString(record["raceId"], "player.raceId"),
    jobClass: ensureString(record["jobClass"], "player.jobClass"),
    progression: parseProgression(record["progression"]),
    adventurerRank: ensureNumber(record["adventurerRank"], "player.adventurerRank"),
    difficulty,
    genderId: parseOptionalString(record["genderId"], "player.genderId"),
    attributes: parseNumberRecord(record["attributes"], "player.attributes"),
    skills: parseNumberRecord(record["skills"], "player.skills"),
    selectedAppearance,
    talents,
    questLog,
    story,
    activityState,
    interactionState,
    inventory: parseInventory(record["inventory"]),
    equippedItems: parseEquippedItems(record["equippedItems"])
  };
}

function parseDifficulty(raw: unknown): PlayerDifficultySettings {
  if (raw === undefined) {
    return {
      mode: "normal",
      expert: false,
      ironman: false
    };
  }

  const record = ensureRecord(raw, "player.difficulty");
  const mode = ensureString(record["mode"], "player.difficulty.mode");

  if (!isDifficultyMode(mode)) {
    throw new Error("player.difficulty.mode must be easy, normal, or hard.");
  }

  return {
    mode,
    expert: ensureBoolean(record["expert"], "player.difficulty.expert"),
    ironman: ensureBoolean(record["ironman"], "player.difficulty.ironman")
  };
}

function parseVariants(raw: unknown): Race["variants"] {
  if (raw === undefined) {
    return undefined;
  }

  const record = ensureRecord(raw, "race.variants");

  return {
    warm: parseStringArray(record["warm"], "race.variants.warm"),
    cool: parseStringArray(record["cool"], "race.variants.cool"),
    exotic: parseStringArray(record["exotic"], "race.variants.exotic")
  };
}

function parseModifiers(raw: unknown): Modifier[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    throw new Error("race.startingBonuses must be an array.");
  }

  return raw.map((entry, index) => {
    const record = ensureRecord(entry, `race.startingBonuses[${index}]`);
    const type = ensureString(record["type"], `race.startingBonuses[${index}].type`);

    if (type !== "add" && type !== "multiply") {
      throw new Error(`race.startingBonuses[${index}].type must be add or multiply.`);
    }

    return {
      stat: ensureString(record["stat"], `race.startingBonuses[${index}].stat`),
      type,
      value: ensureNumber(record["value"], `race.startingBonuses[${index}].value`)
    };
  });
}

function parseProgression(raw: unknown): Player["progression"] {
  const record = ensureRecord(raw, "player.progression");

  return {
    level: ensureNumber(record["level"], "player.progression.level"),
    experience: ensureNumber(record["experience"], "player.progression.experience")
  };
}

function parseSelectedAppearance(raw: unknown): Player["selectedAppearance"] {
  if (raw === undefined) {
    return undefined;
  }

  const record = ensureRecord(raw, "player.selectedAppearance");
  const variant = ensureString(record["variant"], "player.selectedAppearance.variant");

  if (!isRaceVariant(variant)) {
    throw new Error("player.selectedAppearance.variant must be warm, cool, or exotic.");
  }

  return {
    variant,
    imageIndex: ensureNumber(record["imageIndex"], "player.selectedAppearance.imageIndex")
  };
}

function parseQuestLog(raw: unknown): Player["questLog"] {
  if (raw === undefined) {
    return undefined;
  }

  const record = ensureRecord(raw, "player.questLog");
  const questsRecord = ensureRecord(record["quests"], "player.questLog.quests");
  const quests: NonNullable<Player["questLog"]>["quests"] = {};

  for (const [questId, questValue] of Object.entries(questsRecord)) {
    const questRecord = ensureRecord(questValue, `player.questLog.quests.${questId}`);
    const status = ensureString(questRecord["status"], `player.questLog.quests.${questId}.status`);

    if (status !== "inactive" && status !== "active" && status !== "completed") {
      throw new Error(`player.questLog.quests.${questId}.status is invalid.`);
    }

    quests[questId] = {
      currentStep: ensureString(
        questRecord["currentStep"],
        `player.questLog.quests.${questId}.currentStep`
      ),
      status,
      completedSteps: parseStringArray(
        questRecord["completedSteps"],
        `player.questLog.quests.${questId}.completedSteps`
      )
    };
  }

  return { quests };
}

function parseStory(raw: unknown): Player["story"] {
  if (raw === undefined) {
    return undefined;
  }

  const record = ensureRecord(raw, "player.story");

  return {
    currentArcId: ensureString(record["currentArcId"], "player.story.currentArcId"),
    currentChapter: ensureNumber(record["currentChapter"], "player.story.currentChapter"),
    completedChapters: parseNumberArray(
      record["completedChapters"],
      "player.story.completedChapters"
    )
  };
}

function parseInventory(raw: unknown): Player["inventory"] {
  const record = ensureRecord(raw, "player.inventory");

  return {
    items: parseNumberRecord(record["items"], "player.inventory.items")
  };
}

function parseActivityState(raw: unknown): Player["activityState"] {
  if (raw === undefined) {
    return undefined;
  }

  const record = ensureRecord(raw, "player.activityState");
  const availabilityRecord = ensureRecord(
    record["availability"],
    "player.activityState.availability"
  );
  const availability: Record<string, PlayerActivityAvailabilityEntry> = {};

  for (const [activityId, value] of Object.entries(availabilityRecord)) {
    availability[activityId] = parseActivityAvailabilityEntry(
      value,
      `player.activityState.availability.${activityId}`
    );
  }

  return {
    availability,
    activeActivityId: parseNullableString(
      record["activeActivityId"],
      "player.activityState.activeActivityId"
    )
  };
}

function parseInteractionState(raw: unknown): Player["interactionState"] {
  if (raw === undefined) {
    return undefined;
  }

  const record = ensureRecord(raw, "player.interactionState");

  return {
    totalButtonPresses: ensureNumber(
      record["totalButtonPresses"],
      "player.interactionState.totalButtonPresses"
    ),
    lastButtonPress: parseButtonPressRecord(
      record["lastButtonPress"],
      "player.interactionState.lastButtonPress"
    ),
    recentButtonPresses: parseButtonPressRecordArray(
      record["recentButtonPresses"],
      "player.interactionState.recentButtonPresses"
    )
  };
}

function parseEquippedItems(raw: unknown): Player["equippedItems"] {
  const record = ensureRecord(raw, "player.equippedItems");
  const result: Player["equippedItems"] = {};

  for (const key of ["mainHand", "offHand", "head", "body", "legs", "hands"] as const) {
    const value = record[key];

    if (value === undefined) {
      continue;
    }

    result[key] = ensureString(value, `player.equippedItems.${key}`);
  }

  return result;
}

function parseButtonPressRecord(
  raw: unknown,
  label: string
): ButtonPressRecord | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const record = ensureRecord(raw, label);

  return {
    actionId: ensureString(record["actionId"], `${label}.actionId`),
    actionKind: ensureString(record["actionKind"], `${label}.actionKind`),
    occurredAt: ensureString(record["occurredAt"], `${label}.occurredAt`),
    locationId: parseOptionalString(record["locationId"], `${label}.locationId`),
    sublocationId: parseOptionalString(record["sublocationId"], `${label}.sublocationId`),
    payload: parseButtonPressPayload(record["payload"], `${label}.payload`)
  };
}

function parseButtonPressRecordArray(
  raw: unknown,
  label: string
): ButtonPressRecord[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array.`);
  }

  return raw.map((entry, index) => parseButtonPressRecord(entry, `${label}[${index}]`)!);
}

function parseButtonPressPayload(
  raw: unknown,
  label: string
): Record<string, string | number | boolean> | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const record = ensureRecord(raw, label);
  const result: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      throw new Error(`${label}.${key} must be a string, number, or boolean.`);
    }

    result[key] = value;
  }

  return result;
}

function parseNumberRecord(raw: unknown, label: string): Record<string, number> {
  const record = ensureRecord(raw, label);
  const result: Record<string, number> = {};

  for (const [key, value] of Object.entries(record)) {
    result[key] = ensureNumber(value, `${label}.${key}`);
  }

  return result;
}

function parseActivityAvailabilityEntry(
  raw: unknown,
  label: string
): PlayerActivityAvailabilityEntry {
  const record = ensureRecord(raw, label);
  const status = ensureString(record["status"], `${label}.status`);

  if (
    status !== "locked" &&
    status !== "enabled" &&
    status !== "disabled"
  ) {
    throw new Error(`${label}.status must be locked, enabled, or disabled.`);
  }

  return {
    status,
    disabledReason: parseOptionalString(record["disabledReason"], `${label}.disabledReason`)
  };
}

function parseStringArray(raw: unknown, label: string): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array.`);
  }

  return raw.map((entry, index) => ensureString(entry, `${label}[${index}]`));
}

function parseNumberArray(raw: unknown, label: string): number[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array.`);
  }

  return raw.map((entry, index) => ensureNumber(entry, `${label}[${index}]`));
}

function parseOptionalString(raw: unknown, label: string): string | undefined {
  if (raw === undefined) {
    return undefined;
  }

  return ensureString(raw, label);
}

function parseNullableString(raw: unknown, label: string): string | null | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if (raw === null) {
    return null;
  }

  return ensureString(raw, label);
}

function ensureRecord(raw: unknown, label: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${label} must be an object.`);
  }

  return raw as Record<string, unknown>;
}

function ensureString(raw: unknown, label: string): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return raw;
}

function ensureNumber(raw: unknown, label: string): number {
  if (typeof raw !== "number" || Number.isNaN(raw)) {
    throw new Error(`${label} must be a number.`);
  }

  return raw;
}

function ensureBoolean(raw: unknown, label: string): boolean {
  if (typeof raw !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }

  return raw;
}

function isRaceVariant(value: string): value is RaceVariant {
  return value === "warm" || value === "cool" || value === "exotic";
}

function isDifficultyMode(value: string): value is PlayerDifficultyMode {
  return value === "easy" || value === "normal" || value === "hard";
}
