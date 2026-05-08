import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input
} from "@angular/core";

import type { ObjectiveViewModel } from "../quest-log/quest-view-model";

@Component({
  selector: "gv-shell-quest-objective-list",
  standalone: true,
  imports: [forwardRef(() => ShellQuestObjectiveListComponent)],
  templateUrl: "./shell-quest-objective-list.component.html",
  styleUrl: "./shell-quest-objective-list.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellQuestObjectiveListComponent {
  readonly objectives = input.required<readonly ObjectiveViewModel[]>();
  readonly compact = input(false);
}
