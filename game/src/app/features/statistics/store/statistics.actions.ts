import { createAction, props } from "@ngrx/store";
import {
  type AchievementDefinition,
  type AtomicGameplayFact,
  type StatisticsDefinition
} from "@rinner/grayvale-core";

export const loadStatisticsDefinitions = createAction(
  "[Statistics] Definitions Load Requested"
);

export const loadStatisticsDefinitionsSuccess = createAction(
  "[Statistics] Definitions Load Succeeded",
  props<{ definitions: readonly StatisticsDefinition[] }>()
);

export const loadStatisticsDefinitionsFailure = createAction(
  "[Statistics] Definitions Load Failed",
  props<{ error: string }>()
);

export const loadAchievementDefinitions = createAction(
  "[Statistics] Achievement Definitions Load Requested"
);

export const loadAchievementDefinitionsSuccess = createAction(
  "[Statistics] Achievement Definitions Load Succeeded",
  props<{ definitions: readonly AchievementDefinition[] }>()
);

export const loadAchievementDefinitionsFailure = createAction(
  "[Statistics] Achievement Definitions Load Failed",
  props<{ error: string }>()
);

export const atomicFactIngested = createAction(
  "[Statistics] Atomic Gameplay Fact Ingested",
  props<{ fact: AtomicGameplayFact }>()
);

export const achievementEarnedRecorded = createAction(
  "[Statistics] Achievement Earned Recorded",
  props<{ earnedKey: string }>()
);
