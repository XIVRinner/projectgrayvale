import {
  type AchievementDefinition,
  type AtomicGameplayFact,
  type StatisticsDefinition
} from "@rinner/grayvale-core";

import { type StatisticStore } from "./statistics-aggregator";

export interface StatisticsState {
  definitions: readonly StatisticsDefinition[];
  achievementDefinitions: readonly AchievementDefinition[];
  values: StatisticStore;
  processedFactKeys: Set<string>;
  earnedAchievementKeys: Set<string>;
  loading: boolean;
  error: string | null;
  lastFact: AtomicGameplayFact | null;
}

export const initialStatisticsState: StatisticsState = {
  definitions: [],
  achievementDefinitions: [],
  values: {},
  processedFactKeys: new Set<string>(),
  earnedAchievementKeys: new Set<string>(),
  loading: false,
  error: null,
  lastFact: null
};
