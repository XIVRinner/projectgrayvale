import { createFeatureSelector, createSelector } from "@ngrx/store";

import { createStatisticKey } from "./statistics-aggregator";
import { type StatisticsState } from "./statistics.state";

export const selectStatisticsFeature = createFeatureSelector<StatisticsState>("statistics");

export const selectStatisticsDefinitions = createSelector(
  selectStatisticsFeature,
  (state) => state.definitions
);

export const selectStatisticsValues = createSelector(
  selectStatisticsFeature,
  (state) => state.values
);

export const selectAchievementDefinitions = createSelector(
  selectStatisticsFeature,
  (state) => state.achievementDefinitions
);

export const selectEarnedAchievementKeys = createSelector(
  selectStatisticsFeature,
  (state) => state.earnedAchievementKeys
);

export const selectStatisticsLoading = createSelector(
  selectStatisticsFeature,
  (state) => state.loading
);

export const selectStatisticsError = createSelector(
  selectStatisticsFeature,
  (state) => state.error
);

export const selectStatisticValue = (factType: string, scope: string, scopeId: string) =>
  createSelector(selectStatisticsValues, (values) => values[createStatisticKey(factType, scope, scopeId)]?.value ?? 0);
