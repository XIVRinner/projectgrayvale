import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import type { QuestTagViewModel } from "../quest-log/quest-view-model";

@Component({
  selector: "gv-shell-quest-tags",
  standalone: true,
  templateUrl: "./shell-quest-tags.component.html",
  styleUrl: "./shell-quest-tags.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellQuestTagsComponent {
  readonly tags = input.required<
    readonly Pick<QuestTagViewModel, "id" | "label" | "emphasis">[]
  >();
  readonly compact = input(false);
}
