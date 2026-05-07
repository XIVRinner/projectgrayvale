import { Injector, runInInjectionContext } from "@angular/core";

import { ActivityService } from "../services/activity.service";
import { DebugLogService } from "../services/game-log/debug-log.service";
import { GameDialogService } from "../services/game-dialog.service";
import { GameQuestService } from "../services/game-quest.service";
import { WorldStateService } from "../services/world-state.service";
import { GameplayTriggerRunner } from "./gameplay-trigger-runner";

describe("GameplayTriggerRunner", () => {
  it("dispatches dialogue executions through startDialogueById", () => {
    const gameDialog = {
      startDialogueById: jest.fn()
    };
    const runner = createRunner({ gameDialog });

    const result = runner.run({
      id: "story:bridgitte-house",
      contextId: "bridgitte-house",
      label: "Speak to Bridgitte",
      groupKind: "talk",
      hiddenByDefault: false,
      execution: {
        kind: "dialogue",
        dialogueTarget: "bridgitte-house"
      }
    });

    expect(result).toEqual({ ok: true, actionId: "story:bridgitte-house" });
    expect(gameDialog.startDialogueById).toHaveBeenCalledWith("bridgitte-house");
  });
});

function createRunner(overrides?: {
  gameDialog?: { startDialogueById: jest.Mock };
}): GameplayTriggerRunner {
  const injector = Injector.create({
    providers: [
      {
        provide: ActivityService,
        useValue: {
          toggleActivity: jest.fn()
        }
      },
      {
        provide: WorldStateService,
        useValue: {
          currentWorld: jest.fn(),
          executeEnterSublocation: jest.fn(),
          executeExitSublocation: jest.fn(),
          executeTravel: jest.fn()
        }
      },
      {
        provide: GameQuestService,
        useValue: {}
      },
      {
        provide: GameDialogService,
        useValue: overrides?.gameDialog ?? {
          startDialogueById: jest.fn()
        }
      },
      {
        provide: DebugLogService,
        useValue: {
          logMessage: jest.fn()
        }
      }
    ]
  });

  return runInInjectionContext(injector, () => new GameplayTriggerRunner());
}
