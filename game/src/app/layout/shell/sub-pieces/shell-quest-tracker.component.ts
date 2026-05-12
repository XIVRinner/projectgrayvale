import { ChangeDetectionStrategy, Component, input, output, signal } from "@angular/core";
import { ButtonModule } from "primeng/button";
import { ProgressBarModule } from "primeng/progressbar";

import { ShellQuestTrackerPanel } from "../shell.types";
import { ShellQuestTagsComponent } from "./shell-quest-tags.component";

@Component({
  selector: "gv-shell-quest-tracker",
  standalone: true,
  imports: [ButtonModule, ProgressBarModule, ShellQuestTagsComponent],
  templateUrl: "./shell-quest-tracker.component.html",
  styleUrl: "./shell-quest-tracker.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellQuestTrackerComponent {
  readonly panel = input.required<ShellQuestTrackerPanel>();
  readonly openQuestLogRequested = output<void>();

  protected readonly collapsed = signal(false);

  protected toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
  }
}
