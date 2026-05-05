import { compileShortBladeRotation } from "./rotation-compiler";
import { selectNextAction } from "./rotation-selector";
import { shortBladeSkill, oldDagger } from "@rinner/grayvale-core";
import type { ActorCombatState } from "@rinner/grayvale-core";

function makeActorState(piercingTalonStacks: number): ActorCombatState {
  return {
    actorId: "actor_player_mvp",
    definitionId: "actor_player_mvp",
    currentHp: 80,
    maxHp: 80,
    level: 3,
    tags: ["player"],
    resources: {},
    activeEffects:
      piercingTalonStacks > 0
        ? [
            {
              effectId: "effect_piercing_talon",
              sourceActorId: "actor_player_mvp",
              targetActorId: "actor_player_mvp",
              stacks: piercingTalonStacks
            }
          ]
        : [],
    cooldowns: {},
    range: 0,
    defeated: false
  };
}

describe("compileShortBladeRotation — structure", () => {
  it("compiles from old dagger + short blade skill", () => {
    const compiled = compileShortBladeRotation([oldDagger], shortBladeSkill);
    expect(compiled.skillId).toBe("skill_short_blade");
    expect(compiled.rules.length).toBeGreaterThan(0);
  });

  it("includes a piercing finisher rule with an effect_stacks_gte condition", () => {
    const compiled = compileShortBladeRotation([oldDagger], shortBladeSkill);
    const finisherRule = compiled.rules.find(
      (r) => r.abilityId === "ability_piercing_finisher"
    );
    expect(finisherRule).toBeDefined();
    expect(finisherRule!.condition).toBeDefined();
    expect(finisherRule!.condition!.type).toBe("effect_stacks_gte");
    expect(finisherRule!.condition!.effectId).toBe("effect_piercing_talon");
    expect(finisherRule!.condition!.threshold).toBe(2);
  });

  it("includes slashing cut as the unconditional default action", () => {
    const compiled = compileShortBladeRotation([oldDagger], shortBladeSkill);
    const slashRule = compiled.rules.find(
      (r) => r.abilityId === "ability_slashing_cut"
    );
    expect(slashRule).toBeDefined();
    expect(slashRule!.condition).toBeUndefined();
  });

  it("includes an auto attack fallback rule", () => {
    const compiled = compileShortBladeRotation([oldDagger], shortBladeSkill);
    const fallback = compiled.rules.find((r) => r.isFallback === true);
    expect(fallback).toBeDefined();
    expect(fallback!.abilityId).toBe("ability_auto_attack");
  });

  it("piercing finisher rule appears before slashing cut in priority order", () => {
    const compiled = compileShortBladeRotation([oldDagger], shortBladeSkill);
    const finisherIdx = compiled.rules.findIndex(
      (r) => r.abilityId === "ability_piercing_finisher"
    );
    const slashIdx = compiled.rules.findIndex(
      (r) => r.abilityId === "ability_slashing_cut"
    );
    expect(finisherIdx).toBeLessThan(slashIdx);
  });
});

describe("selectNextAction — short blade rotation sequence", () => {
  const compiled = compileShortBladeRotation([oldDagger], shortBladeSkill);

  it("tick 1: selects slashing cut at 0 piercing_talon stacks", () => {
    expect(selectNextAction(compiled, makeActorState(0))).toBe(
      "ability_slashing_cut"
    );
  });

  it("tick 2: selects slashing cut at 1 piercing_talon stack", () => {
    expect(selectNextAction(compiled, makeActorState(1))).toBe(
      "ability_slashing_cut"
    );
  });

  it("tick 3: selects piercing finisher at 2 piercing_talon stacks", () => {
    expect(selectNextAction(compiled, makeActorState(2))).toBe(
      "ability_piercing_finisher"
    );
  });

  it("repeats: selects slashing cut again after finisher consumes stacks (0 stacks)", () => {
    expect(selectNextAction(compiled, makeActorState(0))).toBe(
      "ability_slashing_cut"
    );
  });

  it("auto attack fallback is returned when the compiled rules list is empty", () => {
    const emptyCompiled = { skillId: "skill_short_blade", rules: [] };
    expect(selectNextAction(emptyCompiled, makeActorState(0))).toBe(
      "ability_auto_attack"
    );
  });

  it("auto attack fallback rule in compiled rotation fires when all conditions fail", () => {
    // Override: a rotation where only the finisher rule exists (requires 2 stacks)
    // and a fallback. At 0 stacks the finisher condition fails, so the fallback fires.
    const conditionOnlyCompiled = {
      skillId: "skill_short_blade",
      rules: [
        {
          abilityId: "ability_piercing_finisher",
          condition: {
            type: "effect_stacks_gte" as const,
            effectId: "effect_piercing_talon",
            threshold: 2
          }
        },
        { abilityId: "ability_auto_attack", isFallback: true }
      ]
    };
    expect(selectNextAction(conditionOnlyCompiled, makeActorState(0))).toBe(
      "ability_auto_attack"
    );
  });
});
