import { createInitialCombatState } from "./create-initial-combat-state";
import {
  playerActor,
  coyoteEnemy,
  mvpCombatActivity,
} from "@rinner/grayvale-core";
import type { CombatActivityDefinition } from "@rinner/grayvale-core";

describe("createInitialCombatState — MVP activity", () => {
  const state = createInitialCombatState(mvpCombatActivity, playerActor, [
    coyoteEnemy,
  ]);

  it("sets the activityId from the activity definition", () => {
    expect(state.activityId).toBe(mvpCombatActivity.id);
  });

  it("starts at tick 0", () => {
    expect(state.currentTick).toBe(0);
  });

  it("starts in prep phase when prepTicks > 0", () => {
    expect(state.phase).toBe("prep");
  });

  it("has no outcome initially", () => {
    expect(state.outcome).toBeUndefined();
  });

  it("has no log entries initially", () => {
    expect(state.logs).toHaveLength(0);
  });
});

describe("createInitialCombatState — player actor state", () => {
  const state = createInitialCombatState(mvpCombatActivity, playerActor, [
    coyoteEnemy,
  ]);
  const player = state.actors[playerActor.id];

  it("player actor state is present", () => {
    expect(player).toBeDefined();
  });

  it("player actorId matches definition id", () => {
    expect(player.actorId).toBe(playerActor.id);
  });

  it("player definitionId matches definition id", () => {
    expect(player.definitionId).toBe(playerActor.id);
  });

  it("player starts at full HP", () => {
    expect(player.currentHp).toBe(playerActor.maxHp);
    expect(player.maxHp).toBe(playerActor.maxHp);
  });

  it("player level is correct", () => {
    expect(player.level).toBe(playerActor.level);
  });

  it("player tags are copied from the definition", () => {
    expect(player.tags).toEqual(playerActor.tags);
  });

  it("player stamina resource starts at its startsAt value", () => {
    expect(player.resources["stamina"]).toBe(100);
  });

  it("player has no active effects initially", () => {
    expect(player.activeEffects).toHaveLength(0);
  });

  it("player has no cooldowns initially", () => {
    expect(Object.keys(player.cooldowns)).toHaveLength(0);
  });

  it("player starts at range 0", () => {
    expect(player.range).toBe(0);
  });

  it("player is not defeated initially", () => {
    expect(player.defeated).toBe(false);
  });
});

describe("createInitialCombatState — coyote enemy state", () => {
  const state = createInitialCombatState(mvpCombatActivity, playerActor, [
    coyoteEnemy,
  ]);
  const coyote = state.actors[coyoteEnemy.id];

  it("coyote actor state is present", () => {
    expect(coyote).toBeDefined();
  });

  it("coyote starts at full HP", () => {
    expect(coyote.currentHp).toBe(coyoteEnemy.maxHp);
    expect(coyote.maxHp).toBe(coyoteEnemy.maxHp);
  });

  it("coyote level is correct", () => {
    expect(coyote.level).toBe(coyoteEnemy.level);
  });

  it("coyote has no active effects initially", () => {
    expect(coyote.activeEffects).toHaveLength(0);
  });

  it("coyote has no cooldowns initially", () => {
    expect(Object.keys(coyote.cooldowns)).toHaveLength(0);
  });

  it("coyote is not defeated initially", () => {
    expect(coyote.defeated).toBe(false);
  });
});

describe("createInitialCombatState — accumulated delta", () => {
  const state = createInitialCombatState(mvpCombatActivity, playerActor, [
    coyoteEnemy,
  ]);

  it("actorChanges starts empty", () => {
    expect(state.accumulatedDelta.actorChanges).toHaveLength(0);
  });

  it("resourceChanges starts empty", () => {
    expect(state.accumulatedDelta.resourceChanges).toHaveLength(0);
  });

  it("effectsApplied starts empty", () => {
    expect(state.accumulatedDelta.effectsApplied).toHaveLength(0);
  });

  it("effectsExpired starts empty", () => {
    expect(state.accumulatedDelta.effectsExpired).toHaveLength(0);
  });

  it("xp starts empty", () => {
    expect(state.accumulatedDelta.xp).toHaveLength(0);
  });

  it("loot starts empty", () => {
    expect(state.accumulatedDelta.loot).toHaveLength(0);
  });

  it("penalties starts empty", () => {
    expect(state.accumulatedDelta.penalties).toHaveLength(0);
  });
});

describe("createInitialCombatState — phase when prepTicks is 0", () => {
  const noPrepActivity: CombatActivityDefinition = {
    ...mvpCombatActivity,
    prepTicks: 0,
  };

  it("starts in combat phase when prepTicks is 0", () => {
    const state = createInitialCombatState(noPrepActivity, playerActor, [
      coyoteEnemy,
    ]);
    expect(state.phase).toBe("combat");
  });
});

describe("createInitialCombatState — outcome transitions", () => {
  const state = createInitialCombatState(mvpCombatActivity, playerActor, [
    coyoteEnemy,
  ]);

  it("combat can end in victory by setting outcome on the state copy", () => {
    const victoryState = { ...state, phase: "ended" as const, outcome: "victory" as const };
    expect(victoryState.outcome).toBe("victory");
    expect(victoryState.phase).toBe("ended");
  });

  it("combat can end in defeat", () => {
    const defeatState = { ...state, phase: "ended" as const, outcome: "defeat" as const };
    expect(defeatState.outcome).toBe("defeat");
  });

  it("combat can end by fleeing", () => {
    const fledState = { ...state, phase: "ended" as const, outcome: "fled" as const };
    expect(fledState.outcome).toBe("fled");
  });
});
