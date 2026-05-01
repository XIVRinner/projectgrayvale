import { Injectable, inject } from "@angular/core";

import { CharacterRosterService } from "./character-roster.service";
import {
  buildButtonPressDeltas,
  type ButtonPressActionInput
} from "./button-press-delta.factory";

@Injectable({ providedIn: "root" })
export class GameActionService {
  private readonly roster = inject(CharacterRosterService);

  execute(
    action: ButtonPressActionInput,
    effect: () => void
  ): boolean {
    const activeSlot = this.roster.activeSlot();

    if (!activeSlot) {
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
      return false;
    }

    effect();
    return true;
  }
}
