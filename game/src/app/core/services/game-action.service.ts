import { Injectable, inject } from "@angular/core";

import { CharacterRosterService } from "./character-roster.service";
import { DebugLogService } from "./game-log/debug-log.service";
import {
  buildButtonPressDeltas,
  type ButtonPressActionInput
} from "./button-press-delta.factory";
import type { SaveSlotWorldState } from "./world-state.models";

@Injectable({ providedIn: "root" })
export class GameActionService {
  private readonly roster = inject(CharacterRosterService);
  private readonly debugLog = inject(DebugLogService);

  execute(
    action: ButtonPressActionInput,
    effect: () => void
  ): boolean {
    const activeSlot = this.roster.activeSlot();

    if (!activeSlot) {
      this.debugLog.logMessage("action", "Button press action rejected because there is no active slot.", action);
      return false;
    }

    const deltas = buildButtonPressDeltas(
      activeSlot.player,
      activeSlot.world,
      action,
      new Date().toISOString()
    );
    const updatedSlot = this.roster.applyActiveCharacterDeltas(deltas);

    if (!updatedSlot) {
      this.debugLog.logMessage("action", "Button press action failed while applying deltas.", {
        action,
        deltaCount: deltas.length
      });
      return false;
    }

    this.debugLog.logMessage("action", "Button press action applied.", {
      action,
      deltaCount: deltas.length
    });
    effect();
    return true;
  }

  executeWorldAction(
    action: ButtonPressActionInput,
    nextWorld: SaveSlotWorldState
  ): boolean {
    const activeSlot = this.roster.activeSlot();

    if (!activeSlot) {
      this.debugLog.logMessage("action", "World action rejected because there is no active slot.", action);
      return false;
    }

    const deltas = buildButtonPressDeltas(
      activeSlot.player,
      activeSlot.world,
      action,
      new Date().toISOString()
    );

    const applied = this.roster.applyActiveCharacterAndWorldUpdate(deltas, nextWorld) !== null;

    this.debugLog.logMessage(
      "action",
      applied ? "World action applied." : "World action failed while applying state update.",
      {
        action,
        deltaCount: deltas.length,
        nextWorld
      }
    );

    return applied;
  }
}
