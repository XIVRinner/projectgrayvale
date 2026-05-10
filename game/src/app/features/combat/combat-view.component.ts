import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import type { CombatEncounterView, CombatRotationRuleView } from "./combat.types";
import { CombatActorCardComponent } from "./sub-pieces/combat-actor-card.component";
import { CombatLogFeedComponent } from "./sub-pieces/combat-log-feed.component";
import { CombatRotationPreviewComponent } from "./sub-pieces/combat-rotation-preview.component";

@Component({
  selector: "gv-combat-view",
  standalone: true,
  imports: [CombatActorCardComponent, CombatLogFeedComponent, CombatRotationPreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./combat-view.component.html",
  styleUrl: "./combat-view.component.scss"
})
export class CombatViewComponent {
  readonly encounter = input<CombatEncounterView | null>(null);
  readonly previewRotation = input<readonly CombatRotationRuleView[]>([]);

  readonly returnRequested = output<void>();
  readonly dismissRequested = output<void>();
}
