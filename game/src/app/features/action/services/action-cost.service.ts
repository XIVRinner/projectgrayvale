import { Injectable } from "@angular/core";
import type { Player } from "@rinner/grayvale-core";

export interface ActionCostResult {
  readonly baseCost: number;
  readonly calculatedCost: number;
  readonly affordable: boolean;
  readonly breakdown: readonly {
    readonly source: string;
    readonly factor: number;
    readonly contribution: number;
  }[];
}

/**
 * Calculates action costs based on player level, health, and other factors.
 * 
 * Cost formula: base + (level * 2) + (hp_missing * 0.5)
 */
@Injectable({ providedIn: "root" })
export class ActionCostService {
  calculateCost(
    action: {
      readonly cost?: {
        readonly base: number;
        readonly factors?: readonly {
          readonly source: string;
          readonly multiplier: number;
        }[];
      };
    },
    player: Player,
    currentHp: number,
    maxHp: number
  ): ActionCostResult {
    const baseCost = action.cost?.base ?? 0;
    const factors = action.cost?.factors ?? [];

    let total = baseCost;
    const breakdown: {
      source: string;
      factor: number;
      contribution: number;
    }[] = [];

    // Calculate contributions from each factor
    for (const factor of factors) {
      let factorValue = 0;

      switch (factor.source) {
        case "player_level":
          factorValue = player.progression.level * factor.multiplier;
          breakdown.push({
            source: "player_level",
            factor: factor.multiplier,
            contribution: factorValue
          });
          break;

        case "hp_missing": {
          const hpMissing = Math.max(0, maxHp - currentHp);
          factorValue = hpMissing * factor.multiplier;
          breakdown.push({
            source: "hp_missing",
            factor: factor.multiplier,
            contribution: factorValue
          });
          break;
        }

        case "hp_max":
          factorValue = maxHp * factor.multiplier;
          breakdown.push({
            source: "hp_max",
            factor: factor.multiplier,
            contribution: factorValue
          });
          break;
      }

      total += factorValue;
    }

    // Check if player can afford (assuming currency in inventory["currency"] or similar)
    const playerCurrency = (player.inventory?.items?.["currency"] as number) ?? 0;
    const affordable = playerCurrency >= total;

    return {
      baseCost,
      calculatedCost: Math.round(total),
      affordable,
      breakdown
    };
  }
}
