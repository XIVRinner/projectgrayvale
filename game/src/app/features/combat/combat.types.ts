export interface CombatActorCardView {
  readonly id: string;
  readonly name: string;
  readonly role: "player" | "enemy";
  readonly currentHp: number;
  readonly maxHp: number;
  readonly hpPercent: number;
  readonly statusLabel: string;
  readonly effectLabels: readonly string[];
}

export interface CombatLogLineView {
  readonly id: string;
  readonly tick: number;
  readonly text: string;
  readonly type: string;
}

export interface CombatRotationRuleView {
  readonly id: string;
  readonly abilityLabel: string;
  readonly detail: string;
  readonly isFallback: boolean;
  readonly isReaction: boolean;
}

export interface CombatRewardLineView {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly tone: "reward" | "warning" | "neutral";
}

export interface CombatEncounterView {
  readonly activityId: string;
  readonly title: string;
  readonly phaseLabel: string;
  readonly tickLabel: string;
  readonly summary: string;
  readonly outcomeLabel: string | null;
  readonly player: CombatActorCardView;
  readonly enemies: readonly CombatActorCardView[];
  readonly logs: readonly CombatLogLineView[];
  readonly rotation: readonly CombatRotationRuleView[];
  readonly rewards: readonly CombatRewardLineView[];
}
