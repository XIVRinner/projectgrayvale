import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import type { CombatRotationRuleView } from "../combat.types";

@Component({
  selector: "gv-combat-rotation-preview",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./combat-rotation-preview.component.html",
  styleUrl: "./combat-rotation-preview.component.scss"
})
export class CombatRotationPreviewComponent {
  readonly rows = input.required<readonly CombatRotationRuleView[]>();
}
