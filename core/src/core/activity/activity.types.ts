import type { Entity, Named } from "../models/base";
import type { ActivityReward } from "./reward.types";

export type Activity = {
  type: string;
  payload?: Record<string, unknown>;
};

export type ActivityOf<
  TType extends string = string,
  TPayload extends Record<string, unknown> = Record<string, unknown>
> = {
  type: TType;
  payload: TPayload;
};

export type ActivityTag = string;

export type GoverningAttributeId = string;

export type ActivityDifficulty = number;

export interface ActivityDefinition extends Entity, Named {
  tags: ActivityTag[];
  governingAttributes: GoverningAttributeId[];
  difficulty: ActivityDifficulty;
  itemId?: string;
  rewards?: ActivityReward[];
}

export type ActivityTickDelta = ActivityOf<
  "activity_tick",
  {
    activityId: string;
    difficulty: ActivityDifficulty;
    governingAttributes: GoverningAttributeId[];
    tags: ActivityTag[];
    tickDelta: number;
    itemId?: string; // TODO: what if it's dropping more than one item?
  }
>;
