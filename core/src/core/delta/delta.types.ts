export type DeltaOperation = "set" | "add";

export type DeltaTarget = "player" | "npc";

export type DeltaValue =
  | number
  | string
  | boolean
  | null
  | DeltaValue[]
  | {
      [key: string]: DeltaValue;
    };

export type Delta = {
  type: DeltaOperation;
  target: DeltaTarget;
  targetId?: string;
  path: string[];
  value: DeltaValue;
  meta?: Record<string, unknown>;
};
