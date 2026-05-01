import type { ButtonPressRecord, Delta, DeltaValue, Player } from "@rinner/grayvale-core";

import type { SaveSlotWorldState } from "./world-state.models";

export interface ButtonPressActionInput {
  readonly actionId: string;
  readonly actionKind: string;
  readonly payload?: Record<string, string | number | boolean>;
}

const RECENT_BUTTON_PRESS_LIMIT = 50;

export function buildButtonPressDeltas(
  player: Player,
  world: SaveSlotWorldState,
  action: ButtonPressActionInput,
  occurredAt: string
): Delta[] {
  const record: ButtonPressRecord = {
    actionId: action.actionId,
    actionKind: action.actionKind,
    occurredAt,
    locationId: world.currentLocation,
    sublocationId: world.sublocations.at(-1),
    payload: action.payload
  };
  const previousRecent = player.interactionState?.recentButtonPresses ?? [];
  const nextRecent = [...previousRecent, record].slice(-RECENT_BUTTON_PRESS_LIMIT);

  return [
    {
      type: "add",
      target: "player",
      path: ["interactionState", "totalButtonPresses"],
      value: 1
    },
    {
      type: "set",
      target: "player",
      path: ["interactionState", "lastButtonPress"],
      value: toDeltaRecord(record)
    },
    {
      type: "set",
      target: "player",
      path: ["interactionState", "recentButtonPresses"],
      value: nextRecent.map((entry) => toDeltaRecord(entry))
    }
  ];
}

function toDeltaRecord(record: ButtonPressRecord): DeltaValue {
  const value: Record<string, DeltaValue> = {
    actionId: record.actionId,
    actionKind: record.actionKind,
    occurredAt: record.occurredAt
  };

  if (record.locationId !== undefined) {
    value["locationId"] = record.locationId;
  }

  if (record.sublocationId !== undefined) {
    value["sublocationId"] = record.sublocationId;
  }

  if (record.payload !== undefined) {
    value["payload"] = { ...record.payload };
  }

  return value;
}
