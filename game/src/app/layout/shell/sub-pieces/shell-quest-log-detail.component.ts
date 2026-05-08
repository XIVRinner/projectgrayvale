import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";
import { ButtonModule } from "primeng/button";
import { ProgressBarModule } from "primeng/progressbar";
import { TagModule } from "primeng/tag";

import type { QuestViewModel, RewardViewModel } from "../quest-log/quest-view-model";
import { ShellQuestObjectiveListComponent } from "./shell-quest-objective-list.component";
import { ShellQuestTagsComponent } from "./shell-quest-tags.component";

@Component({
  selector: "gv-shell-quest-log-detail",
  standalone: true,
  imports: [
    ButtonModule,
    ProgressBarModule,
    TagModule,
    ShellQuestObjectiveListComponent,
    ShellQuestTagsComponent
  ],
  templateUrl: "./shell-quest-log-detail.component.html",
  styleUrl: "./shell-quest-log-detail.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellQuestLogDetailComponent {
  readonly quest = input<QuestViewModel | null>(null);
  readonly tracked = input(false);

  readonly trackToggled = output<string>();

  protected readonly hasRewards = computed(() => {
    const quest = this.quest();

    if (!quest) {
      return false;
    }

    return (
      quest.startRewards.length > 0 ||
      (quest.currentStep?.rewards.length ?? 0) > 0 ||
      quest.rewards.length > 0
    );
  });

  protected statusSeverity(status: QuestViewModel["status"]): "success" | "secondary" | "info" {
    switch (status) {
      case "completed":
        return "success";
      case "active":
        return "info";
      case "inactive":
        return "secondary";
    }
  }

  protected toggleTrackedQuest(): void {
    const quest = this.quest();

    if (!quest || !quest.isActive) {
      return;
    }

    this.trackToggled.emit(quest.id);
  }

  protected trackReward(_index: number, reward: RewardViewModel): string {
    return `${reward.type}:${reward.shortLabel}:${reward.stateLabel ?? ""}`;
  }
}
