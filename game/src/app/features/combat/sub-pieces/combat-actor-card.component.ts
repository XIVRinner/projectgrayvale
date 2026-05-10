import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import type { CombatActorCardView } from "../combat.types";

@Component({
  selector: "gv-combat-actor-card",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./combat-actor-card.component.html",
  styleUrl: "./combat-actor-card.component.scss"
})
export class CombatActorCardComponent {
  readonly actor = input.required<CombatActorCardView>();
}
