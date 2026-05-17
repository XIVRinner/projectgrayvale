import { createReducer, on } from "@ngrx/store";

import {
  applyCounter,
  applyFlag,
  applyMax,
  createFactIdentityKey,
  createStatisticKey
} from "./statistics-aggregator";
import { initialStatisticsState } from "./statistics.state";
import * as StatisticsActions from "./statistics.actions";

export const statisticsReducer = createReducer(
  initialStatisticsState,
  on(StatisticsActions.loadStatisticsDefinitions, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(StatisticsActions.loadStatisticsDefinitionsSuccess, (state, { definitions }) => ({
    ...state,
    definitions,
    loading: false,
    error: null
  })),
  on(StatisticsActions.loadStatisticsDefinitionsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  on(StatisticsActions.loadAchievementDefinitions, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(StatisticsActions.loadAchievementDefinitionsSuccess, (state, { definitions }) => ({
    ...state,
    achievementDefinitions: definitions,
    loading: false,
    error: null
  })),
  on(StatisticsActions.loadAchievementDefinitionsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error
  })),
  on(StatisticsActions.atomicFactIngested, (state, { fact }) => {
    const factKey = createFactIdentityKey(fact);

    if (state.processedFactKeys.has(factKey)) {
      return state;
    }

    const definition = state.definitions.find((entry) => entry.factType === fact.factType && entry.scope === fact.scope);

    if (!definition) {
      return {
        ...state,
        processedFactKeys: new Set([...state.processedFactKeys, factKey]),
        lastFact: fact
      };
    }

    const statisticKey = createStatisticKey(fact.factType, fact.scope, fact.scopeId);
    const currentValue = state.values[statisticKey]?.value ?? definition.initialValue ?? 0;
    const rawNextValue = fact.value ?? 1;

    const nextValue = definition.aggregation === "counter"
      ? applyCounter(currentValue, rawNextValue)
      : definition.aggregation === "max"
        ? applyMax(currentValue, rawNextValue)
        : applyFlag(currentValue, rawNextValue);

    return {
      ...state,
      values: {
        ...state.values,
        [statisticKey]: {
          value: nextValue,
          updatedAt: fact.occurredAt
        }
      },
      processedFactKeys: new Set([...state.processedFactKeys, factKey]),
      lastFact: fact
    };
  }),
  on(StatisticsActions.achievementEarnedRecorded, (state, { earnedKey }) => ({
    ...state,
    earnedAchievementKeys: new Set([...state.earnedAchievementKeys, earnedKey])
  }))
);
