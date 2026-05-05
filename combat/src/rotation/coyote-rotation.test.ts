import { compileCoyoteRotation } from "./coyote-rotation-compiler";
import { selectNextAction } from "./rotation-selector";
import { tickCooldowns } from "../engine/tick-cooldowns";
import type { ActorCombatState } from "@rinner/grayvale-core";

function makeCoyoteState(
  scratchCooldown: number = 0
): ActorCombatState {
  return {
    actorId: "actor_coyote",
    definitionId: "actor_coyote",
    currentHp: 45,
    maxHp: 45,
    level: 2,
    tags: ["beast", "canine"],
    resources: {},
    activeEffects: [],
    cooldowns:
      scratchCooldown > 0
        ? { ability_coyote_scratch: scratchCooldown }
        : {},
    range: 0,
    defeated: false
  };
}

describe("compileCoyoteRotation — structure", () => {
  const compiled = compileCoyoteRotation();

  it("compiled rotation has rules", () => {
    expect(compiled.rules.length).toBeGreaterThan(0);
  });

  it("Scratch rule has ability_not_on_cooldown condition", () => {
    const scratchRule = compiled.rules.find(
      (r) => r.abilityId === "ability_coyote_scratch"
    );
    expect(scratchRule).toBeDefined();
    expect(scratchRule!.condition).toBeDefined();
    expect(scratchRule!.condition!.type).toBe("ability_not_on_cooldown");
  });

  it("Scratch condition references ability_coyote_scratch", () => {
    const scratchRule = compiled.rules.find(
      (r) => r.abilityId === "ability_coyote_scratch"
    );
    expect(scratchRule!.condition).toMatchObject({
      type: "ability_not_on_cooldown",
      abilityId: "ability_coyote_scratch"
    });
  });

  it("includes an auto attack fallback rule", () => {
    const fallback = compiled.rules.find((r) => r.isFallback === true);
    expect(fallback).toBeDefined();
    expect(fallback!.abilityId).toBe("ability_auto_attack");
  });

  it("Scratch rule appears before auto attack in priority order", () => {
    const scratchIdx = compiled.rules.findIndex(
      (r) => r.abilityId === "ability_coyote_scratch"
    );
    const autoIdx = compiled.rules.findIndex(
      (r) => r.abilityId === "ability_auto_attack"
    );
    expect(scratchIdx).toBeLessThan(autoIdx);
  });
});

describe("selectNextAction — coyote rotation", () => {
  const compiled = compileCoyoteRotation();

  it("selects Scratch when Scratch is not on cooldown", () => {
    expect(selectNextAction(compiled, makeCoyoteState(0))).toBe(
      "ability_coyote_scratch"
    );
  });

  it("selects Auto Attack when Scratch is on cooldown (4 ticks)", () => {
    expect(selectNextAction(compiled, makeCoyoteState(4))).toBe(
      "ability_auto_attack"
    );
  });

  it("selects Auto Attack when Scratch is on cooldown (1 tick remaining)", () => {
    expect(selectNextAction(compiled, makeCoyoteState(1))).toBe(
      "ability_auto_attack"
    );
  });
});

describe("tickCooldowns — Scratch cooldown ticks down", () => {
  it("decrements Scratch cooldown by 1 each tick", () => {
    const state = makeCoyoteState(4);
    const after1 = tickCooldowns(state);
    expect(after1.cooldowns["ability_coyote_scratch"]).toBe(3);
  });

  it("removes the cooldown entry when it reaches zero", () => {
    const state = makeCoyoteState(1);
    const after1 = tickCooldowns(state);
    expect(after1.cooldowns["ability_coyote_scratch"]).toBeUndefined();
  });

  it("Scratch becomes available after 4 ticks of tick-down", () => {
    let state = makeCoyoteState(4);
    const compiled = compileCoyoteRotation();

    // still on cooldown for 3 more ticks
    for (let i = 0; i < 3; i++) {
      state = tickCooldowns(state);
      expect(selectNextAction(compiled, state)).toBe("ability_auto_attack");
    }

    // 4th tick-down brings it to 0 / removes it
    state = tickCooldowns(state);
    expect(selectNextAction(compiled, state)).toBe("ability_coyote_scratch");
  });

  it("does not affect other cooldowns when ticking Scratch", () => {
    const state: ActorCombatState = {
      ...makeCoyoteState(4),
      cooldowns: {
        ability_coyote_scratch: 4,
        ability_other: 2
      }
    };
    const after = tickCooldowns(state);
    expect(after.cooldowns["ability_coyote_scratch"]).toBe(3);
    expect(after.cooldowns["ability_other"]).toBe(1);
  });

  it("returns a new state object (immutability)", () => {
    const state = makeCoyoteState(4);
    const after = tickCooldowns(state);
    expect(after).not.toBe(state);
    expect(after.cooldowns).not.toBe(state.cooldowns);
  });

  it("leaves cooldowns unchanged when none are active", () => {
    const state = makeCoyoteState(0);
    const after = tickCooldowns(state);
    expect(Object.keys(after.cooldowns)).toHaveLength(0);
  });
});
