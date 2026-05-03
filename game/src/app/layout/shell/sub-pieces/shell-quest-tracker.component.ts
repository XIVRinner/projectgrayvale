import { Component, input } from "@angular/core";

import { ShellQuestTrackerPanel } from "../shell.types";

@Component({
  selector: "gv-shell-quest-tracker",
  standalone: true,
  templateUrl: "./shell-quest-tracker.component.html",
  styleUrl: "./shell-quest-tracker.component.scss"
})
export class ShellQuestTrackerComponent {
  readonly panel = input.required<ShellQuestTrackerPanel>();
}
