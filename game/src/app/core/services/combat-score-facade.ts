import { Injectable } from "@angular/core";

import {
  compareCombatScore,
  computeCompanionCombatScore,
  computeExpectedForLevel,
  computePlayerCombatScore,
  computeTopBottlenecks,
  type CombatScoreBreakdown,
  type CombatScoreComparison,
  type CombatScoreBottleneck,
  type CompanionCombatScoreInput,
  type ExpectedLevelScoreConfig,
  type PlayerCombatScoreInput
} from "./combat-score";

export interface CombatScoreSummary {
  readonly breakdown: CombatScoreBreakdown;
  readonly comparison: CombatScoreComparison;
  readonly bottlenecks: ReadonlyArray<CombatScoreBottleneck>;
}

export interface PlayerCombatScoreRequest {
  readonly level: number;
  readonly input: PlayerCombatScoreInput;
  readonly expectedConfig: ExpectedLevelScoreConfig;
  readonly bottleneckLimit?: number;
}

export interface CompanionCombatScoreRequest {
  readonly level: number;
  readonly input: CompanionCombatScoreInput;
  readonly expectedConfig: ExpectedLevelScoreConfig;
  readonly bottleneckLimit?: number;
}

@Injectable({ providedIn: "root" })
export class CombatScoreFacade {
  buildPlayerSummary(request: PlayerCombatScoreRequest): CombatScoreSummary {
    const breakdown = computePlayerCombatScore(request.input);
    return this.buildSummary(
      breakdown,
      request.level,
      request.expectedConfig,
      request.bottleneckLimit
    );
  }

  buildCompanionSummary(request: CompanionCombatScoreRequest): CombatScoreSummary {
    const breakdown = computeCompanionCombatScore(request.input);
    return this.buildSummary(
      breakdown,
      request.level,
      request.expectedConfig,
      request.bottleneckLimit
    );
  }

  private buildSummary(
    breakdown: CombatScoreBreakdown,
    level: number,
    expectedConfig: ExpectedLevelScoreConfig,
    bottleneckLimit = 3
  ): CombatScoreSummary {
    const expectedScore = computeExpectedForLevel(level, expectedConfig);

    return {
      breakdown,
      comparison: compareCombatScore(breakdown.total, expectedScore),
      bottlenecks: computeTopBottlenecks(breakdown, bottleneckLimit)
    };
  }
}
