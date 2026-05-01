import type { NPC } from "../npc";
import type { GameState } from "./delta.state";
import type { Delta, DeltaValue } from "./delta.types";

type MutableRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is MutableRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertPath = (delta: Delta): void => {
  if (delta.path.length === 0) {
    throw new Error("Delta path cannot be empty.");
  }
};

const getNextValue = (currentValue: unknown, delta: Delta): DeltaValue => {
  if (delta.type === "set") {
    return delta.value;
  }

  if (typeof delta.value !== "number") {
    throw new Error('Delta type "add" requires a numeric value.');
  }

  if (currentValue === undefined) {
    return delta.value;
  }

  if (typeof currentValue !== "number") {
    throw new Error('Delta type "add" can only be used on numeric values.');
  }

  return currentValue + delta.value;
};

const updateAtPath = (
  current: unknown,
  path: string[],
  delta: Delta
): unknown => {
  const [segment, ...rest] = path;
  const currentRecord = isRecord(current) ? current : {};

  if (rest.length === 0) {
    const currentValue = currentRecord[segment];
    const nextValue = getNextValue(currentValue, delta);

    if (currentValue === nextValue) {
      return currentRecord;
    }

    return {
      ...currentRecord,
      [segment]: nextValue
    };
  }

  const currentChild = currentRecord[segment];
  const nextChild = updateAtPath(currentChild, rest, delta);

  if (currentChild === nextChild) {
    return currentRecord;
  }

  return {
    ...currentRecord,
    [segment]: nextChild
  };
};

const updateNpcCollection = (
  npcs: Record<string, NPC>,
  npcId: string,
  delta: Delta
): Record<string, NPC> => {
  const currentNpc = npcs[npcId];

  if (currentNpc === undefined) {
    throw new Error(`NPC target "${npcId}" does not exist.`);
  }

  const nextNpc = updateAtPath(currentNpc, delta.path, delta) as NPC;

  if (nextNpc === currentNpc) {
    return npcs;
  }

  return {
    ...npcs,
    [npcId]: nextNpc
  };
};

export const applyDelta = (state: GameState, delta: Delta): GameState => {
  assertPath(delta);

  switch (delta.target) {
    case "player": {
      const nextPlayer = updateAtPath(state.player, delta.path, delta) as GameState["player"];

      if (nextPlayer === state.player) {
        return state;
      }

      return {
        ...state,
        player: nextPlayer
      };
    }
    case "npc": {
      if (delta.targetId === undefined || delta.targetId.length === 0) {
        throw new Error('NPC deltas require a "targetId".');
      }

      const nextNpcs = updateNpcCollection(state.npcs, delta.targetId, delta);

      if (nextNpcs === state.npcs) {
        return state;
      }

      return {
        ...state,
        npcs: nextNpcs
      };
    }
    default:
      throw new Error(`Invalid delta target: ${String(delta.target)}`);
  }
};

export const applyDeltas = (state: GameState, deltas: Delta[]): GameState =>
  deltas.reduce((currentState, delta) => applyDelta(currentState, delta), state);
