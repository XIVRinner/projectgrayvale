import { Injectable, computed, inject, signal } from "@angular/core";
import type { Delta } from "@rinner/grayvale-core";
import {
  createInitialCombatState,
  finalizeCombat,
  TestCombatRng,
  runTick,
} from "@rinner/grayvale-combat";

import { CharacterRosterService } from "../../core/services/character-roster.service";
import { TickService } from "../../core/services/tick.service";
import { GameDialogService } from "../../core/services/game-dialog.service";
import { DebugLogService } from "../../core/services/game-log/debug-log.service";
import { GameplayLogService } from "../../core/services/game-log/gameplay-log.service";
import { GameQuestService } from "../../core/services/game-quest.service";
import { resolveSkillRewardAmount } from "../../core/utils/skill-progression";
import type { GameActivityDefinition } from "../../data/loaders/game-activity.types";
import {
  buildCombatEncounterBundle,
  buildCombatEncounterView,
  getCombatRoutePreview,
  isSupportedCombatActivity,
  mapCombatSkillIdToPlayerSkillId,
  type CombatEncounterBundle,
} from "./combat-encounter.adapters";
import type {
  CombatEncounterView,
  CombatRewardLineView,
  CombatRotationRuleView,
} from "./combat.types";

interface CombatRuntimeState {
  readonly bundle: CombatEncounterBundle;
  readonly state: ReturnType<typeof createInitialCombatState>;
  readonly summary: string;
  readonly rewards: readonly CombatRewardLineView[];
}

@Injectable({ providedIn: "root" })
export class CombatEncounterService {
  private readonly roster = inject(CharacterRosterService);
  private readonly ticks = inject(TickService);
  private readonly gameDialog = inject(GameDialogService);
  private readonly quests = inject(GameQuestService);
  private readonly debugLog = inject(DebugLogService);
  private readonly gameplayLog = inject(GameplayLogService);
  private readonly rng = new TestCombatRng([0.9]);

  private readonly runtimeState = signal<CombatRuntimeState | null>(null);

  readonly previewRotation = computed<readonly CombatRotationRuleView[]>(() =>
    getCombatRoutePreview(
      this.roster.activeCharacter(),
      this.roster.activeHealth(),
    ),
  );
  readonly hasActiveEncounter = computed(() => this.runtimeState() !== null);

  constructor() {
    this.ticks.registerTickType("combat", 1000, { catchUp: false });
    this.ticks.tick$("combat").subscribe(() => {
      this.advanceEncounter();
    });
  }

  isCombatActivity(activity: GameActivityDefinition): boolean {
    return isSupportedCombatActivity(activity);
  }

  startEncounter(activity: GameActivityDefinition): boolean {
    const player = this.roster.activeCharacter();
    const health = this.roster.activeHealth();

    if (!player) {
      return false;
    }

    const bundle = buildCombatEncounterBundle(activity, player, health);

    if (!bundle || this.runtimeState()) {
      return false;
    }

    const state = createInitialCombatState(bundle.activity, bundle.player, [
      ...bundle.enemies,
    ]);

    // Restore player's current HP from saved health state to persist damage across battles
    const playerActorState = state.actors[bundle.player.id];
    if (playerActorState && health?.currentHp !== undefined) {
      playerActorState.currentHp = Math.max(
        0,
        Math.min(health.currentHp, playerActorState.maxHp),
      );
    }

    const summary = "The encounter has started.";
    const runtime: CombatRuntimeState = {
      bundle,
      state,
      summary,
      rewards: [],
    };

    this.runtimeState.set(runtime);
    this.gameDialog.startCombat(
      buildCombatEncounterView(bundle, state, [], summary),
    );
    this.debugLog.logMessage("combat", "Combat encounter started.", {
      activityId: activity.id,
      playerId: player.id,
    });
    return true;
  }

  closeSummary(): void {
    this.runtimeState.set(null);
    this.gameDialog.stopCombat();
  }

  private advanceEncounter(): void {
    const runtime = this.runtimeState();

    if (!runtime || runtime.state.phase === "ended") {
      return;
    }

    const nextState = runTick(runtime.state, runtime.bundle.context, this.rng);
    let nextSummary = describeState(nextState);
    let nextRewards = runtime.rewards;

    if (nextState.phase === "ended") {
      const finalized = finalizeCombat(nextState);
      nextRewards = this.applyEncounterResult(
        runtime.bundle,
        finalized,
        nextState,
      );
      nextSummary =
        finalized.outcome === "victory"
          ? describeVictorySummary(finalized.activityId)
          : describeDefeatSummary(finalized.activityId);
      this.clearActiveActivity();
      this.debugLog.logMessage("combat", "Combat encounter ended.", {
        activityId: finalized.activityId,
        outcome: finalized.outcome,
        ticksElapsed: finalized.ticksElapsed,
      });
    }

    const nextRuntime: CombatRuntimeState = {
      bundle: runtime.bundle,
      state: nextState,
      summary: nextSummary,
      rewards: nextRewards,
    };

    this.runtimeState.set(nextRuntime);
    this.gameDialog.updateCombat(
      buildCombatEncounterView(
        nextRuntime.bundle,
        nextRuntime.state,
        nextRuntime.rewards,
        nextRuntime.summary,
      ),
    );
  }

  private applyEncounterResult(
    bundle: CombatEncounterBundle,
    finalized: ReturnType<typeof finalizeCombat>,
    finalState: ReturnType<typeof createInitialCombatState>,
  ): readonly CombatRewardLineView[] {
    const rewards: CombatRewardLineView[] = [];
    const deltas: Delta[] = [];
    const projectedSkills = new Map<string, number>();

    // Save player's final HP to health state for persistence across battles
    const playerActorState = finalState.actors[bundle.player.id];
    if (playerActorState) {
      const currentHealth = this.roster.activeHealth();
      if (currentHealth) {
        this.roster.updateActiveHealth({
          currentHp: Math.max(0, playerActorState.currentHp),
          maxHp: currentHealth.maxHp,
        });
      }
    }

    for (const xp of finalized.xp) {
      if (xp.xpType === "character") {
        deltas.push({
          type: "add",
          target: "player",
          path: ["progression", "experience"],
          value: xp.amount,
        });
        rewards.push({
          id: `xp:character:${xp.amount}`,
          label: "Character XP",
          value: `+${xp.amount}`,
          tone: "reward",
        });
        continue;
      }

      const mappedSkillId = xp.skillId
        ? mapCombatSkillIdToPlayerSkillId(xp.skillId)
        : null;

      if (mappedSkillId) {
        const currentSkillValue =
          projectedSkills.get(mappedSkillId) ??
          this.roster.activeCharacter()?.skills[mappedSkillId] ??
          0;
        const adjustedAmount = resolveSkillRewardAmount({
          currentValue: currentSkillValue,
          rawAmount: xp.amount,
          difficulty: bundle.sourceActivityDifficulty,
          rewardKind: "combat_xp",
        });

        if (adjustedAmount <= 0) {
          continue;
        }

        projectedSkills.set(mappedSkillId, currentSkillValue + adjustedAmount);
        deltas.push({
          type: "add",
          target: "player",
          path: ["skills", mappedSkillId],
          value: adjustedAmount,
        });
        rewards.push({
          id: `xp:skill:${mappedSkillId}:${xp.amount}`,
          label: `${prettyLabel(mappedSkillId)} Skill`,
          value: `+${formatRewardValue(adjustedAmount)}`,
          tone: "reward",
        });
      }
    }

    if (deltas.length > 0) {
      this.roster.applyActiveCharacterDeltas(deltas);
    }

    if (finalized.outcome === "victory") {
      const applied = this.quests.executeActivityById(bundle.activity.id);
      rewards.push({
        id: `activity:${bundle.activity.id}`,
        label: "Activity Reward",
        value: applied ? "Applied" : "No change",
        tone: applied ? "reward" : "neutral",
      });
    } else {
      // GAP: Persistent combat defeat consequences
      // Blocked on: @rinner/grayvale-core | design
      // Needs: authored save-state fields for combat lockouts, defeat recovery,
      // and how combat HP should persist back into the main player model.
      // Do not implement until: the defeat consequence contract is defined.
      for (const penalty of finalized.penalties) {
        this.gameplayLog.appendEntry({
          type: "combat",
          text: `Defeat penalty: ${penalty.durationSeconds}s attack lockout`,
        });
        rewards.push({
          id: `penalty:${penalty.penaltyType}`,
          label: "Penalty Preview",
          value: `${penalty.durationSeconds}s attack lockout`,
          tone: "warning",
        });
      }
    }

    return rewards;
  }

  private clearActiveActivity(): void {
    this.roster.applyActiveCharacterDeltas([
      {
        type: "set",
        target: "player",
        path: ["activityState", "activeActivityId"],
        value: null,
      },
    ]);
  }
}

function describeState(
  state: ReturnType<typeof createInitialCombatState>,
): string {
  switch (state.phase) {
    case "prep":
      return "Closing the distance.";
    case "combat":
      return "Blades are moving.";
    case "ended":
      return state.outcome === "victory" ? "Victory." : "Defeat.";
  }
}

function prettyLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRewardValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(value) < 1 ? 3 : 2,
  }).format(value);
}

function describeVictorySummary(activityId: string): string {
  if (activityId === "coyote_culling") {
    return "The coyote is down. Your tutorial contract is resolved.";
  }

  if (activityId === "hunt_coyote") {
    return "The hunt is over. Take what is useful and move before the noise carries.";
  }

  return "Victory.";
}

function describeDefeatSummary(activityId: string): string {
  if (activityId === "hunt_coyote") {
    return "The coyote slipped you and forced a retreat. Regroup before you track it again.";
  }

  return "The coyote drove you back. Regroup and try again.";
}
