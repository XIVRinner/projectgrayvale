import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import type { CombatLogLineView } from "../combat.types";

@Component({
  selector: "gv-combat-log-feed",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./combat-log-feed.component.html",
  styleUrl: "./combat-log-feed.component.scss"
})
export class CombatLogFeedComponent {
  readonly logs = input.required<readonly CombatLogLineView[]>();
}
