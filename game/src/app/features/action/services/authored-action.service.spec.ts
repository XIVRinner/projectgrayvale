import { Injector, runInInjectionContext } from "@angular/core";
import { of } from "rxjs";
import { samplePlayer } from "@rinner/grayvale-core";

import { CharacterRosterService } from "../../../core/services/character-roster.service";
import type { SaveSlotHealthState } from "../../../core/services/health-balance";
import { DebugLogService } from "../../../core/services/game-log/debug-log.service";
import {
  ActionsLoader,
  type AuthoredActionDefinition,
} from "../../../data/loaders/actions.loader";
import { ActionCostService } from "./action-cost.service";
import { AuthoredActionService } from "./authored-action.service";

describe("AuthoredActionService", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("executes heal_full actions by spending money and restoring hp", () => {
    const action: AuthoredActionDefinition = {
      id: "eat_hearty_meal",
      name: "Eat a Hearty Meal",
      description: "Recover in the tavern.",
      tags: ["healing", "tavern"],
      cost: {
        type: "calculated",
        base: 5,
        factors: [],
      },
      effect: {
        type: "heal_full",
      },
      requirements: {
        location: "tavern",
      },
    };

    const { roster, service } = createFixture([action], 40, 100);
    const player = roster.activeCharacter();

    expect(player).not.toBeNull();
    expect(player?.money).toBeGreaterThanOrEqual(5);

    const result = service.executeActionById("eat_hearty_meal");

    expect(result.ok).toBe(true);
    expect(roster.activeHealth()).toEqual({
      currentHp: 100,
      maxHp: 100,
    });
    expect(roster.activeCharacter()?.money).toBe((player?.money ?? 0) - 5);
  });
});

function createFixture(
  actions: readonly AuthoredActionDefinition[],
  currentHp: number,
  maxHp: number,
): {
  roster: CharacterRosterService;
  service: AuthoredActionService;
} {
  const roster = new CharacterRosterService();
  const player = clone(samplePlayer);
  player.money = 100;
  const health: SaveSlotHealthState = {
    currentHp,
    maxHp,
  };
  roster.createCharacter(player, health);

  const debugLogStub = {
    logMessage: jest.fn(),
  };

  const injector = Injector.create({
    providers: [
      { provide: CharacterRosterService, useValue: roster },
      { provide: ActionsLoader, useValue: { load: () => of(actions) } },
      { provide: DebugLogService, useValue: debugLogStub },
      ActionCostService,
    ],
  });

  return runInInjectionContext(injector, () => ({
    roster,
    service: new AuthoredActionService(),
  }));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
