import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { DialogModule } from "primeng/dialog";
import { InputTextModule } from "primeng/inputtext";
import { ProgressBarModule } from "primeng/progressbar";
import { SelectModule } from "primeng/select";
import { TagModule } from "primeng/tag";

import {
  applyQuestLogFilters,
  DEFAULT_QUEST_LOG_FILTERS,
  QUEST_LOG_OBJECTIVE_OPTIONS,
  QUEST_LOG_REWARD_OPTIONS,
  QUEST_LOG_SORT_OPTIONS,
  QUEST_LOG_STATUS_OPTIONS,
  type QuestLogFilters
} from "../quest-log/quest-log-filters";
import type { QuestViewModel } from "../quest-log/quest-view-model";
import { ShellQuestLogDetailComponent } from "./shell-quest-log-detail.component";
import { ShellQuestTagsComponent } from "./shell-quest-tags.component";

@Component({
  selector: "gv-shell-quest-log-dialog",
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    ProgressBarModule,
    SelectModule,
    TagModule,
    ShellQuestLogDetailComponent,
    ShellQuestTagsComponent
  ],
  templateUrl: "./shell-quest-log-dialog.component.html",
  styleUrl: "./shell-quest-log-dialog.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellQuestLogDialogComponent {
  readonly open = input.required<boolean>();
  readonly quests = input.required<readonly QuestViewModel[]>();
  readonly trackedQuestIds = input.required<readonly string[]>();

  readonly openChange = output<boolean>();
  readonly trackQuestChange = output<readonly string[]>();

  protected readonly filters = signal<QuestLogFilters>(DEFAULT_QUEST_LOG_FILTERS);
  protected readonly selectedQuestId = signal<string | null>(null);
  protected readonly filteredQuests = computed(() =>
    applyQuestLogFilters(this.quests(), this.filters())
  );
  protected readonly selectedQuest = computed(
    () =>
      this.filteredQuests().find((quest) => quest.id === this.selectedQuestId()) ?? null
  );
  protected readonly statusOptions = [...QUEST_LOG_STATUS_OPTIONS];
  protected readonly rewardOptions = [...QUEST_LOG_REWARD_OPTIONS];
  protected readonly objectiveOptions = [...QUEST_LOG_OBJECTIVE_OPTIONS];
  protected readonly sortOptions = [...QUEST_LOG_SORT_OPTIONS];
  protected readonly breakpoints = {
    "1100px": "96vw",
    "700px": "100vw"
  };

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }

      const quests = this.filteredQuests();
      const selectedQuestId = this.selectedQuestId();

      if (quests.length === 0) {
        if (selectedQuestId !== null) {
          this.selectedQuestId.set(null);
        }
        return;
      }

      if (selectedQuestId && quests.some((quest) => quest.id === selectedQuestId)) {
        return;
      }

      this.selectedQuestId.set((quests.find((quest) => quest.isActive) ?? quests[0]).id);
    });
  }

  protected updateSearch(search: string): void {
    this.filters.update((filters) => ({ ...filters, search }));
  }

  protected updateStatus(status: QuestLogFilters["status"]): void {
    this.filters.update((filters) => ({ ...filters, status }));
  }

  protected updateRewardType(rewardType: QuestLogFilters["rewardType"]): void {
    this.filters.update((filters) => ({ ...filters, rewardType }));
  }

  protected updateObjectiveType(objectiveType: QuestLogFilters["objectiveType"]): void {
    this.filters.update((filters) => ({ ...filters, objectiveType }));
  }

  protected updateSort(sort: QuestLogFilters["sort"]): void {
    this.filters.update((filters) => ({ ...filters, sort }));
  }

  protected selectQuest(questId: string): void {
    this.selectedQuestId.set(questId);
  }

  protected isTracked(questId: string): boolean {
    return this.trackedQuestIds().includes(questId);
  }

  protected toggleTrackedQuest(questId: string): void {
    const trackedQuestIds = this.trackedQuestIds();
    const nextTrackedQuestIds = trackedQuestIds.includes(questId)
      ? trackedQuestIds.filter((trackedQuestId) => trackedQuestId !== questId)
      : [...trackedQuestIds, questId];

    this.trackQuestChange.emit(nextTrackedQuestIds);
  }

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

  protected closeDialog(): void {
    this.openChange.emit(false);
  }
}
